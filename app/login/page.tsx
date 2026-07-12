"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [mandalName, setMandalName] = useState("");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      // 1. Sign in with Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Could not log in. User details are missing.");
      }

      // 2. Fetch the corresponding user profile & mandal details for personalization
      let { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select(`
          full_name,
          role,
          is_active,
          mandals!users_mandal_id_fkey (
            name
          )
        `)
        .eq("id", data.user.id)
        .single();

      // Fallback: If is_active column doesn't exist yet, retry without it
      if (profileError && profileError.message.includes("is_active")) {
        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from("users")
          .select(`
            full_name,
            role,
            mandals!users_mandal_id_fkey (
              name
            )
          `)
          .eq("id", data.user.id)
          .single();

        if (!fallbackError && fallbackProfile) {
          userProfile = {
            ...fallbackProfile,
            is_active: true
          };
          profileError = null;
        }
      }

      let userRole = "";
      if (!profileError && userProfile) {
        // Check if account is deactivated
        if (userProfile.is_active === false) {
          await supabase.auth.signOut();
          setErrorMsg("Your account has been deactivated. Please contact your Adhyaksha.");
          setLoading(false);
          return;
        }

        setAdminName(userProfile.full_name || "");
        userRole = userProfile.role || "";
        const mandalsData = userProfile.mandals as unknown as { name: string }[] | { name: string } | null;
        if (mandalsData) {
          const mandalObj = Array.isArray(mandalsData) ? mandalsData[0] : mandalsData;
          if (mandalObj) {
            setMandalName(mandalObj.name || "");
          }
        }
      }

      // 3. Show success state and redirect
      setSuccess(true);
      setTimeout(() => {
        if (userRole === "super_admin") {
          router.push("/super-admin");
        } else if (userRole === "admin" || userRole === "manager") {
          router.push("/dashboard");
        } else if (userRole === "collector") {
          router.push("/collect");
        } else {
          router.push("/");
        }
      }, 1800);

    } catch (err: unknown) {
      const error = err as { message?: string };
      // Use console.warn instead of console.error to avoid popping up Next.js developer overlay
      console.warn("Login authentication warning:", error.message || error);
      setErrorMsg(error.message || "Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col md:flex-row bg-[#f8fafc] dark:bg-[#07090e] transition-colors duration-300">
      
      {/* SUCCESS REDIRECT OVERLAY */}
      {success && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090e]/95 p-6 text-center animate-fade-in-up">
          <div className="relative w-24 h-24 mb-6">
            {/* Spinning Loader Rings */}
            <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-r-transparent border-b-indigo-500 border-l-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-t-transparent border-r-violet-500 border-b-transparent border-l-emerald-500 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
            <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-pulse-soft" />
          </div>

          <div className="max-w-md space-y-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Access Granted
            </h2>
            <p className="text-slate-400 text-sm">
              Welcome back, <span className="text-amber-400 font-semibold">{adminName || "Admin"}</span>!
            </p>
            {mandalName && (
              <p className="text-xs text-indigo-400 font-mono tracking-wider uppercase">
                {mandalName}
              </p>
            )}
            <p className="text-xs text-slate-500 pt-4 animate-pulse">
              Redirecting you to the portal home...
            </p>
          </div>
        </div>
      )}

      {/* LEFT PANEL - DYNAMIC PORTAL WELCOME & DASHBOARD PREVIEW */}
      <section className="relative w-full md:w-[45%] lg:w-[40%] bg-gradient-to-b from-[#0b0f19] to-[#04060b] flex flex-col justify-between p-8 md:p-12 overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
        
        {/* Floating Ambient Orbs */}
        <div className="absolute top-1/3 -left-1/4 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl animate-float-slow animate-pulse-soft pointer-events-none" />
        <div className="absolute bottom-1/3 -right-1/4 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl animate-float-medium animate-pulse-soft pointer-events-none" />
        <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-violet-600/10 blur-3xl animate-float-fast pointer-events-none" />

        {/* Fine SVG Tech Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* Top Logo branding */}
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-white font-black text-xl italic tracking-wider">i</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">Intellidon</h1>
            <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">Mandal Portal</p>
          </div>
        </div>

        {/* Centerpiece: Admin Dashboard Preview Graphic */}
        <div className="relative z-10 my-12 flex flex-col items-center">
          <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-4">Administration Overview</p>
          
          {/* Dashboard mockup card */}
          <div className="w-full max-w-[340px] bg-white/5 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl space-y-4 transition-all duration-300 hover:scale-[1.02]">
            
            {/* Header: Title and active user stats */}
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-slate-200 tracking-wide">Live Feed</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">SYS OK</span>
            </div>

            {/* Simulated graph graphic */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Monthly Collections</span>
                <span className="text-emerald-400 font-semibold">+24.8%</span>
              </div>
              
              {/* SVG Wave chart */}
              <div className="w-full h-20 bg-slate-900/50 rounded-lg border border-white/5 relative overflow-hidden flex items-end">
                <svg className="w-full h-full text-indigo-500/30" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Background filled area */}
                  <path d="M0,100 C20,70 40,85 60,40 C80,60 90,20 100,30 L100,100 L0,100 Z" fill="currentColor" />
                  {/* Foreground stroke line */}
                  <path d="M0,100 C20,70 40,85 60,40 C80,60 90,20 100,30" fill="none" stroke="#6366f1" strokeWidth="2.5" />
                </svg>
                <svg className="w-full h-full text-amber-500/20 absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Secondary line */}
                  <path d="M0,90 C15,80 30,50 50,65 C70,45 85,85 100,60" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
                {/* Floating data bubble */}
                <div className="absolute top-3 right-6 bg-slate-950/80 border border-white/10 px-2 py-0.5 rounded text-[8px] font-mono text-white flex items-center space-x-1 shadow">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Peak: ₹4.8L</span>
                </div>
              </div>
            </div>

            {/* Quick stats items */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 space-y-1">
                <span className="text-[8px] text-slate-400 uppercase font-mono tracking-wider">Donations</span>
                <p className="text-sm font-black text-white">₹12,45,200</p>
              </div>
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 space-y-1">
                <span className="text-[8px] text-slate-400 uppercase font-mono tracking-wider">Members</span>
                <p className="text-sm font-black text-white">184 Active</p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 text-left">
          <p className="text-xs text-slate-500">Secure Mandal Management Platform</p>
          <p className="text-[10px] text-slate-600 mt-1">© 2026 Intellidon. All rights reserved.</p>
        </div>
      </section>

      {/* RIGHT PANEL - LOGIN FORM */}
      <section className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 bg-white dark:bg-[#07090e] transition-colors duration-300">
        <div className="w-full max-w-md mx-auto space-y-8">
          
          {/* Form Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight animate-fade-in-up">
              Sign In
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Log in to access your workspace and manage community operations.
            </p>
          </div>

          {/* Error Message Display */}
          {errorMsg && (
            <div className="bg-rose-500/10 dark:bg-rose-500/5 border border-rose-500/20 text-rose-500 text-sm rounded-xl p-4 flex items-start space-x-2.5 animate-shake">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Address */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className={`w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#0b0f19] border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                    emailError 
                      ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500" 
                      : "border-slate-200 dark:border-slate-800 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-500"
                  }`}
                  required
                />
              </div>
              {emailError && (
                <p className="text-xs text-rose-500 mt-1 font-medium flex items-center space-x-1 animate-fade-in-up">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setErrorMsg("Please contact your database administrator to reset your password.");
                  }}
                  className="text-xs font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className={`w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-[#0b0f19] border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                    passwordError 
                      ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500" 
                      : "border-slate-200 dark:border-slate-800 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-500"
                  }`}
                  required
                />
                
                {/* Reveal Password Eye Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
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
                <p className="text-xs text-rose-500 mt-1 font-medium flex items-center space-x-1 animate-fade-in-up">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
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

          {/* Prompt Register */}
          <div className="text-center pt-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              New Mandal?{" "}
              <Link
                href="/register"
                className="font-bold text-amber-500 hover:text-amber-600 transition-colors duration-200"
              >
                Register Your Mandal
              </Link>
            </p>
          </div>

        </div>
      </section>

    </main>
  );
}
