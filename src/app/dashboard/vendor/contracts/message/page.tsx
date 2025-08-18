'use client'

import { useEffect, useState, useCallback } from 'react'
import React, { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import VendorHeader from '@/components/Vendor/VendorHeader'
import BottomNavbar from '@/components/BottomNavbar'
import { 
	ArrowLeft, 
	Send,
	MessageSquare,
	User,
	Building,
	FileText
} from 'lucide-react'

interface Contract {
	id: string
	title: string
	status: string
	contract_type?: string
	property: {
		id: string
		title: string
		address: string
	} | null
	owner: {
		id?: string
		full_name: string
		email: string | null
	} | null
}

interface Message {
	id: string
	content: string
	sender_id: string
	sender_name: string
	created_at: string
	is_read: boolean
}

function VendorContractMessagePageInner() {
	const searchParams = useSearchParams()
	const id = searchParams.get('id')
	const router = useRouter()
	const { user } = useAuthStore()
	const [contract, setContract] = useState<Contract | null>(null)
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(true)
	const [sending, setSending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [newMessage, setNewMessage] = useState('')
	const [messageType, setMessageType] = useState<'general' | 'question' | 'update' | 'issue' | 'other'>('general')

	const loadContract = useCallback(async () => {
		try {
			setLoading(true)
			if (!user || !id) return
			console.log('Loading contract with ID:', id)
			const { data: contractData, error: contractError } = await supabase
				.from('service_contracts')
				.select(`
					*,
					property:properties(id, title, address),
					owner:profiles!service_contracts_owner_id_fkey(id, full_name, email)
				`)
				.eq('id', String(id))
				.eq('vendor_id', user.id)
				.single()
			if (contractError) {
				console.error('Contract loading error:', contractError)
				throw contractError
			}
			console.log('Contract data loaded:', contractData)
			const normalized: Contract = {
				id: (contractData as any).id,
				title: (contractData as any).title,
				status: (contractData as any).status,
				contract_type: (contractData as any).contract_type,
				property: (contractData as any).property || null,
				owner: (contractData as any).owner || null,
			}
			console.log('Normalized contract:', normalized)
			setContract(normalized)
		} catch (error) {
			console.error('Error loading contract:', error)
			setError('Failed to load contract')
		} finally {
			setLoading(false)
		}
	}, [id, user])

	const loadMessages = useCallback(async () => {
		if (!contract || !user) return
		
		// Check if we have a valid property_id
		if (!contract.property?.id) {
			console.warn('No property_id available for contract:', contract.id)
			setMessages([])
			return
		}
		
		try {
			console.log('Loading messages for property_id:', contract.property.id)
			
			// First, let's test if we can access the messages table at all
			const { data: testData, error: testError } = await supabase
				.from('messages')
				.select('id')
				.limit(1)
			
			if (testError) {
				console.error('Messages table access test failed:', testError)
				throw testError
			}
			console.log('Messages table access test passed')
			
			const { data: messagesData, error: messagesError } = await supabase
				.from('messages')
				.select(`
					*,
					sender:profiles!messages_sender_id_fkey(id, full_name)
				`)
				.eq('property_id', contract.property.id)
				.order('created_at', { ascending: true })
			
			if (messagesError) {
				console.error('Messages query error:', messagesError)
				throw messagesError
			}
			
			console.log('Messages loaded:', messagesData)
			const formattedMessages: Message[] = (messagesData || []).map((msg: any) => ({
				id: msg.id,
				content: msg.content,
				sender_id: msg.sender_id || '',
				sender_name: msg.sender?.full_name || 'Unknown',
				created_at: msg.created_at || new Date().toISOString(),
				is_read: Boolean(msg.read_at)
			}))
			setMessages(formattedMessages)
			
			// Mark unread messages as read
			const unreadIds = formattedMessages.filter(m => !m.is_read && m.sender_id !== user.id).map(m => m.id)
			if (unreadIds.length > 0) {
				const { error: updateError } = await supabase
					.from('messages')
					.update({ read_at: new Date().toISOString() })
					.in('id', unreadIds)
				if (updateError) {
					console.error('Error marking messages as read:', updateError)
				}
			}
		} catch (error) {
			console.error('Error loading messages:', error)
			setMessages([])
		}
	}, [contract, user])

	useEffect(() => {
		if (!user || !id) return
		loadContract()
	}, [loadContract, id, user])

	useEffect(() => {
		if (contract) {
			loadMessages()
		}
	}, [loadMessages, contract])

	const sendMessage = async () => {
		if (!contract || !newMessage.trim() || !user) {
			setError('Please enter a message')
			return
		}
		try {
			setSending(true)
			setError(null)
			const { error: sendError } = await supabase
				.from('messages')
				.insert({
					property_id: contract.property?.id,
					sender_id: user.id,
					recipient_id: contract.owner?.id || null,
					content: newMessage,
					message_type: messageType,
					read_at: null
				})
			if (sendError) throw sendError
			
			// Only create notification if we have a valid recipient
			if (contract.owner?.id) {
				await supabase.rpc('create_contract_notification', {
					p_contract_id: contract.id,
					p_recipient_id: contract.owner.id,
					p_notification_type: 'message',
					p_title: 'New Message from Vendor',
					p_message: `You have received a new message from the vendor regarding contract "${contract.title}".`
				})
			}
			
			await supabase.rpc('log_contract_event', {
				p_contract_id: contract.id,
				p_event: 'message_sent',
				p_new_values: { message_type: messageType, sender_id: user.id }
			})
			setNewMessage('')
			await loadMessages()
		} catch (error) {
			console.error('Error sending message:', error)
			setError(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`)
		} finally {
			setSending(false)
		}
	}

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString('en-ZA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	if (loading) {
		return (
			<ProtectedRoute allowedRoles={['vendor']}>
				<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
					<VendorHeader />
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					</div>
				</div>
			</ProtectedRoute>
		)
	}

	if (error && !contract) {
		return (
			<ProtectedRoute allowedRoles={['vendor']}>
				<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
					<VendorHeader />
					<div className="text-center py-8">
						<h3 className="text-lg font-medium text-gray-900">Error</h3>
						<p className="text-gray-500">{error}</p>
						<button onClick={() => router.back()} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Go Back</button>
					</div>
				</div>
			</ProtectedRoute>
		)
	}

	return (
		<ProtectedRoute allowedRoles={['vendor']}>
			<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
				<VendorHeader />
				<main className="px-4 py-4 space-y-4">
					<div className="flex items-center gap-3 mb-4">
													<button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="h-5 w-5 text-gray-700" /></button>
						<div className="flex-1">
							<h1 className="text-xl font-bold text-gray-900">Messages</h1>
							<p className="text-sm text-gray-600">{contract?.title}</p>
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Contract Details</h3>
						<div className="space-y-2 text-sm">
							<div className="flex items-center gap-2"><Building className="h-4 w-4 text-gray-500" /><span className="text-gray-700">Property:</span><span className="font-medium text-gray-900">{contract?.property?.title}</span></div>
							<div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-500" /><span className="text-gray-700">Owner:</span><span className="font-medium text-gray-900">{contract?.owner?.full_name}</span></div>
							<div className="flex items-center gap-2"><FileText className="h-4 w-4 text-gray-500" /><span className="text-gray-700">Status:</span><span className="font-medium text-gray-900">{contract?.status.replace('_', ' ')}</span></div>
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Message History</h3>
						{messages.length === 0 ? (
							<div className="text-center py-8">
								<MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
								<p className="mt-2 text-sm text-gray-500">No messages yet</p>
								<p className="text-xs text-gray-400">Start the conversation with the property owner</p>
							</div>
						) : (
							<div className="space-y-3 max-h-96 overflow-y-auto">
								{messages.map((message) => (
									<div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
										<div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${message.sender_id === user?.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
											<div className="flex items-center gap-2 mb-1">
												<span className="font-medium text-xs">{message.sender_id === user?.id ? 'You' : message.sender_name}</span>
												<span className="text-xs opacity-70">{formatDate(message.created_at)}</span>
											</div>
											<p className="whitespace-pre-wrap">{message.content}</p>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<h3 className="font-semibold text-gray-900 mb-3">Send Message</h3>
						<div className="space-y-3">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
								<select value={messageType} onChange={(e) => setMessageType(e.target.value as 'general' | 'question' | 'update' | 'issue' | 'other')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
									<option value="general">General</option>
									<option value="question">Question</option>
									<option value="update">Update</option>
									<option value="issue">Issue</option>
									<option value="other">Other</option>
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
								<textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message here..." rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
							</div>
							{error && (<div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-600">{error}</p></div>)}
							<button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
								{sending ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Sending...</>) : (<><Send className="h-4 w-4" />Send Message</>)}
							</button>
						</div>
					</div>
				</main>
				<BottomNavbar userRole="vendor" />
			</div>
		</ProtectedRoute>
	)
}

export default function VendorContractMessagePage() {
  return (
    <Suspense fallback={<div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden"><div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></div>}>
      <VendorContractMessagePageInner />
    </Suspense>
  )
}


