import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params
  const slug = resolvedParams.slug
  const siteUrl = 'https://intelli-don.vercel.app'

  try {
    const { data: mandal } = await supabase
      .from('mandals')
      .select('name, city, address')
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .single()

    if (mandal) {
      const mandalName = mandal.name || 'Mandal'
      const cityStr = mandal.city ? ` in ${mandal.city}` : ''
      const title = `Donate to ${mandalName}${cityStr} - Online Donation & Receipt`
      const description = `Support ${mandalName}${cityStr} with secure online UPI donations. Get instant digital receipt (Bility/Varty) and WhatsApp confirmation via Intellidon platform.`

      return {
        title,
        description,
        keywords: [
          `donate to ${mandalName}`,
          `${mandalName} online donation`,
          `${mandalName} receipt`,
          'online mandal donation',
          'digital bility receipt',
          'intellidon donation',
        ],
        openGraph: {
          title,
          description,
          url: `${siteUrl}/donate/${slug}`,
          siteName: 'Intellidon',
          images: [
            {
              url: `${siteUrl}/icon.png`,
              width: 512,
              height: 512,
              alt: `Donate to ${mandalName}`,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [`${siteUrl}/icon.png`],
        },
      }
    }
  } catch (err) {
    console.error('Error generating metadata for mandal donate page:', err)
  }

  return {
    title: 'Online Mandal Donation & Instant Receipt | Intellidon',
    description: 'Make secure online donations to Mandals and NGOs with instant digital receipts.',
  }
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
