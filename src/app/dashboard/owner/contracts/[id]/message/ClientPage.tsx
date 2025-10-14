'use client'

import React, { useEffect, useState, useRef } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Send, AlertCircle, User, MessageSquare } from 'lucide-react'
import BottomNavbar from '@/components/BottomNavbar'

interface Contract {
  id: string
  title: string
  status: string
  contract_type: string
  property: {
    id: string
    title: string
    address: string
  } | null
  vendor: {
    id: string
    full_name: string
    email: string | null
  } | null
  tenant: {
    id: string
    full_name: string
    email: string | null
  } | null
}

interface Message {
  id: string
  property_id: string
  sender_id: string
  content: string
  created_at: string
  sender: { id: string; full_name: string } | null
}

export default function ClientPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const contractId = (params as any)?.id as string | undefined
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!contractId || !user?.id) return
    loadContract()
  }, [contractId, user?.id])

  useEffect(() => {
    if (contract?.property?.id) {
      loadMessages()
    }
  }, [contract?.property?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadContract = async () => {
    try {
      setLoading(true)
      
      const { data: serviceContract } = await supabase
        .from('service_contracts')
        .select(`
          *,
          property:properties(id, title, address),
          vendor:profiles!service_contracts_vendor_id_fkey(id, full_name, email),
          tenant:profiles!service_contracts_tenant_id_fkey(id, full_name, email)
        `)
        .eq('id', contractId as string)
        .eq('owner_id', user!.id as string)
        .single()

      if (serviceContract) {
        setContract({
          ...(serviceContract as any),
          contract_type: (serviceContract as any).contract_type || 'maintenance'
        })
        return
      }

      const { data: tenancyContract, error: tenancyError } = await supabase
        .from('tenancy_contracts')
        .select(`
          *,
          property:properties(id, title, address),
          tenant:profiles!tenancy_contracts_tenant_id_fkey(id, full_name, email)
        `)
        .eq('id', contractId as string)
        .eq('owner_id', user!.id as string)
        .single()

      if (tenancyContract) {
        setContract({
          ...tenancyContract,
          contract_type: 'tenancy',
          vendor: null
        })
        return
      }

      if (tenancyError) {
        setMessage('Contract not found or access denied')
      }
    } catch (error) {
      console.error('Error loading contract:', error)
      setMessage('Error loading contract')
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!contract?.property?.id) return

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, full_name)
        `)
        .eq('property_id', contract.property.id)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError
      const formatted: Message[] = (messagesData || []).map((m: any) => ({
        id: String(m.id),
        property_id: String(m.property_id || ''),
        sender_id: String(m.sender_id || ''),
        content: String(m.content || ''),
        created_at: String(m.created_at || new Date().toISOString()),
        sender: m.sender ? { id: String(m.sender.id), full_name: String(m.sender.full_name || 'Unknown') } : null,
      }))
      setMessages(formatted)
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessage('Error loading messages')
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract?.property?.id || !user || !newMessage.trim()) return

    try {
      setSending(true)

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          property_id: contract.property.id,
          sender_id: user.id,
          content: newMessage.trim()
        })

      if (messageError) throw messageError

      if (contract.vendor?.id) {
        await supabase.rpc('create_contract_notification', {
          p_contract_id: contract.id,
          p_recipient_id: contract.vendor.id,
          p_notification_type: 'message',
          p_title: 'New Message from Owner',
          p_message: `You have received a new message from the owner regarding contract "${contract.title}".`
        })
      }

      await supabase.rpc('log_contract_event', {
        p_contract_id: contract.id,
        p_event: 'message_sent',
        p_actor_id: user.id,
        p_new_values: { message: newMessage.trim() }
      })

      setNewMessage('')
      loadMessages()
    } catch (error) {
      console.error('Error sending message:', error)
      setMessage('Error sending message')
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isOwnMessage = (message: Message) => {
    return message.sender_id === user?.id
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="min-h-screen bg-gray-50">
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!contract) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-4 text-lg font-medium text-gray-900">Contract Not Found</h2>
              <p className="mt-2 text-gray-600">{message}</p>
              <button
                onClick={() => router.back()}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!contract.vendor) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
              <h2 className="mt-4 text-lg font-medium text-gray-900">No Vendor Assigned</h2>
              <p className="mt-2 text-gray-600">This contract doesn't have a vendor assigned for messaging.</p>
              <button
                onClick={() => router.back()}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-gray-900">Message Vendor</h1>
                <p className="text-sm text-gray-600">{contract.title}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{contract.vendor.full_name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-4 flex-1 flex flex-col">
          {message && (
            <div className={`mb-4 p-3 rounded-lg border ${
              message.includes('Error') 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              {message}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Property</p>
                <p className="font-medium">{contract.property?.title || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600">Contract Type</p>
                <p className="font-medium capitalize">{contract.contract_type}</p>
              </div>
              <div>
                <p className="text-gray-600">Status</p>
                <p className="font-medium capitalize">{contract.status.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
              <p className="text-sm text-gray-600">Chat with {contract.vendor.full_name}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Start the conversation by sending a message.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${isOwnMessage(msg) ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                        isOwnMessage(msg)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-xs">{isOwnMessage(msg) ? 'You' : (msg.sender?.full_name || 'Unknown')}</span>
                        <span className="text-xs opacity-70">{formatDate(msg.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </div>
        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}


