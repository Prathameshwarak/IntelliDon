'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export default function SessionWatcher() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // List of public paths to bypass session monitoring redirects
    const isPublicPath = 
      pathname === '/login' || 
      pathname === '/register' || 
      pathname === '/' || 
      pathname.startsWith('/donate/');

    async function checkSession() {
      // Fetch the current user session
      const { data: { session } } = await supabase.auth.getSession()
      
      // If there is no active session, nothing to expire
      if (!session) return

      const rememberMe = localStorage.getItem('remember_me') === 'true'
      const loginTimeStr = localStorage.getItem('login_time')
      const lastActiveStr = localStorage.getItem('last_active')

      const now = Date.now()

      if (rememberMe) {
        // Enforce max 24 hours since login
        if (loginTimeStr) {
          const loginTime = parseInt(loginTimeStr)
          const twentyFourHours = 24 * 60 * 60 * 1000
          if (now - loginTime > twentyFourHours) {
            console.log('Session expired: Remember Me expired after 24 hours')
            await handleLogout()
            return
          }
        }
      } else {
        // Enforce 6 hours inactivity / offline time
        if (lastActiveStr) {
          const lastActive = parseInt(lastActiveStr)
          const sixHours = 6 * 60 * 60 * 1000
          if (now - lastActive > sixHours) {
            console.log('Session expired: Offline/Inactive for more than 6 hours')
            await handleLogout()
            return
          }
        }
      }

      // If session is valid and page is private, update activity timestamp
      if (!isPublicPath) {
        localStorage.setItem('last_active', now.toString())
      }
    }

    async function handleLogout() {
      localStorage.removeItem('remember_me')
      localStorage.removeItem('login_time')
      localStorage.removeItem('last_active')
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      await supabase.auth.signOut()
      router.push('/login')
    }

    // Initial check on mount or route transition
    checkSession()

    if (isPublicPath) return

    // Track activity: update last_active on user interaction
    const updateActivity = () => {
      localStorage.setItem('last_active', Date.now().toString())
    }

    // Add event listeners for user activity
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)
    window.addEventListener('scroll', updateActivity)

    // Periodically check session (every 1 minute)
    const checkInterval = setInterval(checkSession, 60000)

    return () => {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('scroll', updateActivity)
      clearInterval(checkInterval)
    }
  }, [pathname, router])

  useEffect(() => {
    // Listen for sign-out events from Supabase to clean up localStorage automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('remember_me')
        localStorage.removeItem('login_time')
        localStorage.removeItem('last_active')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}
