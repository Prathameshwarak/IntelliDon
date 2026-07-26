'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check initial dark class on documentElement
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDark()

    // Observe changes to html class attribute
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  const toggle = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse ${className}`} />
    )
  }

  return (
    <button
      onClick={toggle}
      type="button"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle theme"
      className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs
        ${isDark
          ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-gray-700 hover:border-gray-600'
          : 'bg-white hover:bg-[#F5EDE2] text-[#E8650A] border-[#1A1208]/15 hover:border-[#E8650A]/40'} ${className}`}
    >
      {isDark ? (
        <>
          <span className="text-sm leading-none">☀️</span>
          <span className="text-xs font-bold text-gray-200 hidden md:inline">Light</span>
        </>
      ) : (
        <>
          <span className="text-sm leading-none">🌙</span>
          <span className="text-xs font-bold text-[#1A1208] hidden md:inline">Dark</span>
        </>
      )}
    </button>
  )
}
