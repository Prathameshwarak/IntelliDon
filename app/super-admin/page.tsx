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
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from '@/lib/theme'

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

  // Theme State (Syncs globally across all pages)
  const { theme, isDark, toggleTheme } = useTheme()

  // ── Auth & Query Params ──────────────────────────────────────
  useEffect(() => {
    async function checkAccess() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/login'); return }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const meData = await res.json()
        if (!res.ok || meData.error || !meData.user || meData.profile?.role !== 'super_admin') {
          router.push('/')
          return
        }

        setSuperAdminName(meData.profile.full_name || 'Super Admin')
        setAuthorized(true)
      } catch (e) {
        router.push('/')
      }
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
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
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
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
          <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono">Verifying authorization...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 text-[#1A1208] dark:text-white flex flex-col md:flex-row transition-colors duration-300">

      {/* Toast Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all duration-300
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Unified Side Navigation Panel */}
      <aside className="w-full md:w-64 bg-[#F5EDE2] dark:bg-gray-900 border-b md:border-b-0 md:border-r border-[#1A1208]/10 dark:border-gray-800 flex flex-col justify-between shrink-0 md:sticky md:top-0 md:h-screen transition-colors duration-300">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-[#1A1208]/10 dark:border-gray-800 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E8650A] to-[#C49A3C] flex items-center justify-center shadow-md shadow-[#E8650A]/20">
              <span className="text-white font-black text-base italic">i</span>
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-[#1A1208] dark:text-white">
                Intelli<span className="text-[#E8650A]">don</span>
              </h1>
              <p className="text-[9px] text-[#C49A3C] dark:text-orange-400 font-mono tracking-wider uppercase leading-none mt-0.5 font-bold">Control Center</p>
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer text-left
                    ${isActive
                      ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md shadow-[#E8650A]/20'
                      : 'text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-800/50'}`}
                >
                  <span className="text-sm leading-none">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Admin Identity */}
        <div className="p-4 border-t border-[#1A1208]/10 dark:border-gray-800 bg-[#F5EDE2] dark:bg-gray-950/60 flex items-center justify-between gap-3 flex-wrap md:flex-nowrap transition-colors duration-300">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#1A1208] dark:text-white truncate">{superAdminName}</p>
            <p className="text-[9px] text-[#7a6a55] dark:text-gray-400 font-mono uppercase tracking-wider mt-0.5">Super Admin</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="text-[10px] font-bold py-1.5 px-2.5 border border-red-500/20 dark:border-gray-800 hover:border-red-500/40 dark:hover:border-gray-700 bg-red-500/10 dark:bg-gray-900 hover:bg-red-500/20 dark:hover:bg-gray-800 rounded-lg text-red-600 dark:text-gray-300 hover:text-red-700 dark:hover:text-white transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
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
        <footer className="w-full max-w-4xl mx-auto border-t border-[#1A1208]/10 dark:border-gray-900 pt-6 mt-12 flex justify-between items-center text-[10px] text-[#7a6a55] dark:text-gray-500">
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
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
          <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono">Loading dashboard...</p>
        </div>
      </div>
    }>
      <SuperAdminDashboardContent />
    </Suspense>
  )
}

