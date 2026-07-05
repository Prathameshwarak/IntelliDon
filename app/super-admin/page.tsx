'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SuperAdminPage() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userRow?.role === 'super_admin') {
        router.push('/super-admin/mandals')
      } else {
        router.push('/login')
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-[#07090e] flex items-center justify-center">
      <p className="text-gray-400 text-sm">Verifying administration credentials...</p>
    </div>
  )
}
