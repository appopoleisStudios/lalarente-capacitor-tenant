'use client'

import { useEffect, useState, useCallback } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import BottomNavbar from '@/components/BottomNavbar'
import { 
  DollarSign, 
  TrendingUp, 
  Download,
  AlertTriangle,
  Building,
  BarChart3,
  FileText,
  CheckCircle,
  ArrowLeft
} from 'lucide-react'

interface IncomeMetrics {
  totalProperties: number
  occupiedProperties: number
  vacantProperties: number
  occupancyRate: number
  monthlyGrossIncome: number
  monthlyCommission: number
  monthlyNetIncome: number
  totalArrears: number
  propertiesWithArrears: number
  averageDaysOverdue: number
}

interface Payment {
  id: string
  amount: number
  commission_amount: number | null
  net_amount: number | null
  due_date: string
  paid_date: string | null
  status: string
  property: {
    title: string
    address: string
  } | null
  tenant: {
    full_name: string
    email: string
  } | null
  days_late: number | null
  late_fee: number | null
}

interface MonthlyData {
  month: string
  grossIncome: number
  commission: number
  netIncome: number
  paymentCount: number
  occupancyRate: number
}

export default function OwnerIncomePage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [metrics, setMetrics] = useState<IncomeMetrics | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'reports' | 'arrears'>('overview')

  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all')

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true)
      if (!user) return
      // Get owner's properties
      const { data: properties } = await supabase
        .from('properties')
        .select('id, title, rent_amount')
        .eq('owner_id', user.id)

      const propertyIds = properties?.map(p => p.id) || []
      const totalProperties = propertyIds.length

      if (totalProperties === 0) {
        setMetrics({
          totalProperties: 0,
          occupiedProperties: 0,
          vacantProperties: 0,
          occupancyRate: 0,
          monthlyGrossIncome: 0,
          monthlyCommission: 0,
          monthlyNetIncome: 0,
          totalArrears: 0,
          propertiesWithArrears: 0,
          averageDaysOverdue: 0
        })
        return
      }

      // Get current month's start and end dates
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      // Load active leases for occupancy calculation
      const { data: leases } = await supabase
        .from('leases')
        .select('property_id, lease_start, lease_end')
        .in('property_id', propertyIds)
        .lte('lease_start', endOfMonth.toISOString())
        .gte('lease_end', startOfMonth.toISOString())

      const occupiedProperties = new Set(leases?.map(l => l.property_id)).size
      const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0

      // Load payments for current month
      const { data: currentMonthPayments } = await supabase
        .from('payments')
        .select(`
          *,
          property:properties(id, title, address),
          tenant:profiles(id, full_name, email)
        `)
        .in('property_id', propertyIds)
        .gte('due_date', startOfMonth.toISOString())
        .lte('due_date', endOfMonth.toISOString())

      // Calculate monthly income
      const paidPayments = currentMonthPayments?.filter(p => p.status === 'paid') || []
      const monthlyGrossIncome = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      const monthlyCommission = paidPayments.reduce((sum, p) => sum + (p.commission_amount || 0), 0)
      const monthlyNetIncome = monthlyGrossIncome - monthlyCommission

      // Calculate arrears
      const overduePayments = (currentMonthPayments || []).filter((p: any) => {
        if ((p.status || 'pending') !== 'pending') return false
        const dueDate = new Date(p.due_date as string)
        const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        return daysLate > 7 // Grace period of 7 days
      }) || []

      const totalArrears = overduePayments.reduce((sum: number, p: any) => {
        const dueDate = new Date(p.due_date as string)
        const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        let lateFee = 0
        if (daysLate > 7) {
          if (daysLate <= 14) lateFee = 500
          else if (daysLate <= 30) lateFee = 1000
          else lateFee = 2000
        }
        return sum + (Number(p.amount) || 0) + lateFee
      }, 0)

      const propertiesWithArrears = new Set(overduePayments.map((p: any) => p.property_id)).size
      const averageDaysOverdue = overduePayments.length > 0 ? 
        overduePayments.reduce((sum: number, p: any) => {
          const dueDate = new Date(p.due_date as string)
          const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          return sum + daysLate
        }, 0) / overduePayments.length : 0

      setMetrics({
        totalProperties,
        occupiedProperties,
        vacantProperties: totalProperties - occupiedProperties,
        occupancyRate: Math.round(occupancyRate),
        monthlyGrossIncome,
        monthlyCommission,
        monthlyNetIncome,
        totalArrears,
        propertiesWithArrears,
        averageDaysOverdue: Math.round(averageDaysOverdue)
      })

    } catch (error) {
      console.error('Error loading metrics:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadPayments = useCallback(async () => {
    try {
      if (!user) return
      // Get owner's properties
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', user.id)

      const propertyIds = properties?.map(p => p.id) || []
      if (propertyIds.length === 0) return

      // Load payments with related data
      const { data: paymentsData } = await supabase
        .from('payments')
        .select(`
          *,
          property:properties(id, title, address),
          tenant:profiles(id, full_name, email)
        `)
        .in('property_id', propertyIds)
        .order('due_date', { ascending: false })

      // Calculate days late and late fees
      const processedPayments: Payment[] = (paymentsData || []).map((payment: any) => {
        const dueDate = new Date(payment.due_date as string)
        const today = new Date()
        const status = (payment.status || 'pending') as string
        const daysLate = status === 'pending' ? 
          Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0
        
        let lateFee = 0
        if (daysLate > 7) {
          if (daysLate <= 14) lateFee = 500
          else if (daysLate <= 30) lateFee = 1000
          else lateFee = 2000
        }

        return {
          id: payment.id,
          amount: Number(payment.amount) || 0,
          commission_amount: payment.commission_amount ?? null,
          net_amount: payment.net_amount ?? null,
          due_date: payment.due_date,
          paid_date: payment.paid_date || null,
          status,
          property: payment.property || null,
          tenant: payment.tenant || null,
          days_late: daysLate,
          late_fee: lateFee
        } as Payment
      })

      setPayments(processedPayments)

    } catch (error) {
      console.error('Error loading payments:', error)
    }
  }, [user])

  const loadMonthlyData = useCallback(async () => {
    try {
      if (!user) return
      // Get owner's properties
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', user.id)

      const propertyIds = properties?.map(p => p.id) || []
      if (propertyIds.length === 0) return

      // Load payments for the last 12 months
      const now = new Date()
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      
      const { data: paymentsData } = await supabase
        .from('payments')
        .select(`
          *,
          property:properties(id, title, address)
        `)
        .in('property_id', propertyIds)
        .gte('due_date', twelveMonthsAgo.toISOString())
        .eq('status', 'paid')

      // Group by month
      const monthlyMap = new Map<string, MonthlyData>()
      
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthKey = date.toISOString().slice(0, 7) // YYYY-MM format
        monthlyMap.set(monthKey, {
          month: date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short' }),
          grossIncome: 0,
          commission: 0,
          netIncome: 0,
          paymentCount: 0,
          occupancyRate: 0
        })
      }

      // Process payments
      paymentsData?.forEach((payment: any) => {
        const paymentDate = new Date(payment.due_date)
        const monthKey = paymentDate.toISOString().slice(0, 7)
        const monthData = monthlyMap.get(monthKey)
        
        if (monthData) {
          monthData.grossIncome += Number(payment.amount) || 0
          monthData.commission += payment.commission_amount || 0
          monthData.netIncome += (Number(payment.amount) || 0) - (payment.commission_amount || 0)
          monthData.paymentCount += 1
        }
      })

      setMonthlyData(Array.from(monthlyMap.values()).reverse())

    } catch (error) {
      console.error('Error loading monthly data:', error)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    loadMetrics()
    loadPayments()
    loadMonthlyData()
  }, [loadMetrics, loadPayments, loadMonthlyData, user])

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

  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true
    if (filter === 'overdue') return payment.days_late && payment.days_late > 7
    return payment.status === filter
  })

  const handleDownloadReport = (type: 'monthly' | 'ytd' | 'arrears') => {
    console.log('Downloading report:', type)
    // Generate and download report
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Income & Reports</h1>
              <p className="text-sm text-blue-700">Owner Earnings</p>
            </div>
          </div>
        </div>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="mobile-app w-[100vw] max-w-[100vw] mx-0 bg-white min-h-screen pb-20 overflow-x-hidden">
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Income & Reports</h1>
              <p className="text-sm text-blue-700">Owner Earnings</p>
            </div>
          </div>
        </div>
        
        <main className="px-4 py-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Income & Reports</h1>
              <p className="text-sm text-gray-600">Track your rental income and performance</p>
            </div>
            <button
              onClick={() => handleDownloadReport('monthly')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'payments', label: 'Payments', icon: DollarSign },
              { key: 'reports', label: 'Reports', icon: FileText },
              { key: 'arrears', label: 'Arrears', icon: AlertTriangle }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'overview' | 'payments' | 'reports' | 'arrears')}
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
            {activeTab === 'overview' && metrics && (
              <>
                {/* Income Summary */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Monthly Income Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-green-100">Gross Income</span>
                      <span className="font-bold">{formatCurrency(metrics.monthlyGrossIncome)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-100">Commission</span>
                      <span className="font-medium">-{formatCurrency(metrics.monthlyCommission)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-green-500 pt-2">
                      <span className="text-green-100 font-semibold">Net Income</span>
                      <span className="font-bold text-lg">{formatCurrency(metrics.monthlyNetIncome)}</span>
                    </div>
                  </div>
                </div>

                {/* Property Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">Properties</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{metrics.totalProperties}</p>
                    <p className="text-xs text-gray-500">
                      {metrics.occupiedProperties} occupied, {metrics.vacantProperties} vacant
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-gray-900">Occupancy</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{metrics.occupancyRate}%</p>
                    <p className="text-xs text-gray-500">Current month</p>
                  </div>
                </div>

                {/* Arrears Alert */}
                {metrics.totalArrears > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-900">Arrears Alert</span>
                    </div>
                    <p className="text-sm text-red-700 mb-2">
                      {metrics.propertiesWithArrears} properties have overdue payments
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-red-600">Total Arrears:</span>
                      <span className="font-bold text-red-900">{formatCurrency(metrics.totalArrears)}</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('arrears')}
                      className="w-full mt-3 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                      View Details
                    </button>
                  </div>
                )}

                {/* Monthly Trend */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Monthly Income Trend</h3>
                  <div className="space-y-2">
                    {monthlyData.slice(-6).map((month, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{month.month}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(month.netIncome)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-4">
                {/* Filter */}
                <div className="flex gap-2">
                  {(['all', 'paid', 'pending', 'overdue'] as const).map((filterOption) => (
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

                {/* Payments List */}
                <div className="space-y-3">
                  {filteredPayments.map((payment) => (
                    <div key={payment.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {payment.property?.title}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            Due: {formatDate(payment.due_date)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Tenant:</span>
                          <p className="font-medium">{payment.tenant?.full_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Commission:</span>
                          <p className="font-medium">{formatCurrency(payment.commission_amount || 0)}</p>
                        </div>
                        {payment.late_fee && payment.late_fee > 0 && (
                          <div>
                            <span className="text-gray-500">Late Fee:</span>
                            <p className="font-medium text-red-600">{formatCurrency(payment.late_fee)}</p>
                          </div>
                        )}
                        {payment.paid_date && (
                          <div>
                            <span className="text-gray-500">Paid Date:</span>
                            <p className="font-medium">{formatDate(payment.paid_date)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-4">
                {/* Report Options */}
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => handleDownloadReport('monthly')}
                    className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Monthly Report</p>
                        <p className="text-sm text-gray-500">Current month&apos;s income and occupancy</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDownloadReport('ytd')}
                    className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Year-to-Date Report</p>
                        <p className="text-sm text-gray-500">Annual performance and trends</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDownloadReport('arrears')}
                    className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Arrears Report</p>
                        <p className="text-sm text-gray-500">Overdue payments and late fees</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Monthly Breakdown */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Monthly Breakdown</h3>
                  <div className="space-y-3">
                    {monthlyData.map((month, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{month.month}</p>
                          <p className="text-sm text-gray-500">{month.paymentCount} payments</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(month.netIncome)}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(month.commission)} commission
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'arrears' && (
              <div className="space-y-4">
                {/* Arrears Summary */}
                {metrics && metrics.totalArrears > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-3">Arrears Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-red-700">Total Arrears</span>
                        <span className="font-bold text-red-900">{formatCurrency(metrics.totalArrears)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-red-700">Properties Affected</span>
                        <span className="font-medium text-red-900">{metrics.propertiesWithArrears}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-red-700">Average Days Overdue</span>
                        <span className="font-medium text-red-900">{metrics.averageDaysOverdue} days</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <p className="font-medium text-green-900">No Arrears</p>
                    <p className="text-sm text-green-700">All payments are up to date</p>
                  </div>
                )}

                {/* Overdue Payments */}
                <div className="space-y-3">
                  {payments
                    .filter(p => p.days_late && p.days_late > 7)
                    .map((payment) => (
                      <div key={payment.id} className="bg-white border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {payment.property?.title}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                              {payment.days_late} days late
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Tenant:</span>
                            <p className="font-medium">{payment.tenant?.full_name || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Late Fee:</span>
                            <p className="font-medium text-red-600">{formatCurrency(payment.late_fee || 0)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Due Date:</span>
                            <p className="font-medium">{formatDate(payment.due_date)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Total Due:</span>
                            <p className="font-medium text-red-600">
                              {formatCurrency((payment.amount || 0) + (payment.late_fee || 0))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}
