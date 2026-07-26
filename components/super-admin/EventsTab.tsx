'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type EventRow = {
  id: string
  mandal_id: string
  name: string
  year: number
  upi_id: string | null
  is_active: boolean
  is_suspended: boolean
  created_at: string
  start_date: string
  end_date: string
  mandal_name?: string
}

type EventsTabProps = {
  showToast: (message: string, type: 'success' | 'error') => void
}

export default function EventsTab({ showToast }: EventsTabProps) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)
  const [togglingEventId, setTogglingEventId] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    setVisibleCount(10)
  }, [searchQuery])

  async function fetchEvents() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/super-admin/events', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEvents(data.events || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load events', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleSuspend(eventId: string, currentSuspended: boolean) {
    setTogglingEventId(eventId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/super-admin/events', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ eventId, isSuspended: !currentSuspended })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      showToast(data.message || 'Event suspension status updated', 'success')
      
      // Update local state
      setEvents(prev => prev.map(e => {
        if (e.id === eventId) {
          return {
            ...e,
            is_suspended: !currentSuspended,
            // If suspending, also deactivate it in client view
            is_active: !currentSuspended ? false : e.is_active
          }
        }
        return e
      }))
    } catch (err: any) {
      showToast(err.message || 'Failed to update event status', 'error')
    } finally {
      setTogglingEventId(null)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const threshold = 50 // px from bottom
    if (target.scrollHeight - target.scrollTop - target.clientHeight <= threshold) {
      if (visibleCount < filteredEvents.length) {
        setVisibleCount(prev => Math.min(prev + 10, filteredEvents.length))
      }
    }
  }

  const filteredEvents = events.filter(ev => {
    const q = searchQuery.toLowerCase()
    return (
      ev.name.toLowerCase().includes(q) ||
      (ev.mandal_name || '').toLowerCase().includes(q) ||
      ev.year.toString().includes(q) ||
      (ev.upi_id || '').toLowerCase().includes(q)
    )
  })

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Count stats
  const totalCount = events.length
  const activeCount = events.filter(e => e.is_active && !e.is_suspended).length
  const suspendedCount = events.filter(e => e.is_suspended).length
  const expiredCount = events.filter(e => {
    const today = new Date().toISOString().split('T')[0]
    return e.end_date < today && !e.is_suspended
  }).length

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-extrabold text-[#1A1208] dark:text-white">Manage Organization Events</h2>
        <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1">List of all events created by all registered organizations. You can suspend or enable them here.</p>
      </div>

      {/* Grid Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-[#7a6a55] dark:text-gray-550 font-bold uppercase tracking-wider">Total Events</p>
          <p className="text-xl font-black text-[#1A1208] dark:text-white">{totalCount}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wider">Active Events</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-450">{activeCount}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-rose-600 dark:text-rose-500 font-bold uppercase tracking-wider">Suspended / Banned</p>
          <p className="text-xl font-black text-rose-600 dark:text-rose-455">{suspendedCount}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-bold uppercase tracking-wider">Expired</p>
          <p className="text-xl font-black text-[#7a6a55] dark:text-gray-400">{expiredCount}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:max-w-md relative">
          <input
            type="text"
            placeholder="Search by event, organization, UPI or year..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 focus:border-[#E8650A] rounded-xl px-4 py-2.5 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-[10px] text-[#7a6a55] dark:text-gray-500 hover:text-[#1A1208] dark:hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={fetchEvents}
            disabled={loading}
            className="px-4 py-2.5 bg-[#F5EDE2] dark:bg-gray-900 hover:bg-[#ebdcc9] dark:hover:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-800 font-bold rounded-xl text-xs text-[#1A1208] dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5"
          >
            🔄 Refresh Events
          </button>
        </div>
      </div>

      {/* Main List Layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
          <p className="text-[10px] text-[#7a6a55] dark:text-gray-550 font-mono animate-pulse">Loading events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <p className="text-xs text-[#7a6a55] dark:text-gray-550">No events found matching your search criteria.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div 
            className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
            onScroll={handleScroll}
          >
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-[#F5EDE2] dark:bg-gray-900 z-10 border-b border-[#1A1208]/10 dark:border-gray-800">
                <tr className="border-b border-[#1A1208]/10 dark:border-gray-800 text-[10px] text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-5">Event Details</th>
                  <th className="py-3.5 px-5">Organization Name</th>
                  <th className="py-3.5 px-5">Dates</th>
                  <th className="py-3.5 px-5">UPI ID</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1208]/10 dark:divide-gray-800 text-xs">
                {filteredEvents.slice(0, visibleCount).map(ev => {
                  const today = new Date().toISOString().split('T')[0]
                  const isExpired = ev.end_date < today
                  const isSuspended = ev.is_suspended

                  return (
                    <tr key={ev.id} className="hover:bg-[#F5EDE2]/50 dark:hover:bg-gray-800/30 transition-colors">
                      {/* Event Details */}
                      <td className="py-3.5 px-5 font-bold text-[#1A1208] dark:text-white">
                        {ev.name}
                        <span className="text-[10px] text-[#E8650A] dark:text-orange-400 font-mono block mt-0.5">Year: {ev.year}</span>
                      </td>

                      {/* Organization Name */}
                      <td className="py-3.5 px-5 text-[#1A1208] dark:text-gray-300 font-bold">
                        {ev.mandal_name || '—'}
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-5 text-[#7a6a55] dark:text-gray-400 space-y-0.5 font-medium">
                        <div>Start: {formatDate(ev.start_date)}</div>
                        <div className="text-[10px] text-[#7a6a55] dark:text-gray-400">End: {formatDate(ev.end_date)}</div>
                      </td>

                      {/* UPI ID */}
                      <td className="py-3.5 px-5 text-[#1A1208] dark:text-gray-300 font-mono font-medium">
                        {ev.upi_id || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border
                          ${isSuspended
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : isExpired
                              ? 'bg-gray-500/10 text-[#7a6a55] dark:text-gray-400 border-gray-500/20'
                              : ev.is_active
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-[#E8650A] dark:text-amber-400 border-amber-500/20'}`}>
                          {isSuspended ? 'Suspended' : isExpired ? 'Expired' : ev.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleToggleSuspend(ev.id, !!ev.is_suspended)}
                          disabled={togglingEventId === ev.id || isExpired}
                          className={`px-3.5 py-1.5 font-bold rounded-xl text-[10px] transition-colors cursor-pointer border disabled:opacity-30 disabled:cursor-not-allowed
                            ${isSuspended
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border-rose-500/20'}`}
                        >
                          {togglingEventId === ev.id ? 'Updating...' : isSuspended ? 'Unsuspend Event' : 'Suspend Event'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
