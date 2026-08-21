'use client'

import OrgShell from '@/components/dashboard/OrgShell'
import { useTheme, type ThemePreference } from '@/lib/theme'

const OPTIONS: { key: ThemePreference; label: string; desc: string; icon: string }[] = [
  { key: 'light', label: 'Light', desc: 'Bright background, best for daytime use', icon: '☀️' },
  { key: 'dark', label: 'Dark', desc: 'Dim background, easier on the eyes at night', icon: '🌙' },
  { key: 'system', label: 'System', desc: "Matches your device's appearance setting", icon: '🖥️' },
]

export default function ThemeAppearancePage() {
  const { preference, setTheme, mounted } = useTheme()

  return (
    <OrgShell title="Theme & Appearance" subtitle="Choose how the dashboard looks on this device">
      <div className="flex flex-col gap-3">
        {OPTIONS.map(opt => {
          const active = mounted && preference === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setTheme(opt.key)}
              className={`text-left bg-white dark:bg-gray-900 border rounded-xl p-4 flex items-center gap-4 transition-all cursor-pointer
                ${active ? 'border-[#E8650A] ring-1 ring-[#E8650A]/30' : 'border-[#1A1208]/10 dark:border-gray-800 hover:border-[#E8650A]/30'}`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#1A1208] dark:text-white">{opt.label}</p>
                <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium mt-0.5">{opt.desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                ${active ? 'border-[#E8650A]' : 'border-[#1A1208]/20 dark:border-gray-600'}`}>
                {active && <div className="w-2 h-2 rounded-full bg-[#E8650A]" />}
              </div>
            </button>
          )
        })}
      </div>
    </OrgShell>
  )
}
