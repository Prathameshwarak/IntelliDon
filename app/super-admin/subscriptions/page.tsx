'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DeprecatedSubscriptionsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/super-admin?tab=subscriptions')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-xs">Redirecting to Dashboard...</p>
    </div>
  )
}
