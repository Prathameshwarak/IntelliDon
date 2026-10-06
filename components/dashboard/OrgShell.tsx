'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useOrg } from './OrgContext'

type NavItem = { label: string; href: string; soon?: boolean }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Organization',
    items: [
      { label: 'Organization Profile', href: '/dashboard/organization/organization-profile' },
      { label: 'Administrator Profile', href: '/dashboard/organization/administrator-profile' },
      { label: 'Payment Information', href: '/dashboard/organization/payment-information' },
      { label: 'Organization KYC', href: '/dashboard/organization/kyc' },
      { label: 'Team Management', href: '/dashboard/organization/team-management' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Billing & Plans', href: '/dashboard/organization/billing' },
    ],
  },
  {
    title: 'Appearance',
    items: [
      { label: 'Theme & Appearance', href: '/dashboard/organization/theme' },
      { label: 'Public Donation Links', href: '/dashboard/organization/public-links' },
      { label: 'Donation Receipts', href: '/dashboard/organization/coming-soon?feature=Donation%20Receipts', soon: true },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { label: 'Notification Preferences', href: '/dashboard/organization/coming-soon?feature=Notification%20Preferences', soon: true },
      { label: 'Organization Preferences', href: '/dashboard/organization/coming-soon?feature=Organization%20Preferences', soon: true },
    ],
  },
  {
    title: 'Data',
    items: [
      { label: 'Backup & Export', href: '/dashboard/organization/coming-soon?feature=Backup%20%26%20Export', soon: true },
      { label: 'Audit Logs', href: '/dashboard/organization/coming-soon?feature=Audit%20Logs', soon: true },
    ],
  },
  {
    title: 'Security',
    items: [
      { label: 'Security', href: '/dashboard/organization/coming-soon?feature=Security', soon: true },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { label: 'Branding', href: '/dashboard/organization/coming-soon?feature=Branding', soon: true },
      { label: 'Compliance', href: '/dashboard/organization/coming-soon?feature=Compliance', soon: true },
      { label: 'Integrations', href: '/dashboard/organization/coming-soon?feature=Integrations', soon: true },
      { label: 'Roles & Permissions', href: '/dashboard/organization/coming-soon?feature=Roles%20%26%20Permissions', soon: true },
      { label: 'Analytics', href: '/dashboard/organization/coming-soon?feature=Analytics', soon: true },
      { label: 'Communication', href: '/dashboard/organization/coming-soon?feature=Communication', soon: true },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Help & Support', href: '/dashboard/organization/coming-soon?feature=Help%20%26%20Support', soon: true },
    ],
  },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const filteredGroups = q
    ? NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
    : NAV_GROUPS

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search settings..."
          className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 font-medium focus:outline-none focus:border-[#E8650A]"
        />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {filteredGroups.map(group => (
          <div key={group.title}>
            <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7a6a55] dark:text-gray-500">
              {group.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => {
                const basePath = item.href.split('?')[0]
                const active = pathname === basePath
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors
                      ${active
                        ? 'bg-[#E8650A]/10 text-[#E8650A] dark:bg-orange-900/30 dark:text-orange-400 border border-[#E8650A]/20'
                        : 'text-[#4a3f30] dark:text-gray-300 hover:bg-[#F5EDE2] dark:hover:bg-gray-800 border border-transparent'}`}
                  >
                    <span>{item.label}</span>
                    {item.soon && (
                      <span className="text-[8px] uppercase font-bold text-[#7a6a55] dark:text-gray-500 bg-[#1A1208]/5 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

export default function OrgShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const router = useRouter()
  const { loading, mandalName, toast } = useOrg()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono animate-pulse">Loading organization settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 text-[#1A1208] dark:text-white transition-colors duration-300">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-100 px-4 py-3 rounded-lg text-sm font-medium shadow-xl
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-[#F5EDE2] dark:bg-gray-900 border-b border-[#1A1208]/10 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white transition-colors text-sm font-bold cursor-pointer flex items-center gap-1.5"
        >
          <span>←</span> <span className="hidden sm:inline">Dashboard</span>
        </button>
        <span className="text-[#1A1208]/20 dark:text-gray-700">/</span>
        <p className="text-xs sm:text-sm font-bold text-[#1A1208] dark:text-white truncate">Organization Management</p>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="ml-auto lg:hidden text-xs font-bold text-[#E8650A] dark:text-orange-400 border border-[#E8650A]/30 rounded-lg px-3 py-1.5"
        >
          Sections ☰
        </button>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-[#1A1208]/10 dark:border-gray-800 min-h-[calc(100vh-57px)] bg-[#FDF8F3] dark:bg-gray-950">
          <SidebarContent />
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#FDF8F3] dark:bg-gray-950 border-r border-[#1A1208]/10 dark:border-gray-800 shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1208]/10 dark:border-gray-800">
                <p className="text-xs font-bold text-[#1A1208] dark:text-white">Organization Management</p>
                <button onClick={() => setMobileNavOpen(false)} className="text-[#7a6a55] dark:text-gray-400 text-lg leading-none cursor-pointer">✕</button>
              </div>
              <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6">
          <div className="max-w-3xl">
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-wider text-[#7a6a55] dark:text-gray-400 font-bold">
                {mandalName || 'Organization'}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1A1208] dark:text-white mt-0.5">{title}</h1>
              {subtitle && <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium mt-1">{subtitle}</p>}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
