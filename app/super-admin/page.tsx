'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import MandalsTab from '@/components/super-admin/MandalsTab'
import AllOrganizationsTab from '@/components/super-admin/AllOrganizationsTab'
import EventsTab from '@/components/super-admin/EventsTab'
import SubscriptionsTab from '@/components/super-admin/SubscriptionsTab'
import PlansTab from '@/components/super-admin/PlansTab'

type PlanRow = {
  id: string
  name: string
  price: number
  price_label: string
  features: string[]
}

const TABS = [
  { id: 'mandals', label: 'Mandals & KYC', icon: '🏢' },
  { id: 'organizations', label: 'All Organizations', icon: '📋' },
  { id: 'events', label: 'Manage Events', icon: '📅' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '💳' },
  { id: 'plans', label: 'Manage Plans', icon: '🛠️' }
] as const

type TabId = typeof TABS[number]['id']

function SuperAdminDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authorized, setAuthorized] = useState(false)
  const [superAdminName, setSuperAdminName] = useState('Super Admin')
  const [activeTab, setActiveTab] = useState<TabId>('mandals')
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // ── Auth & Query Params ──────────────────────────────────────
  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (!userRow || userRow.role !== 'super_admin') {
        router.push('/')
        return
      }

      setSuperAdminName(userRow.full_name || 'Super Admin')
      setAuthorized(true)
    }
    checkAccess()
  }, [router])

  // Sync active tab with URL query param '?tab=...' if available
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabId | null
    if (tabParam && TABS.some(t => t.id === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Fetch plans globally since multiple tabs need the plan list
  useEffect(() => {
    if (authorized) {
      fetchPlans()
    }
  }, [authorized])

  async function fetchPlans() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/plans', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (!data.error) {
        setPlans(data.plans || [])
      } else {
        showToast(data.error, 'error')
      }
    } catch (err) {
      showToast('Could not load plans list', 'error')
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function handleTabChange(tabId: TabId) {
    setActiveTab(tabId)
    // Update URL to preserve route state
    router.push(`/super-admin?tab=${tabId}`)
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
          <p className="text-gray-400 text-xs font-mono">Verifying authorization...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row">
      
      {/* Toast Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all duration-300
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Unified Side Navigation Panel */}
      <aside className="w-full md:w-64 bg-gray-900 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col justify-between shrink-0 md:sticky md:top-0 md:h-screen">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-white font-black text-base italic">i</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide">Intellidon</h1>
              <p className="text-[9px] text-orange-400 font-mono tracking-wider uppercase leading-none mt-0.5">Control Center</p>
            </div>
          </div>

          {/* Navigation Items list */}
          <nav className="p-4 space-y-1">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer text-left
                    ${isActive 
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
                >
                  <span className="text-sm leading-none">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Admin Identity */}
        <div className="p-4 border-t border-gray-800 bg-gray-950/40 flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-250 truncate">{superAdminName}</p>
            <p className="text-[9px] text-gray-550 font-mono uppercase tracking-wider mt-0.5">Super Admin</p>
          </div>
          <button 
            onClick={handleSignOut}
            className="text-[10px] font-bold py-1.5 px-3 border border-gray-850 hover:border-gray-700 bg-gray-900 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Content Window */}
      <main className="flex-1 min-w-0 p-6 md:p-10 flex flex-col justify-between">
        <div className="w-full max-w-4xl mx-auto">
          {/* Render Active Component Tab */}
          {activeTab === 'mandals' && (
            <MandalsTab showToast={showToast} />
          )}

          {activeTab === 'organizations' && (
            <AllOrganizationsTab showToast={showToast} />
          )}

          {activeTab === 'events' && (
            <EventsTab showToast={showToast} />
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionsTab plans={plans} showToast={showToast} />
          )}

          {activeTab === 'plans' && (
            <PlansTab plans={plans} fetchPlans={fetchPlans} showToast={showToast} />
          )}
        </div>

        {/* Global Footer brand info */}
        <footer className="w-full max-w-4xl mx-auto border-t border-gray-900 pt-6 mt-12 flex justify-between items-center text-[10px] text-gray-500">
          <span>Intellidon Super Admin Console</span>
          <span>Security Audited Session</span>
        </footer>
      </main>
    </div>
  )
}

export default function SuperAdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
          <p className="text-gray-400 text-xs font-mono">Loading dashboard...</p>
        </div>
      </div>
    }>
      <SuperAdminDashboardContent />
    </Suspense>
  )
}
