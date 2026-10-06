'use client'

import { OrgProvider } from '@/components/dashboard/OrgContext'

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      {children}
    </OrgProvider>
  )
}
