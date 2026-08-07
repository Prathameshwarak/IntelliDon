"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  // Wizard Step: 1 = Email, 2 = Verify OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Cooldown / Resend Timer
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Email Validation
  const validateEmail = (val: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val.trim());
  };

  // Handler Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Contact your organization admin for password reset.");
      }

      setInfoMsg(data.message || `Verification code sent to ${cleanEmail}`);
      setCooldown(120); // 2 minutes cooldown
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Contact your organization admin for password reset.");
    } finally {
      setLoading(false);
    }
  };

  // Handler Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    const fullOtp = otp.join("").trim();
    if (fullOtp.length !== 6 || !/^\d{6}$/.test(fullOtp)) {
      setErrorMsg("Please enter a complete 6-digit OTP code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: fullOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid OTP code. Please check and try again.");
      }

      setInfoMsg("Email address verified! Please set your new password.");
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid OTP verification attempt.");
    } finally {
      setLoading(false);
    }
  };

  // OTP Input Boxes Handling
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      setOtp(pastedData.split(""));
      const lastInput = document.getElementById(`otp-input-5`);
      lastInput?.focus();
    }
  };

  // Handler Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    if (!password || password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not reset password. Please try again.");
      }

      setStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col justify-between bg-[#FDF8F3] dark:bg-[#07090e] text-[#1A1208] dark:text-[#f1f5f9] transition-colors duration-300">
      
      {/* TOP BAR */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          href="/login"
          className="text-xs font-semibold text-[#7a6a55] dark:text-slate-400 hover:text-[#E8650A] dark:hover:text-[#E8650A] transition-colors flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Sign In
        </Link>

        {/* Brand Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8650A] to-[#C49A3C] flex items-center justify-center shadow-md">
            <span className="text-white font-black text-base italic">i</span>
          </div>
          <span className="text-base font-extrabold tracking-tight text-[#1A1208] dark:text-white">
            Intelli<span className="text-[#E8650A]">don</span>
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          id="theme-toggle"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,18,8,0.08)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,18,8,0.12)'}`,
            color: isDark ? '#e2e8f0' : '#4a3d2c',
          }}
        >
          {isDark ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </header>

      {/* FORM CARD CONTAINER */}
      <div className="w-full max-w-md mx-auto my-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="bg-white dark:bg-[#0b0f19] border border-[#1A1208]/10 dark:border-white/10 rounded-2xl sm:rounded-3xl p-4 xs:p-6 sm:p-8 shadow-xl dark:shadow-2xl space-y-5 sm:space-y-6 relative overflow-hidden">
          
          {/* STEP INDICATOR DOTS */}
          <div className="flex items-center justify-between border-b border-[#1A1208]/10 dark:border-white/10 pb-4">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#C49A3C] font-mono">
              Admin Password Recovery
            </span>
            <div className="flex items-center space-x-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    step === s
                      ? "bg-[#E8650A] w-6"
                      : step > s
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ERROR ALERT BOX */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-sm rounded-2xl p-4 flex items-start space-x-3 animate-shake">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 font-medium leading-snug">
                {errorMsg}
              </div>
            </div>
          )}

          {/* INFO / SUCCESS BANNER */}
          {infoMsg && !errorMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs rounded-2xl p-3.5 flex items-center space-x-2.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">{infoMsg}</span>
            </div>
          )}

          {/* STEP 1: EMAIL INPUT */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1A1208] dark:text-white">
                  Reset Admin Password
                </h2>
                <p className="text-xs text-[#7a6a55] dark:text-slate-400 leading-relaxed">
                  Enter your registered Admin email address. We will send a 6-digit OTP verification code to reset your password.
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-[#1A1208] dark:text-slate-300">
                  Admin Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="admin@mandalname.com"
                    className="w-full pl-11 pr-4 py-3 bg-[#FDF8F3] dark:bg-[#07090e] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A] transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <span>Send OTP Code</span>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: VERIFY OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1A1208] dark:text-white">
                  Enter Verification Code
                </h2>
                <p className="text-xs text-[#7a6a55] dark:text-slate-400 leading-relaxed break-words">
                  We sent a 6-digit OTP code to <span className="font-semibold text-[#E8650A] break-all">{email}</span>.
                </p>
              </div>

              {/* 6 Digit Box Inputs */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#1A1208] dark:text-slate-300 block text-center">
                  6-Digit OTP
                </label>
                <div className="flex justify-center items-center gap-1 xs:gap-1.5 sm:gap-2.5 w-full">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      className="w-9 h-11 xs:w-11 xs:h-13 sm:w-12 sm:h-14 flex-1 max-w-[42px] sm:max-w-[48px] text-center text-base xs:text-lg sm:text-xl font-bold font-mono bg-[#FDF8F3] dark:bg-[#07090e] border border-[#1A1208]/15 dark:border-slate-800 rounded-lg sm:rounded-xl text-[#1A1208] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E8650A]/30 focus:border-[#E8650A] transition-all p-0"
                    />
                  ))}
                </div>
              </div>

              {/* Resend Cooldown Timer */}
              <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
                <span className="text-[#7a6a55] dark:text-slate-400">
                  Didn&apos;t receive code?
                </span>
                {cooldown > 0 ? (
                  <span className="font-mono text-[#E8650A] font-medium">
                    Resend in {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleSendOtp(e as any)}
                    className="font-bold text-[#E8650A] hover:underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <div className="flex flex-col xs:flex-row sm:flex-row gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full xs:w-1/3 py-3 px-3 bg-[#F5EDE2] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#1A1208] dark:text-slate-200 font-bold rounded-xl transition-all text-xs cursor-pointer text-center"
                >
                  Change Email
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full xs:w-2/3 py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 text-sm"
                >
                  {loading ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <span>Verify Code</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SET NEW PASSWORD */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-[#1A1208] dark:text-white">
                  Create New Password
                </h2>
                <p className="text-xs text-[#7a6a55] dark:text-slate-400 leading-relaxed">
                  Enter a new strong password for your Admin account (minimum 8 characters).
                </p>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 pt-1">
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-[#1A1208] dark:text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-11 py-3 bg-[#FDF8F3] dark:bg-[#07090e] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7a6a55] dark:text-slate-400"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-[#1A1208] dark:text-slate-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-11 py-3 bg-[#FDF8F3] dark:bg-[#07090e] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7a6a55] dark:text-slate-400"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Updating Password...</span>
                ) : (
                  <span>Reset Password</span>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 4 && (
            <div className="text-center py-4 space-y-5 animate-fade-in-up">
              <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A1208] dark:text-white">
                  Password Reset Complete
                </h2>
                <p className="text-xs text-[#7a6a55] dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Your Admin password has been updated successfully. You can now log in with your new password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 transform hover:scale-[1.01] cursor-pointer"
              >
                Proceed to Sign In
              </button>
            </div>
          )}

        </div>
      </div>

      {/* FOOTER */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs text-[#7a6a55] dark:text-slate-500">
        &copy; {new Date().getFullYear()} IntelliDon. All rights reserved.
      </footer>
    </main>
  );
}
