'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import OrgShell from '@/components/dashboard/OrgShell'
import ComingSoon from '@/components/dashboard/ComingSoon'

function ComingSoonInner() {
  const searchParams = useSearchParams()
  const feature = searchParams.get('feature') || 'This feature'

  return (
    <OrgShell title={feature}>
      <ComingSoon title={feature} />
    </OrgShell>
  )
}

export default function ComingSoonPage() {
  return (
    <Suspense fallback={null}>
      <ComingSoonInner />
    </Suspense>
  )
}
