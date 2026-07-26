'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/consent'

interface ConsentGateProps {
  userId?: string
  mandalId?: string
  children: React.ReactNode
}

export default function ConsentGate({ userId, mandalId, children }: ConsentGateProps) {
  const [needsConsent, setNeedsConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function checkConsent() {
      if (!userId && !mandalId) {
        setLoading(false)
        return
      }

      try {
        const termsRes = await fetch(
          `/api/consent?${userId ? `userId=${userId}` : `mandalId=${mandalId}`}&documentType=terms_and_conditions&documentVersion=${CURRENT_TERMS_VERSION}`
        )
        const termsData = await termsRes.json()

        const privacyRes = await fetch(
          `/api/consent?${userId ? `userId=${userId}` : `mandalId=${mandalId}`}&documentType=privacy_policy&documentVersion=${CURRENT_PRIVACY_VERSION}`
        )
        const privacyData = await privacyRes.json()

        if (!termsData.accepted || !privacyData.accepted) {
          setNeedsConsent(true)
        }
      } catch (err) {
        console.warn('Consent check failed:', err)
      } finally {
        setLoading(false)
      }
    }

    checkConsent()
  }, [userId, mandalId])

  const handleRecordConsent = async () => {
    if (!acceptedTerms || !acceptedPrivacy) return

    setSubmitting(true)
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          mandalId,
          documentType: 'terms_and_conditions',
          documentVersion: CURRENT_TERMS_VERSION,
        }),
      })

      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          mandalId,
          documentType: 'privacy_policy',
          documentVersion: CURRENT_PRIVACY_VERSION,
        }),
      })

      setNeedsConsent(false)
    } catch (err) {
      console.error('Failed to submit consent:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <>{children}</>
  }

  if (!needsConsent) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {children}

      {/* Consent Modal Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="max-w-lg w-full bg-[#FDF8F3] dark:bg-[#0b0f19] border border-[#1A1208]/15 dark:border-white/10 rounded-2xl p-6 shadow-2xl text-[#1A1208] dark:text-white space-y-5 animate-fade-in-up">
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8650A]/10 flex items-center justify-center text-[#E8650A]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">Policy Update & Terms Agreement</h3>
              <p className="text-xs text-[#7a6a55] dark:text-slate-400">Please review and confirm your consent to continue.</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#3A2E1E] dark:text-slate-300">
            Intellidon has updated its legal policies ({CURRENT_TERMS_VERSION}). To continue using the platform, you must explicitly accept the updated Terms and Conditions and Privacy Policy.
          </p>

          <div className="space-y-3 bg-[#F5EDE2] dark:bg-slate-900/60 p-4 rounded-xl border border-[#1A1208]/10 dark:border-slate-800">
            <label className="flex items-start space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#1A1208]/20 dark:border-slate-700 text-[#E8650A] focus:ring-[#E8650A] cursor-pointer flex-shrink-0"
              />
              <span className="text-xs text-[#3A2E1E] dark:text-slate-300 font-medium">
                I agree to the updated{' '}
                <Link href="/terms" target="_blank" className="text-[#E8650A] font-bold hover:underline">
                  Terms & Conditions ({CURRENT_TERMS_VERSION})
                </Link>
              </span>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#1A1208]/20 dark:border-slate-700 text-[#E8650A] focus:ring-[#E8650A] cursor-pointer flex-shrink-0"
              />
              <span className="text-xs text-[#3A2E1E] dark:text-slate-300 font-medium">
                I agree to the updated{' '}
                <Link href="/privacy" target="_blank" className="text-[#E8650A] font-bold hover:underline">
                  Privacy Policy ({CURRENT_PRIVACY_VERSION})
                </Link>
              </span>
            </label>
          </div>

          <button
            type="button"
            disabled={!acceptedTerms || !acceptedPrivacy || submitting}
            onClick={handleRecordConsent}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-sm"
          >
            {submitting ? 'Recording Consent...' : 'Accept & Continue to Platform'}
          </button>
        </div>
      </div>
    </div>
  )
}
