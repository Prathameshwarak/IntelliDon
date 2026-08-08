'use client'

import { useParams } from 'next/navigation'
import DownloadReceiptPage from '@/app/download-receipt/page'

export default function ScopedDownloadReceiptPage() {
  const { slug } = useParams() as { slug: string }

  return <DownloadReceiptPage />
}
