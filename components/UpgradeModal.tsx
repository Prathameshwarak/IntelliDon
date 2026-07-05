'use client'

import { useRouter } from 'next/navigation'

type UpgradeModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-fade-in-up">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          ✕
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 bg-red-950/50 border border-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">⚠️</span>
        </div>

        {/* Headings */}
        <h3 className="text-base font-bold text-white">Subscription Expired</h3>
        <p className="text-xs text-gray-400 mt-2">
          Your active membership validity has ended. Upgrade or renew your subscription plan to unlock full dashboard operations.
        </p>

        {/* Plan Cards Preview */}
        <div className="flex flex-col gap-2 mt-5 text-left text-xs">
          <div className="bg-gray-950/60 border border-gray-850 p-3 rounded-xl flex justify-between items-center">
            <div>
              <p className="font-semibold text-white">Premium Monthly</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Renew subscription for 30 days</p>
            </div>
            <span className="font-bold text-white">₹399</span>
          </div>

          <div className="bg-gray-950/60 border border-gray-850 p-3 rounded-xl flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-orange-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl">
              Save 15%
            </div>
            <div>
              <p className="font-semibold text-white">Premium Yearly</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Renew subscription for 365 days</p>
            </div>
            <span className="font-bold text-white">₹3,999</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={() => {
              onClose()
              router.push('/dashboard/subscription')
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors shadow-md"
          >
            Upgrade / Renew Now
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-850 hover:bg-gray-800 text-gray-400 hover:text-white text-xs py-2 rounded-lg transition-colors border border-gray-850"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
