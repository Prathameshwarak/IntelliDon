'use client'

import Link from 'next/link'
import OrgShell from '@/components/dashboard/OrgShell'
import { useOrg } from '@/components/dashboard/OrgContext'

const CARDS = [
  { label: 'Organization Profile', desc: 'Logo, name, contact details & address', href: '/dashboard/organization/organization-profile', adminOnly: false },
  { label: 'Administrator Profile', desc: 'Your name, email & phone number', href: '/dashboard/organization/administrator-profile', adminOnly: false },
  { label: 'Payment Information', desc: 'UPI IDs for each event', href: '/dashboard/organization/payment-information', adminOnly: false },
  { label: 'Organization KYC', desc: 'Verification documents & status', href: '/dashboard/organization/kyc', adminOnly: false },
  { label: 'Team Management', desc: 'Sevaks & Khajindars', href: '/dashboard/organization/team-management', adminOnly: true },
  { label: 'Billing & Plans', desc: 'Current plan, renewal & upgrades', href: '/dashboard/organization/billing', adminOnly: false },
  { label: 'Theme & Appearance', desc: 'Light, Dark or System', href: '/dashboard/organization/theme', adminOnly: false },
  { label: 'Public Donation Links', desc: 'QR code & donation link', href: '/dashboard/organization/public-links', adminOnly: false },
]

export default function OrganizationOverviewPage() {
  const { isAdmin, organization } = useOrg()

  return (
    <OrgShell title="Organization Management" subtitle="Manage every aspect of your organization from one place">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARDS.filter(c => !c.adminOnly || isAdmin).map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 hover:border-[#E8650A]/40 hover:shadow-md transition-all"
          >
            <p className="text-sm font-bold text-[#1A1208] dark:text-white">{card.label}</p>
            <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium mt-1">{card.desc}</p>
          </Link>
        ))}
      </div>

      {organization && organization.kyc_status !== 'approved' && (
        <div className="mt-5 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
          Your organization's KYC is <strong className="capitalize">{organization.kyc_status}</strong>.{' '}
          <Link href="/dashboard/organization/kyc" className="underline font-bold">Review documents →</Link>
        </div>
      )}
    </OrgShell>
  )
}
