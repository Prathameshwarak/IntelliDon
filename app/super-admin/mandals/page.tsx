'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Shape of each mandal returned from the API
type MandalUser = {
  id: string
  full_name: string
  phone: string
  role: string
}

type Subscription = {
  plan: string
  status: string
  ends_at: string
}

type Mandal = {
  id: string
  name: string
  slug: string
  address: string
  city: string
  phone: string
  status: string
  created_at: string
  users: MandalUser[]
  subscriptions?: Subscription[]
}

type StatusTab = 'pending' | 'active' | 'suspended'

export default function SuperAdminMandalsPage() {
  const router = useRouter()
  const [mandals, setMandals] = useState<Mandal[]>([])
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // stores mandalId being acted on
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [superAdminName, setSuperAdminName] = useState<string>('')
  const [authorized, setAuthorized] = useState<boolean>(false)

  // Guard: only super_admin can access this page
  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (!userRow || userRow.role !== 'super_admin') {
        router.push('/') // kick out non-super-admins
        return
      }

      setSuperAdminName(userRow.full_name || 'Super Admin')
      setAuthorized(true)
    }
    checkAccess()
  }, [router])

  // Fetch mandals whenever tab changes
  useEffect(() => {
    if (authorized) {
      fetchMandals(activeTab)
    }
  }, [activeTab, authorized])

  async function fetchMandals(status: StatusTab) {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/mandals?status=${status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMandals(data.mandals || [])
    } catch (err) {
      showToast('Failed to load mandals', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(mandalId: string, action: 'approve' | 'reject' | 'suspend') {
    setActionLoading(mandalId)
    try {
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandalId, action, plan: 'trial' })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(data.message, 'success')
      // Remove the mandal from current list (it moved to a different status)
      setMandals(prev => prev.filter(m => m.id !== mandalId))
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const tabs: StatusTab[] = ['pending', 'active', 'suspended']

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 animate-pulse">
            <span className="text-white font-black text-2xl italic">i</span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Verifying authorization credentials...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white flex flex-col relative overflow-hidden transition-colors duration-300">
      
      {/* Decorative Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl pointer-events-none animate-float-slow animate-pulse-soft" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none animate-float-medium animate-pulse-soft" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20 dark:opacity-100" />

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl flex items-center space-x-2.5 animate-fade-in-up border transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:bg-emerald-950/80 dark:border-emerald-500/30' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:bg-rose-950/80 dark:border-rose-500/30'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-[#07090e]/60 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 transition-transform group-hover:scale-105">
              <span className="text-white font-black text-lg italic">i</span>
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wide">Intellidon</h1>
              <p className="text-[9px] text-indigo-400 font-mono tracking-wider uppercase leading-none">Super Admin Control</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{superAdminName}</span>
              <span className="text-[10px] text-amber-500 font-mono tracking-wider uppercase leading-none">Super Admin</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="text-xs font-semibold py-2 px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-all shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Panel Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 relative z-10 space-y-8 animate-fade-in-up">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Mandal Registrations
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review, approve, and manage registered community organization accounts.
            </p>
          </div>

          {/* Quick Stats Summary */}
          <div className="flex items-center gap-3">
            <div className="bg-white/50 dark:bg-[#0b0f19]/50 border border-slate-200 dark:border-slate-800 py-2 px-4 rounded-2xl flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-soft" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Live Session</span>
            </div>
          </div>
        </div>

        {/* Tab Controls Selector */}
        <div className="flex gap-1 bg-white/60 dark:bg-[#0b0f19]/60 backdrop-blur-md rounded-2xl p-1.5 border border-slate-250 dark:border-slate-800/80 w-fit">
          {tabs.map(tab => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/50'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Dynamic List Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-r-transparent border-b-indigo-500 border-l-transparent animate-spin" />
              <div className="absolute inset-1 rounded-full border-4 border-t-transparent border-r-violet-500 border-b-transparent border-l-emerald-500 animate-spin [animation-direction:reverse] [animation-duration:1.2s]" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono animate-pulse">Loading records...</p>
          </div>
        ) : mandals.length === 0 ? (
          <div className="bg-white/40 dark:bg-[#0b0f19]/30 border border-slate-200 dark:border-slate-850 rounded-3xl p-16 text-center space-y-4 backdrop-blur-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No {activeTab} mandals found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-455 max-w-xs mx-auto">There are no community organizations matching this subscription status in the system.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mandals.map(mandal => {
              const admin = mandal.users?.find(u => u.role === 'admin')
              const subscription = mandal.subscriptions?.[0]
              const isActing = actionLoading === mandal.id

              return (
                <div 
                  key={mandal.id} 
                  className="bg-white/70 dark:bg-[#0b0f19]/70 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] backdrop-blur-md relative overflow-hidden"
                >
                  {/* Subtle top indicator line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                    mandal.status === 'pending' 
                      ? 'from-amber-400 to-orange-500' 
                      : mandal.status === 'active' 
                      ? 'from-emerald-400 to-teal-500' 
                      : 'from-rose-500 to-red-600'
                  }`} />

                  <div className="space-y-5">
                    {/* Header: Name and Status Badge */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{mandal.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>Registered {formatDate(mandal.created_at)}</span>
                        </p>
                      </div>

                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border font-mono ${
                        mandal.status === 'pending' 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                          : mandal.status === 'active' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                      }`}>
                        {mandal.status}
                      </span>
                    </div>

                    {/* Subscription / Plan info (if active/has subscription details) */}
                    {subscription && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/50 flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="text-slate-500 dark:text-slate-400">Subscription Status:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{subscription.plan} Plan</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          Ends {formatDate(subscription.ends_at)}
                        </span>
                      </div>
                    )}

                    {/* Grid Info: City, Address, Phone, Admin account details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                      <div className="space-y-1">
                        <span className="text-slate-450 dark:text-slate-500 font-medium block">Location Info</span>
                        <p className="text-slate-800 dark:text-slate-250 font-semibold flex items-center space-x-1.5">
                          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{mandal.city || '—'}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">{mandal.address || '—'}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-450 dark:text-slate-500 font-medium block">Mandal Phone</span>
                        <p className="text-slate-800 dark:text-slate-250 font-semibold flex items-center space-x-1.5">
                          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>{mandal.phone}</span>
                        </p>
                      </div>

                      <div className="space-y-1 sm:col-span-2 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                        <span className="text-slate-450 dark:text-slate-500 font-medium block">Mandal Admin Account</span>
                        {admin ? (
                          <div className="flex flex-col sm:flex-row sm:justify-between text-slate-800 dark:text-slate-250 font-semibold mt-1 gap-1">
                            <div className="flex items-center space-x-1.5">
                              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{admin.full_name}</span>
                            </div>
                            <span className="text-slate-500 dark:text-slate-400 font-normal pl-5 sm:pl-0">Phone: {admin.phone}</span>
                          </div>
                        ) : (
                          <p className="text-slate-400 mt-1 italic">No admin account linked</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/50 mt-6 relative z-10">
                    {activeTab === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleAction(mandal.id, 'approve')} 
                          disabled={isActing} 
                          className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                        >
                          {isActing ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Approve Mandal</span>
                            </>
                          )}
                        </button>
                        
                        <button 
                          onClick={() => handleAction(mandal.id, 'reject')} 
                          disabled={isActing} 
                          className="py-2.5 px-4 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 border border-rose-500/20 disabled:opacity-50 text-xs font-bold rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {activeTab === 'active' && (
                      <button 
                        onClick={() => handleAction(mandal.id, 'suspend')} 
                        disabled={isActing} 
                        className="flex-1 py-2.5 px-4 bg-rose-550/5 hover:bg-rose-500/10 text-rose-500 border border-rose-500/25 hover:border-rose-500/40 disabled:opacity-50 text-xs font-bold rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        {isActing ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            <span>Suspend Mandal</span>
                          </>
                        )}
                      </button>
                    )}

                    {activeTab === 'suspended' && (
                      <button 
                        onClick={() => handleAction(mandal.id, 'approve')} 
                        disabled={isActing} 
                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        {isActing ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Reactivate Mandal</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      
      {/* Brand Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/10 backdrop-blur-sm py-6 mt-16 relative z-10">
        <div className="max-w-7xl mx-auto px-6 text-center sm:text-left">
          <p className="text-xs text-slate-500 dark:text-slate-450">
            Intellidon Super Admin Console. Access to registration status database is encrypted and audited.
          </p>
        </div>
      </footer>

    </div>
  )
}
