"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [mandalName, setMandalName] = useState("");

  // Theme State (Syncs globally across all pages)
  const { theme, isDark, toggleTheme } = useTheme();

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Validation States
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Validators
  const validateEmail = (val: string) => {
    if (!val) {
      setEmailError("Email address is required.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (val: string) => {
    if (!val) {
      setPasswordError("Password is required.");
      return false;
    }
    if (val.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const getOrCreateDeviceId = () => {
    if (typeof window === "undefined") return "browser-device";
    let id = localStorage.getItem("device_mac_id");
    if (!id) {
      id = "mac-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now().toString(36);
      localStorage.setItem("device_mac_id", id);
    }
    return id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trigger validation on both fields
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      setErrorMsg("Please correct the errors in the form.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Authenticate via our custom backend API with IP + Device/MAC headers
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getOrCreateDeviceId(),
          "x-mac-address": getOrCreateDeviceId(),
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const contentType = response.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON login response received:", response.status, text);
        throw new Error(
          `Server returned an unexpected response (${response.status}). Please try again later.`
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Invalid email or password.");
      }

      if (!data.session || !data.user) {
        throw new Error("Could not log in. Session details missing.");
      }

      // 2. Determine redirect path before any state changes
      const userRole = data.profile?.role || "";
      let redirectPath = "/";
      if (userRole === "super_admin") redirectPath = "/super-admin";
      else if (userRole === "admin" || userRole === "manager") redirectPath = "/dashboard";
      else if (userRole === "collector") redirectPath = "/collect";

      // 3. Persist session tokens in localStorage for client-side Supabase access
      //    (avoid calling supabase.auth.setSession() here — it fires onAuthStateChange
      //     which re-renders the component and resets state before redirect fires)
      try {
        localStorage.setItem(
          `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.split(".")[0]}-auth-token`,
          JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
            user: data.user,
          })
        );
      } catch {
        // localStorage might be unavailable in some environments, that's okay
      }

      localStorage.setItem("remember_me", rememberMe ? "true" : "false");
      localStorage.setItem("login_time", Date.now().toString());
      localStorage.setItem("last_active", Date.now().toString());

      // 4. Show success overlay then redirect
      setAdminName(data.profile?.full_name || "");
      setMandalName(data.profile?.mandal_name || "");
      setSuccess(true);

      setTimeout(() => {
        router.replace(redirectPath);
      }, 1800);

    } catch (err: unknown) {
      const error = err as { message?: string };
      console.warn("Login authentication warning:", error.message || error);
      setErrorMsg(error.message || "Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col md:flex-row bg-[#FDF8F3] dark:bg-[#07090e] text-[#1A1208] dark:text-[#f1f5f9] transition-colors duration-300">

      {/* SUCCESS REDIRECT OVERLAY */}
      {success && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090e]/95 p-6 text-center animate-fade-in-up">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-t-[#E8650A] border-r-transparent border-b-[#C49A3C] border-l-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-t-transparent border-r-orange-500 border-b-transparent border-l-emerald-500 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
            <div className="absolute inset-0 bg-[#E8650A]/10 rounded-full blur-xl animate-pulse-soft" />
          </div>

          <div className="max-w-md space-y-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Access Granted
            </h2>
            <p className="text-slate-300 text-sm">
              Welcome back, <span className="text-[#E8650A] font-semibold">{adminName || "Admin"}</span>!
            </p>
            {mandalName && (
              <p className="text-xs text-[#C49A3C] font-mono tracking-wider uppercase font-semibold">
                {mandalName}
              </p>
            )}
            <p className="text-xs text-slate-400 pt-4 animate-pulse">
              Redirecting you to the portal home...
            </p>
          </div>
        </div>
      )}

      {/* LEFT PANEL - DYNAMIC PORTAL WELCOME & DASHBOARD PREVIEW */}
      <section className="relative w-full md:w-[45%] lg:w-[40%] bg-[#F5EDE2] dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#04060b] flex flex-col justify-between p-8 md:p-12 overflow-hidden border-b md:border-b-0 md:border-r border-[#1A1208]/10 dark:border-white/5 transition-colors duration-300">

        {/* Ambient Orbs */}
        {isDark ? (
          <>
            <div className="absolute top-1/3 -left-1/4 w-80 h-80 rounded-full bg-[#E8650A]/15 blur-3xl animate-float-slow pointer-events-none" />
            <div className="absolute bottom-1/3 -right-1/4 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl animate-float-medium pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          </>
        ) : (
          <>
            <div className="absolute top-1/3 -left-1/4 w-80 h-80 rounded-full bg-[#E8650A]/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/3 -right-1/4 w-80 h-80 rounded-full bg-[#C49A3C]/15 blur-3xl pointer-events-none" />
          </>
        )}

        {/* Top Logo Branding */}
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8650A] to-[#C49A3C] flex items-center justify-center shadow-md shadow-[#E8650A]/20">
            <span className="text-white font-black text-xl italic tracking-wider">i</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#1A1208] dark:text-white">
              Intelli<span className="text-[#E8650A]">don</span>
            </h1>
            <p className="text-[10px] text-[#C49A3C] dark:text-indigo-400 font-mono tracking-widest uppercase font-semibold">
              Mandal Portal
            </p>
          </div>
        </div>

        {/* Centerpiece: Admin Dashboard Preview Graphic */}
        <div className="relative z-10 my-12 flex flex-col items-center">
          <p className="text-[#7a6a55] dark:text-slate-400 font-mono text-xs uppercase tracking-widest mb-4 font-medium">
            Administration Overview
          </p>

          {/* Dashboard Mockup Card */}
          <div className="w-full max-w-[340px] bg-[#FDF8F3] dark:bg-white/5 border border-[#1A1208]/10 dark:border-white/10 rounded-2xl p-5 shadow-xl dark:shadow-2xl backdrop-blur-xl space-y-4 transition-all duration-300 hover:scale-[1.02]">

            {/* Header: Live Feed & Status */}
            <div className="flex justify-between items-center border-b border-[#1A1208]/10 dark:border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-[#1A1208] dark:text-slate-200 tracking-wide">Live Feed</span>
              </div>
              <span className="text-[10px] font-mono text-[#E8650A] dark:text-indigo-400 bg-[#E8650A]/10 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full border border-[#E8650A]/20 dark:border-indigo-500/20 font-semibold">
                SYS OK
              </span>
            </div>

            {/* Simulated Graph Graphic */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#7a6a55] dark:text-slate-400 font-mono">
                <span>Monthly Collections</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">+24.8%</span>
              </div>

              {/* Wave Chart SVG */}
              <div className="w-full h-20 bg-[#F5EDE2] dark:bg-slate-900/50 rounded-lg border border-[#1A1208]/08 dark:border-white/5 relative overflow-hidden flex items-end">
                <svg className="w-full h-full text-[#E8650A]/25 dark:text-indigo-500/30" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,100 C20,70 40,85 60,40 C80,60 90,20 100,30 L100,100 L0,100 Z" fill="currentColor" />
                  <path d="M0,100 C20,70 40,85 60,40 C80,60 90,20 100,30" fill="none" stroke={isDark ? "#6366f1" : "#E8650A"} strokeWidth="2.5" />
                </svg>
                <svg className="w-full h-full text-[#C49A3C]/30 dark:text-amber-500/20 absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,90 C15,80 30,50 50,65 C70,45 85,85 100,60" fill="none" stroke="#C49A3C" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
                {/* Data Bubble */}
                <div className="absolute top-3 right-6 bg-[#FDF8F3] dark:bg-slate-950/80 border border-[#1A1208]/10 dark:border-white/10 px-2 py-0.5 rounded text-[8px] font-mono text-[#1A1208] dark:text-white flex items-center space-x-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E8650A]" />
                  <span className="font-bold">Peak: ₹4.8L</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F5EDE2] dark:bg-slate-900/40 p-2.5 rounded-xl border border-[#1A1208]/08 dark:border-white/5 space-y-1">
                <span className="text-[8px] text-[#7a6a55] dark:text-slate-400 uppercase font-mono tracking-wider">Donations</span>
                <p className="text-sm font-black text-[#1A1208] dark:text-white">₹12,45,200</p>
              </div>
              <div className="bg-[#F5EDE2] dark:bg-slate-900/40 p-2.5 rounded-xl border border-[#1A1208]/08 dark:border-white/5 space-y-1">
                <span className="text-[8px] text-[#7a6a55] dark:text-slate-400 uppercase font-mono tracking-wider">Members</span>
                <p className="text-sm font-black text-[#1A1208] dark:text-white">184 Active</p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 text-left">
          <p className="text-xs text-[#7a6a55] dark:text-slate-500 font-medium">Secure Mandal Management Platform</p>
          <p className="text-[10px] text-[#9e8c76] dark:text-slate-600 mt-1">© 2026 Intellidon. All rights reserved.</p>
        </div>
      </section>

      {/* RIGHT PANEL - LOGIN FORM */}
      <section className="flex-1 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-20 bg-[#FDF8F3] dark:bg-[#07090e] transition-colors duration-300">
        
        {/* Top Header Bar with Back Link & Theme Toggle */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-xs font-semibold text-[#7a6a55] dark:text-slate-400 hover:text-[#E8650A] dark:hover:text-[#E8650A] transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to home
          </Link>

          {/* Theme Toggle Button */}
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
              /* Sun Icon for Dark Mode */
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
              /* Moon Icon for Light Mode */
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>

        {/* Center Form Content */}
        <div className="w-full max-w-md mx-auto space-y-8 my-auto">

          {/* Form Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-[#1A1208] dark:text-white tracking-tight">
              Sign In
            </h2>
            <p className="text-[#7a6a55] dark:text-slate-400 text-sm leading-relaxed">
              Log in to access your workspace and manage community operations.
            </p>
          </div>

          {/* Error Message Display */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm rounded-xl p-4 flex items-start space-x-2.5 animate-shake">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Email Address Input */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                Email Address
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
                    validateEmail(e.target.value);
                  }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  placeholder="rajesh@mandalname.com"
                  className={`w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${emailError
                    ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                    : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                    }`}
                  required
                />
              </div>
              {emailError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[#E8650A] hover:text-[#d05807] transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                    validatePassword(e.target.value);
                  }}
                  onBlur={(e) => validatePassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-11 pr-11 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${passwordError
                    ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                    : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                    }`}
                  required
                />

                {/* Eye Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#7a6a55] dark:text-slate-400 hover:text-[#1A1208] dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center select-none py-1">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4.5 w-4.5 text-[#E8650A] border-[#1A1208]/20 dark:border-slate-800 rounded focus:ring-[#E8650A]/20 bg-white dark:bg-[#0b0f19] cursor-pointer accent-[#E8650A]"
              />
              <label htmlFor="rememberMe" className="ml-2.5 text-sm font-semibold text-[#1A1208] dark:text-slate-300 cursor-pointer">
                Remember me
              </label>
            </div>

            {/* Submit Button */}
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
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Log In</span>
              )}
            </button>
          </form>

          {/* Register Link Prompt */}
          <div className="text-center pt-2">
            <p className="text-sm text-[#7a6a55] dark:text-slate-400">
              New Mandal?{" "}
              <Link
                href="/register"
                className="font-bold text-[#E8650A] hover:text-[#d05807] transition-colors duration-200"
              >
                Register Your Mandal
              </Link>
            </p>
          </div>

        </div>

        {/* Empty Spacer to balance layout */}
        <div />
      </section>

    </main>
  );
}
