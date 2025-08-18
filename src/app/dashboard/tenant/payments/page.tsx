'use client'

import { useEffect, useState, useCallback } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import TenantHeader from '@/components/Dashboard/Tenant/TenantHeader'
import BottomNavbar from '@/components/BottomNavbar'
import { 
  CreditCard, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Plus,
  Settings,
  History
} from 'lucide-react'

interface Payment {
  id: string
  amount: number
  due_date: string
  paid_date: string | null
  status: 'pending' | 'paid' | 'overdue' | 'failed'
  payment_method: string | null
  payment_reference: string | null
  late_fee: number | null
  days_late: number | null
  property: {
    title: string
    address: string
  } | null
  lease: {
    rent_amount: number
    lease_start: string
    lease_end: string
  } | null
}

interface PaymentMethod {
  id: string
  type: 'card' | 'bank_transfer' | 'eft'
  last_four?: string
  bank_name?: string
  account_type?: string
  is_default: boolean
  expiry_date?: string
}

export default function TenantPaymentsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'methods'>('overview')
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all')
  const [totalArrears, setTotalArrears] = useState(0)
  const [nextPayment, setNextPayment] = useState<Payment | null>(null)

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load payments with related data
      if (!user) return
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          property:properties(id, title, address),
          lease:leases(id, rent_amount, lease_start, lease_end)
        `)
        .eq('tenant_id', user.id)
        .order('due_date', { ascending: false })

      if (paymentsError) throw paymentsError

      // Calculate arrears and days late
      const processedPayments: Payment[] = (paymentsData || []).map((payment: any) => {
        const dueDate = new Date(payment.due_date)
        const today = new Date()
        const status = (payment.status || 'pending') as Payment['status']
        const daysLate = status === 'pending' ? 
          Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0
        
        let lateFee = 0
        if (daysLate > 7) { // Grace period of 7 days
          if (daysLate <= 14) lateFee = 500
          else if (daysLate <= 30) lateFee = 1000
          else lateFee = 2000
        }

        return {
          id: payment.id,
          amount: Number(payment.amount) || 0,
          due_date: payment.due_date,
          paid_date: payment.paid_date || null,
          status,
          payment_method: payment.payment_method || null,
          payment_reference: payment.payment_reference || null,
          property: payment.property || null,
          lease: payment.lease || null,
          days_late: daysLate,
          late_fee: lateFee
        }
      })

      setPayments(processedPayments)

      // Calculate total arrears
      const arrears = processedPayments
        .filter(p => p.status === 'pending' && (p.days_late ?? 0) > 7)
        .reduce((sum, p) => sum + p.amount + (p.late_fee || 0), 0)
      setTotalArrears(arrears)

      // Find next payment
      const next = processedPayments
        .filter(p => p.status === 'pending')
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
      setNextPayment(next || null)

    } catch (error) {
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadPaymentMethods = useCallback(async () => {
    try {
      // Load payment methods (this would be from a payment_methods table)
      // For now, using mock data
      const mockMethods: PaymentMethod[] = [
        {
          id: '1',
          type: 'card',
          last_four: '1234',
          is_default: true,
          expiry_date: '12/25'
        },
        {
          id: '2',
          type: 'bank_transfer',
          bank_name: 'Standard Bank',
          account_type: 'Savings',
          is_default: false
        }
      ]
      setPaymentMethods(mockMethods)
    } catch (error) {
      console.error('Error loading payment methods:', error)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadPayments()
    loadPaymentMethods()
  }, [loadPayments, loadPaymentMethods, user])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'failed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'overdue': return <AlertTriangle className="h-4 w-4" />
      case 'failed': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true
    return payment.status === filter
  })

  const handlePayNow = (payment: Payment) => {
    // Navigate to payment processing page
    router.push(`/dashboard/tenant/payments/${payment.id}/pay`)
  }

  const handleDownloadReceipt = (payment: Payment) => {
    // Generate and download receipt
    console.log('Downloading receipt for payment:', payment.id)
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['tenant']}>
        <div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
          <TenantHeader tenantName={user?.email || 'Tenant'} propertyName="Current Property" />
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['tenant']}>
      <div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
        <TenantHeader tenantName={user?.email || 'Tenant'} propertyName="Current Property" />
        
        <main className="px-4 py-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Payments</h1>
              <p className="text-sm text-gray-600">Manage your rent payments</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/tenant/payments/methods')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'overview', label: 'Overview', icon: DollarSign },
              { key: 'history', label: 'History', icon: History },
              { key: 'methods', label: 'Methods', icon: CreditCard }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'overview' | 'history' | 'methods')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === 'overview' && (
              <>
                {/* Payment Summary */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Payment Summary</h3>
                  <div className="space-y-2">
                    {nextPayment && (
                      <div className="flex justify-between items-center">
                        <span className="text-blue-100">Next Payment Due</span>
                        <span className="font-bold">{formatCurrency(nextPayment.amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100">Due Date</span>
                      <span className="font-medium">
                        {nextPayment ? formatDate(nextPayment.due_date) : 'No payments due'}
                      </span>
                    </div>
                    {totalArrears > 0 && (
                      <div className="flex justify-between items-center text-red-200">
                        <span>Total Arrears</span>
                        <span className="font-bold">{formatCurrency(totalArrears)}</span>
                      </div>
                    )}
                  </div>
                  {nextPayment && (
                    <button
                      onClick={() => handlePayNow(nextPayment)}
                      className="w-full mt-4 bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
                    >
                      Pay Now
                    </button>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => router.push('/dashboard/tenant/payments/setup-auto')}
                    className="bg-white border border-gray-200 rounded-lg p-4 text-center hover:bg-gray-50"
                  >
                    <CreditCard className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <div className="text-sm font-medium text-gray-900">Setup Auto-Pay</div>
                    <div className="text-xs text-gray-500">Never miss a payment</div>
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/tenant/payments/methods')}
                    className="bg-white border border-gray-200 rounded-lg p-4 text-center hover:bg-gray-50"
                  >
                    <Plus className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <div className="text-sm font-medium text-gray-900">Add Payment Method</div>
                    <div className="text-xs text-gray-500">Credit card or bank</div>
                  </button>
                </div>

                {/* Recent Payments */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Recent Payments</h3>
                  <div className="space-y-3">
                    {payments.slice(0, 3).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${getStatusColor(payment.status)}`}>
                            {getStatusIcon(payment.status)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Due: {formatDate(payment.due_date)}
                            </p>
                            {payment.days_late && payment.days_late > 0 && (
                              <p className="text-xs text-red-500">
                                {payment.days_late} days late
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.status === 'paid' && (
                            <button
                              onClick={() => handleDownloadReceipt(payment)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Download className="h-4 w-4 text-gray-400" />
                            </button>
                          )}
                          {payment.status === 'pending' && (
                            <button
                              onClick={() => handlePayNow(payment)}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {payments.length > 3 && (
                    <button
                      onClick={() => setActiveTab('history')}
                      className="w-full mt-3 text-sm text-blue-600 hover:text-blue-700"
                    >
                      View All Payments
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Filter */}
                <div className="flex gap-2">
                  {(['all', 'pending', 'paid', 'overdue'] as const).map((filterOption) => (
                    <button
                      key={filterOption}
                      onClick={() => setFilter(filterOption)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        filter === filterOption
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Payment History */}
                <div className="space-y-3">
                  {filteredPayments.map((payment) => (
                    <div key={payment.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${getStatusColor(payment.status)}`}>
                            {getStatusIcon(payment.status)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {payment.property?.title}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due: {formatDate(payment.due_date)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Payment Method:</span>
                          <p className="font-medium">
                            {payment.payment_method || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Reference:</span>
                          <p className="font-medium">
                            {payment.payment_reference || 'N/A'}
                          </p>
                        </div>
                        {payment.late_fee && payment.late_fee > 0 && (
                          <div>
                            <span className="text-gray-500">Late Fee:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency(payment.late_fee)}
                            </p>
                          </div>
                        )}
                        {payment.paid_date && (
                          <div>
                            <span className="text-gray-500">Paid Date:</span>
                            <p className="font-medium">
                              {formatDate(payment.paid_date)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        {payment.status === 'paid' && (
                          <button
                            onClick={() => handleDownloadReceipt(payment)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                          >
                            <Download className="h-4 w-4" />
                            Download Receipt
                          </button>
                        )}
                        {payment.status === 'pending' && (
                          <button
                            onClick={() => handlePayNow(payment)}
                            className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                          >
                            <CreditCard className="h-4 w-4" />
                            Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'methods' && (
              <div className="space-y-4">
                {/* Payment Methods */}
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <CreditCard className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {method.type === 'card' ? `Card ending in ${method.last_four}` : method.bank_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {method.type === 'card' ? 'Credit Card' : 'Bank Transfer'}
                            </p>
                            {method.expiry_date && (
                              <p className="text-xs text-gray-400">
                                Expires: {method.expiry_date}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {method.is_default && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Default
                            </span>
                          )}
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Settings className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New Method */}
                <button
                  onClick={() => router.push('/dashboard/tenant/payments/methods/add')}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 hover:bg-gray-50"
                >
                  <Plus className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">Add Payment Method</p>
                  <p className="text-xs text-gray-500">Credit card, debit card, or bank account</p>
                </button>
              </div>
            )}
          </div>
        </main>

        <BottomNavbar userRole="tenant" />
      </div>
    </ProtectedRoute>
  )
}
