'use client'

import { useTheme } from '@/lib/theme'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme, mounted } = useTheme()

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse ${className}`} />
    )
  }

  return (
    <button
      onClick={toggleTheme}
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
