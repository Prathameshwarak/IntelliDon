'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

type ProfileDropdownProps = {
  mandalName: string
  adminName?: string
  userRole: string
  planLabel: string
  planIsExpired: boolean
  planDaysRemaining: number
}

export default function ProfileDropdown({
  mandalName, adminName, userRole, planLabel, planIsExpired, planDaysRemaining,
}: ProfileDropdownProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { isDark, toggleTheme, mounted } = useTheme()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleLogout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAdmin = userRole === 'admin'

  const menuItems: { label: string; onClick: () => void; show: boolean }[] = [
    { label: 'Manage Organization', onClick: () => router.push('/dashboard/organization'), show: isAdmin },
    { label: 'Team Management', onClick: () => router.push('/dashboard/organization/team-management'), show: isAdmin },
    { label: 'Billing & Plans', onClick: () => router.push('/dashboard/organization/billing'), show: true },
    { label: 'Share & Public Links', onClick: () => router.push('/dashboard/organization/public-links'), show: true },
    { label: 'Settings', onClick: () => router.push('/dashboard/organization'), show: true },
    { label: 'Help & Support', onClick: () => router.push('/dashboard/organization/coming-soon?feature=Help%20%26%20Support'), show: true },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-gray-700 border border-[#1A1208]/15 dark:border-gray-600 flex items-center justify-center text-xs font-bold text-[#1A1208] dark:text-white shadow-xs hover:border-[#E8650A]/40 transition-colors cursor-pointer"
        aria-label="Profile menu"
      >
        {(mandalName || 'O').trim().charAt(0).toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {/* Organization Name */}
          <div className="px-4 pt-4 pb-3 border-b border-[#1A1208]/10 dark:border-gray-800">
            <p className="text-sm font-bold text-[#1A1208] dark:text-white truncate">{mandalName || 'Organization'}</p>
            {adminName && <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium mt-0.5 truncate">{adminName}</p>}
          </div>

          {/* Current Plan */}
          <button
            onClick={() => { setOpen(false); router.push('/dashboard/organization/billing') }}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#1A1208] dark:text-gray-200 hover:bg-[#F5EDE2] dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span>Current Plan</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
              ${planIsExpired
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : planDaysRemaining <= 7
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'bg-[#E8650A]/10 text-[#E8650A] dark:text-orange-400'}`}>
              {planLabel}
            </span>
          </button>

          {/* Theme */}
          <div className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#1A1208] dark:text-gray-200 border-t border-[#1A1208]/5 dark:border-gray-800">
            <span>Theme</span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              {mounted && isDark ? <>🌙 Dark</> : <>☀️ Light</>}
            </button>
          </div>

          {/* Menu items */}
          <div className="border-t border-[#1A1208]/10 dark:border-gray-800 py-1">
            {menuItems.filter(i => i.show).map(item => (
              <button
                key={item.label}
                onClick={() => { setOpen(false); item.onClick() }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#1A1208] dark:text-gray-200 hover:bg-[#F5EDE2] dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-[#1A1208]/10 dark:border-gray-800 py-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
