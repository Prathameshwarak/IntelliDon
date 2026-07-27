// lib/theme.ts
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem('intellidon-theme') || localStorage.getItem('theme')
    if (saved === 'dark') return 'dark'
  } catch {}
  return 'light'
}

export function setStoredTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('intellidon-theme', theme)
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    window.dispatchEvent(new CustomEvent('intellidon-theme-change', { detail: theme }))
  } catch {}
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const initial = getStoredTheme()
    setThemeState(initial)
    setStoredTheme(initial)

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>
      if (customEvent.detail) {
        setThemeState(customEvent.detail)
      } else {
        setThemeState(getStoredTheme())
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'intellidon-theme' || e.key === 'theme') {
        const next = getStoredTheme()
        setThemeState(next)
        if (next === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    window.addEventListener('intellidon-theme-change', handleThemeChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('intellidon-theme-change', handleThemeChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setStoredTheme(next)
  }

  const setTheme = (next: Theme) => {
    setStoredTheme(next)
  }

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    mounted
  }
}
