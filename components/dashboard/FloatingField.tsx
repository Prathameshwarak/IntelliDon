'use client'

// Reusable floating-label form fields for the Event Expense page.
//
// Design notes (Task 4 spec — "remove hint text/placeholder text"):
//  - No visible placeholder copy ("Enter title", "e.g. ...") is shown to
//    the user. `placeholder=" "` (a single space) is used purely as a CSS
//    hook for the `:placeholder-shown` pseudo-class that drives the label's
//    floating animation — it renders as nothing on screen.
//  - No character-count hints are shown; length limits are still enforced
//    silently (inputs are truncated as you type / on submit validation).
//  - Optional fields are marked with a small "(optional)" suffix on the
//    label itself, matching the convention used in Task 2's Sponsorship
//    form, instead of a separate hint line.

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type BaseProps = {
  id: string
  label: string
  optional?: boolean
}

type FloatingInputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>
type FloatingTextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>
type FloatingSelectProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement>

const labelBase =
  'absolute left-3 top-3.5 text-sm text-[#7a6a55] dark:text-gray-400 font-medium normal-case pointer-events-none transition-all duration-150 ' +
  'peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-[#7a6a55] dark:peer-placeholder-shown:text-gray-400 ' +
  'peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#E8650A] dark:peer-focus:text-orange-400 peer-focus:uppercase peer-focus:tracking-wide peer-focus:font-bold ' +
  'top-1.5 text-[10px] text-[#E8650A] dark:text-orange-400 font-bold uppercase tracking-wide'

const fieldBase =
  'peer w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 pt-5 pb-2 text-sm text-[#1A1208] dark:text-white font-medium ' +
  'placeholder-transparent focus:outline-none focus:border-[#E8650A]'

export function FloatingInput({ id, label, optional, className, ...rest }: FloatingInputProps) {
  return (
    <div className="relative">
      <input id={id} placeholder=" " className={`${fieldBase} ${className || ''}`} {...rest} />
      <label htmlFor={id} className={labelBase}>
        {label}{optional ? ' (optional)' : ''}
      </label>
    </div>
  )
}

export function FloatingTextarea({ id, label, optional, className, ...rest }: FloatingTextareaProps) {
  return (
    <div className="relative">
      <textarea id={id} placeholder=" " className={`${fieldBase} resize-none ${className || ''}`} {...rest} />
      <label htmlFor={id} className={labelBase}>
        {label}{optional ? ' (optional)' : ''}
      </label>
    </div>
  )
}

// Selects always carry a real (non-empty) value in this form, so the label
// is always shown in its floated position rather than animating — there's
// no empty/placeholder state to animate from.
export function FloatingSelect({ id, label, optional, className, children, ...rest }: FloatingSelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        className={`w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 pt-5 pb-2 text-sm text-[#1A1208] dark:text-white font-medium focus:outline-none focus:border-[#E8650A] ${className || ''}`}
        {...rest}
      >
        {children}
      </select>
      <label htmlFor={id} className="absolute left-3 top-1.5 text-[10px] text-[#E8650A] dark:text-orange-400 font-bold uppercase tracking-wide pointer-events-none">
        {label}{optional ? ' (optional)' : ''}
      </label>
    </div>
  )
}
