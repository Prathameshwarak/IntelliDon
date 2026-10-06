'use client'

import { useCallback, useEffect, useState } from 'react'
import OrgShell from '@/components/dashboard/OrgShell'
import { useOrg } from '@/components/dashboard/OrgContext'

type EventRow = {
  id: string
  name: string
  year: number
  upi_id: string | null
  start_date: string
  end_date: string
  is_active: boolean
  is_expired: boolean
}

export default function PaymentInformationPage() {
  const { loading, mandalId, isAdmin, showToast, getAuthHeaders } = useOrg()
  const [events, setEvents] = useState<EventRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [upiDraft, setUpiDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchEvents = useCallback(async () => {
    if (!mandalId) return
    setFetching(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/events?mandal_id=${mandalId}`, { headers })
      const data = await res.json()
      if (res.ok && data.events) setEvents(data.events)
    } catch {
      showToast('Could not load events', 'error')
    } finally {
      setFetching(false)
    }
  }, [mandalId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function startEdit(ev: EventRow) {
    setEditingId(ev.id)
    setUpiDraft(ev.upi_id || '')
  }

  async function saveUpi(ev: EventRow) {
    if (!upiDraft.trim()) { showToast('UPI ID cannot be empty', 'error'); return }
    setSaving(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          event_id: ev.id,
          name: ev.name,
          year: ev.year,
          upi_id: upiDraft.trim(),
          start_date: ev.start_date,
          end_date: ev.end_date,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Could not update UPI ID')
      showToast('UPI ID updated', 'success')
      setEditingId(null)
      await fetchEvents()
    } catch (err: any) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OrgShell title="Payment Information" subtitle="UPI IDs registered for each event">
      {loading || fetching ? (
        <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-mono animate-pulse">Loading events...</p>
      ) : events.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-[#1A1208]/15 dark:border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">No events created yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#1A1208] dark:text-white">{ev.name}</p>
                    <span className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-semibold">({ev.year})</span>
                    {ev.is_active && (
                      <span className="text-[9px] uppercase font-bold text-emerald-700 dark:text-green-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Active</span>
                    )}
                    {ev.is_expired && (
                      <span className="text-[9px] uppercase font-bold text-[#7a6a55] dark:text-gray-500 bg-[#1A1208]/5 dark:bg-gray-800 px-1.5 py-0.5 rounded">Expired</span>
                    )}
                  </div>

                  {editingId === ev.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        value={upiDraft}
                        onChange={e => setUpiDraft(e.target.value)}
                        placeholder="upi-id@bank"
                        className="bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-1.5 text-xs text-[#1A1208] dark:text-white font-mono focus:outline-none focus:border-[#E8650A]"
                      />
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-[#7a6a55] dark:text-gray-400 mt-1">
                      {ev.upi_id || '— not set —'}
                    </p>
                  )}
                </div>

                {isAdmin && (
                  editingId === ev.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#ebdcc9] dark:bg-gray-800 text-[#1A1208] dark:text-gray-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveUpi(ev)}
                        disabled={saving}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white disabled:opacity-50 cursor-pointer"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(ev)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-white border border-[#1A1208]/10 dark:border-gray-700 transition-colors cursor-pointer"
                    >
                      Change UPI ID
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <p className="mt-4 text-xs text-[#7a6a55] dark:text-gray-500 font-medium">
          Only the Adhyaksha (Admin) can change an event's UPI ID.
        </p>
      )}
    </OrgShell>
  )
}
