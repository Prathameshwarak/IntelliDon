'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/components/dashboard/OrgContext'

// Team Management is implemented once, inside the main dashboard (Team tab), which
// already owns all team CRUD, invite, and reset-password logic and data. This page
// deliberately does not duplicate that system — it hands off to it.
export default function TeamManagementRedirectPage() {
  const router = useRouter()
  const { loading, isAdmin } = useOrg()

  useEffect(() => {
    if (loading) return
    router.replace('/dashboard?tab=team')
  }, [loading, isAdmin, router])

  return (
    <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
      <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono animate-pulse">Opening Team Management...</p>
    </div>
  )
}
