// lib/theme.ts
import { useEffect, useState } from 'react'

// 'system' is a stored *preference*; the applied theme is always resolved to 'light' | 'dark'.
export type Theme = 'light' | 'dark'
export type ThemePreference = 'light' | 'dark' | 'system'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem('intellidon-theme') || localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved
  } catch {}
  return 'light'
}

export function resolveTheme(pref: ThemePreference): Theme {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref
}

// Back-compat: existing callers treat the stored theme as an applied light/dark value.
export function getStoredTheme(): Theme {
  return resolveTheme(getStoredPreference())
}

export function setStoredTheme(pref: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('intellidon-theme', pref)
    localStorage.setItem('theme', pref)
    const applied = resolveTheme(pref)
    if (applied === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    window.dispatchEvent(new CustomEvent('intellidon-theme-change', { detail: pref }))
  } catch {}
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>('light')
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const initial = getStoredPreference()
    setPreferenceState(initial)
    setThemeState(resolveTheme(initial))
    setStoredTheme(initial)

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemePreference>
      const pref = customEvent.detail || getStoredPreference()
      setPreferenceState(pref)
      setThemeState(resolveTheme(pref))
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'intellidon-theme' || e.key === 'theme') {
        const pref = getStoredPreference()
        setPreferenceState(pref)
        const applied = resolveTheme(pref)
        setThemeState(applied)
        if (applied === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    // Live-update when the preference is 'system' and the OS theme changes
    let mq: MediaQueryList | null = null
    const handleSystemChange = () => {
      if (getStoredPreference() === 'system') {
        const applied = resolveTheme('system')
        setThemeState(applied)
        document.documentElement.classList.toggle('dark', applied === 'dark')
      }
    }
    if (window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener?.('change', handleSystemChange)
    }

    window.addEventListener('intellidon-theme-change', handleThemeChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('intellidon-theme-change', handleThemeChange)
      window.removeEventListener('storage', handleStorageChange)
      mq?.removeEventListener?.('change', handleSystemChange)
    }
  }, [])

  const toggleTheme = () => {
    // Toggling always resolves to an explicit light/dark (leaves 'system' mode)
    const next: ThemePreference = theme === 'light' ? 'dark' : 'light'
    setStoredTheme(next)
  }

  const setTheme = (next: ThemePreference) => {
    setStoredTheme(next)
  }

  return {
    theme,            // resolved 'light' | 'dark' — safe for styling
    preference,        // raw preference incl. 'system' — for the Theme settings page
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    mounted
  }
}
