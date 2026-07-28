import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Register Your Mandal or NGO | Digital Donation Management Software',
  description: 'Register your Mandal, Trust, or NGO on Intellidon to start accepting online donations, generating digital Bility/Varty receipts, and tracking door-to-door collectors.',
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
