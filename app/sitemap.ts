import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://intelli-don.vercel.app'

  // Core static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/share`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  // Dynamic Mandal public donation pages
  let mandalRoutes: MetadataRoute.Sitemap = []
  try {
    const { data: mandals } = await supabase
      .from('mandals')
      .select('slug, id, updated_at, submitted_at')
      .eq('status', 'active')

    if (mandals && mandals.length > 0) {
      mandalRoutes = mandals.map((mandal) => ({
        url: `${baseUrl}/donate/${mandal.slug || mandal.id}`,
        lastModified: mandal.updated_at || mandal.submitted_at || new Date().toISOString(),
        changeFrequency: 'daily',
        priority: 0.9,
      }))
    }
  } catch (err) {
    console.error('Error generating mandal sitemap routes:', err)
  }

  return [...staticRoutes, ...mandalRoutes]
}
