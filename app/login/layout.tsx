import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal Login | Mandal Admin & Collector Portal',
  description: 'Log in to your Intellidon Mandal Admin dashboard or Volunteer Collector portal to manage festival events, view donation records, and issue instant receipts.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
