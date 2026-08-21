'use client'

export default function ComingSoon({
  title,
  description = "We're building this feature. It'll be available in a future update.",
}: {
  title: string
  description?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-10 sm:p-16 flex flex-col items-center text-center gap-3 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-[#E8650A]/10 dark:bg-orange-900/30 flex items-center justify-center text-2xl">
        🚧
      </div>
      <h2 className="text-base font-bold text-[#1A1208] dark:text-white">{title}</h2>
      <span className="text-[10px] uppercase tracking-wider font-bold text-[#E8650A] dark:text-orange-400 bg-[#E8650A]/10 dark:bg-orange-900/30 px-2.5 py-1 rounded-full border border-[#E8650A]/20">
        Coming Soon
      </span>
      <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium max-w-sm">{description}</p>
    </div>
  )
}
