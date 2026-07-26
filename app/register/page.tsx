"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Generate random values for pure CSS/HTML confetti
const CONFETTI_COLORS = ["#E8650A", "#C49A3C", "#10b981", "#3b82f6", "#f43f5e"];
const confettiParticles = Array.from({ length: 60 }).map((_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  delay: `${Math.random() * 2.5}s`,
  duration: `${2 + Math.random() * 2}s`,
  size: `${Math.random() * 8 + 6}px`,
  shape: Math.random() > 0.5 ? "rounded-full" : "rounded-sm",
  rotation: `${Math.random() * 360}deg`,
}));

export default function RegisterPage() {
  const router = useRouter();

  // Theme State (Syncs with Landing Page light/dark theme)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('intellidon-theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('intellidon-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const isDark = theme === 'dark';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 3 — extra org fields
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [adminPhone, setAdminPhone] = useState('');
  const [upiId, setUpiId] = useState('');

  // Step 3 — document files
  const [docs, setDocs] = useState<Record<string, File | null>>({
    doc_admin_aadhaar: null,
    doc_bank_proof: null,
    doc_auth_letter: null,
    doc_address_proof: null,
    doc_reg_cert: null,
    doc_admin_pan: null,
    doc_org_pan: null,
  });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    confirmPassword: "",
  });

  // Validation States
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Real-time Field Validator
  const validateField = (name: string, value: string) => {
    let error = "";
    switch (name) {
      case "name":
        if (!value.trim()) {
          error = "Mandal Name is required.";
        }
        break;
      case "phone":
        if (!value.trim()) {
          error = "Mandal contact phone number is required.";
        } else {
          const cleanPhone = value.replace(/[^0-9]/g, "");
          if (cleanPhone.length < 10) {
            error = "Please enter a valid 10-digit phone number.";
          }
        }
        break;
      case "adminName":
        if (!value.trim()) {
          error = "Admin name is required.";
        }
        break;
      case "adminEmail":
        if (!value.trim()) {
          error = "Admin email is required.";
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            error = "Please enter a valid email address.";
          }
        }
        break;
      case "adminPassword":
        if (!value) {
          error = "Password is required.";
        } else if (value.length < 8) {
          error = "Password must be at least 8 characters.";
        }
        break;
      case "confirmPassword":
        if (!value) {
          error = "Please confirm your password.";
        } else if (value !== formData.adminPassword) {
          error = "Passwords do not match.";
        }
        break;
      default:
        break;
    }

    setErrors((prev) => ({ ...prev, [name]: error }));
    return !error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg("");
    validateField(name, value);
  };

  const handleNext = () => {
    const isNameValid = validateField("name", formData.name);
    const isPhoneValid = validateField("phone", formData.phone);

    if (isNameValid && isPhoneValid) {
      setErrorMsg("");
      setStep(2);
    } else {
      setErrorMsg("Please correct the errors before proceeding.");
    }
  };

  const handleNext2 = () => {
    const isAdminNameValid = validateField("adminName", formData.adminName);
    const isAdminEmailValid = validateField("adminEmail", formData.adminEmail);
    const isAdminPasswordValid = validateField("adminPassword", formData.adminPassword);
    const isConfirmPasswordValid = validateField("confirmPassword", formData.confirmPassword);

    let isPhoneValid = true;
    if (!adminPhone.trim() || adminPhone.length < 10) {
      setErrors(prev => ({ ...prev, adminPhone: "Admin mobile number must be 10 digits." }));
      isPhoneValid = false;
    }

    if (isAdminNameValid && isAdminEmailValid && isAdminPasswordValid && isConfirmPasswordValid && isPhoneValid) {
      setErrorMsg("");
      setStep(3);
    } else {
      setErrorMsg("Please fix all errors in step 2 before proceeding.");
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setErrorMsg("");

    try {
      // Validate required documents before submitting
      const requiredDocs = ['doc_admin_aadhaar', 'doc_bank_proof', 'doc_auth_letter', 'doc_address_proof'];
      const missingDocs = requiredDocs.filter(k => !docs[k]);
      if (missingDocs.length > 0) {
        setErrorMsg('Please upload all required documents before submitting.');
        setLoading(false);
        return;
      }

      if (!pincode.trim() || pincode.length < 6) {
        setErrorMsg('Please enter a valid 6-digit pincode.');
        setLoading(false);
        return;
      }

      // Build FormData
      const fd = new FormData();
      fd.append('name', formData.name);
      fd.append('phone', formData.phone);
      fd.append('address', formData.address || '');
      fd.append('city', formData.city || '');
      fd.append('state', state);
      fd.append('pincode', pincode);
      fd.append('upi_id', upiId);
      fd.append('admin_name', formData.adminName);
      fd.append('admin_email', formData.adminEmail);
      fd.append('admin_phone', adminPhone);
      fd.append('admin_password', formData.adminPassword);

      // Append document files
      Object.entries(docs).forEach(([key, file]) => {
        if (file) fd.append(key, file);
      });

      const response = await fetch('/api/mandals/register', {
        method: 'POST',
        body: fd,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to register Mandal");
      }

      setSuccess(true);
    } catch (err: any) {
      console.warn("Mandal registration warning:", err.message || err);
      setErrorMsg(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pass = formData.adminPassword;
  const passwordChecks = {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    number: /[0-9]/.test(pass),
    special: /[^A-Za-z0-9]/.test(pass)
  };

  return (
    <main className="min-h-screen w-full flex flex-col md:flex-row bg-[#FDF8F3] dark:bg-[#07090e] text-[#1A1208] dark:text-[#f1f5f9] transition-colors duration-300">

      {/* SUCCESS SCREEN */}
      {success && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090e]/95 p-6 overflow-hidden">

          {/* Confetti Particles */}
          {confettiParticles.map((p) => (
            <div
              key={p.id}
              className={`confetti-particle ${p.shape}`}
              style={{
                left: p.left,
                backgroundColor: p.color,
                animationDelay: p.delay,
                animationDuration: p.duration,
                width: p.size,
                height: p.size,
                transform: `rotate(${p.rotation})`,
              }}
            />
          ))}

          <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up bg-[#FDF8F3] dark:bg-[#0b0f19]/90 border border-[#1A1208]/10 dark:border-white/10 backdrop-blur-md p-8 rounded-3xl shadow-2xl relative text-[#1A1208] dark:text-white">
            <div className="flex justify-center">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full text-emerald-500" viewBox="0 0 52 52" fill="none">
                  <circle className="animate-checkmark-circle" cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="3" strokeDasharray="166" strokeDashoffset="166" fill="none" />
                  <path className="animate-checkmark-draw" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16" strokeDasharray="48" strokeDashoffset="48" fill="none" />
                </svg>
                <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl animate-pulse-soft" />
              </div>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight">
              Mandal Registered!
            </h2>

            <p className="text-[#7a6a55] dark:text-slate-400 text-sm leading-relaxed">
              Your registration for <span className="text-[#E8650A] font-semibold">{formData.name}</span> has been submitted.
              The administrator account has been created.
            </p>

            <div className="bg-[#E8650A]/10 border border-[#E8650A]/20 rounded-xl p-4 text-left">
              <div className="flex space-x-3">
                <svg className="w-5 h-5 text-[#E8650A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="text-[#E8650A] font-semibold text-xs uppercase tracking-wider">Status: Pending Approval</h4>
                  <p className="text-[#4a3d2c] dark:text-slate-300 text-xs mt-1">
                    Your Mandal registration status is currently pending review. You can log in using your admin credentials to check the approval status.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="block w-full py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none text-center"
            >
              Continue to Login
            </Link>
          </div>
        </div>
      )}

      {/* LEFT PANEL - DYNAMIC DIGITAL CARD PREVIEW */}
      <section className="relative w-full md:w-[45%] lg:w-[40%] bg-[#F5EDE2] dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#04060b] flex flex-col justify-between p-8 md:p-12 overflow-hidden border-b md:border-b-0 md:border-r border-[#1A1208]/10 dark:border-white/5 transition-colors duration-300">

        {/* Ambient Orbs */}
        {isDark ? (
          <>
            <div className="absolute top-1/4 -left-1/4 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl animate-float-slow pointer-events-none" />
            <div className="absolute bottom-1/4 -right-1/4 w-80 h-80 rounded-full bg-[#E8650A]/15 blur-3xl animate-float-medium pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          </>
        ) : (
          <>
            <div className="absolute top-1/4 -left-1/4 w-80 h-80 rounded-full bg-[#E8650A]/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -right-1/4 w-80 h-80 rounded-full bg-[#C49A3C]/15 blur-3xl pointer-events-none" />
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

        {/* Centerpiece: Mandal Digital Identity Card Live Preview */}
        <div className="relative z-10 my-12 flex flex-col items-center">
          <p className="text-[#7a6a55] dark:text-slate-400 font-mono text-xs uppercase tracking-widest mb-4 font-medium">
            Live Digital Card Preview
          </p>

          {/* Card Container */}
          <div className="w-full max-w-[340px] aspect-[1.58/1] bg-[#FDF8F3] dark:bg-white/5 border border-[#1A1208]/10 dark:border-white/10 rounded-2xl p-5 shadow-xl dark:shadow-2xl backdrop-blur-xl relative overflow-hidden group transition-all duration-300 hover:scale-[1.02]">

            {/* Glossy shine reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 opacity-60 pointer-events-none" />

            {/* Glowing Corner Accents */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#E8650A]/15 to-transparent blur-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-[#C49A3C]/15 to-transparent blur-xl pointer-events-none" />

            {/* Card Content Header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[8px] font-mono text-[#7a6a55] dark:text-slate-400 uppercase tracking-widest">Digital Credential</p>
                <p className="text-xs font-bold text-[#E8650A] dark:text-indigo-300 font-mono">MEMBER ID: #PENDING</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#F5EDE2] dark:bg-slate-800/80 border border-[#1A1208]/10 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                <svg className="w-4 h-4 text-[#E8650A] dark:text-amber-400 animate-spin-[spin_10s_linear_infinite]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 22h20L12 2zm0 3.99L19.53 19H4.47L12 5.99z" />
                </svg>
              </div>
            </div>

            {/* Mandal Name (Middle) */}
            <div className="mt-6 min-h-[50px] flex flex-col justify-center">
              <h3 className="text-lg font-extrabold text-[#1A1208] dark:text-white tracking-wide leading-tight truncate">
                {formData.name.trim() || "Your Mandal Name"}
              </h3>
              <p className="text-xs text-[#C49A3C] font-medium tracking-wide">
                {formData.city.trim() ? `📍 ${formData.city}` : "📍 City, Region"}
              </p>
            </div>

            {/* Card Footer */}
            <div className="mt-6 flex justify-between items-end">
              <div className="space-y-0.5">
                <p className="text-[7px] text-[#7a6a55] dark:text-slate-400 uppercase font-mono tracking-wider">Contact Phone</p>
                <p className="text-[10px] text-[#1A1208] dark:text-slate-200 font-mono tracking-wide font-semibold">
                  {formData.phone.trim() || "+91 XXXXX XXXXX"}
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-[#E8650A]/10 text-[#E8650A] border border-[#E8650A]/20 font-mono tracking-wider uppercase">
                  Pending Review
                </span>
              </div>
            </div>

            {/* Fake Microchip Visual */}
            <div className="absolute top-1/2 right-6 -translate-y-1/2 opacity-20 pointer-events-none">
              <svg className="w-10 h-10 text-[#1A1208] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="2" y="2" width="20" height="20" rx="4" strokeWidth="1" />
                <path d="M6 2v4M12 2v4M18 2v4M6 18v4M12 18v4M18 18v4M2 6h4M2 12h4M2 18h4M18 6h4M18 12h4M18 18h4" strokeWidth="1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 text-left">
          <p className="text-xs text-[#7a6a55] dark:text-slate-500 font-medium">Secure Mandal Registration System</p>
          <p className="text-[10px] text-[#9e8c76] dark:text-slate-600 mt-1">© 2026 Intellidon. All rights reserved.</p>
        </div>
      </section>

      {/* RIGHT PANEL - REGISTRATION FORM */}
      <section className="flex-1 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-20 bg-[#FDF8F3] dark:bg-[#07090e] text-[#1A1208] dark:text-[#f1f5f9] transition-colors duration-300">

        {/* Top Header Bar with Back Link & Theme Toggle */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-xs font-semibold text-[#7a6a55] dark:text-slate-400 hover:text-[#E8650A] transition-colors flex items-center gap-1.5"
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
        </div>

        <div className="w-full max-w-md mx-auto space-y-8 my-auto">

          {/* Form Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-[#1A1208] dark:text-white tracking-tight">
              Mandal Registration
            </h2>
            <p className="text-[#7a6a55] dark:text-slate-400 text-sm leading-relaxed">
              Register your organization to start receiving donations and managing events.
            </p>
          </div>

          {/* Form Progress Indicator */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${step === 1
                  ? "bg-[#E8650A] text-white shadow-lg shadow-[#E8650A]/25"
                  : "bg-emerald-500 text-white"
                }`}>
                {step > 1 ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                ) : "1"}
              </span>
              <span className={`text-xs font-semibold ${step === 1 ? "text-[#E8650A]" : "text-emerald-500"}`}>Mandal Info</span>
            </div>
            <div className="flex-1 h-0.5 bg-[#1A1208]/10 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full bg-gradient-to-r from-emerald-500 to-[#E8650A] transition-all duration-500`} style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }} />
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${step > 2
                  ? "bg-emerald-500 text-white"
                  : step === 2
                    ? "bg-[#E8650A] text-white shadow-lg shadow-[#E8650A]/25"
                    : "bg-[#F5EDE2] dark:bg-slate-800 text-[#7a6a55] dark:text-slate-400 border border-[#1A1208]/10 dark:border-slate-700"
                }`}>
                {step > 2 ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                ) : "2"}
              </span>
              <span className={`text-xs font-semibold ${step === 2 ? "text-[#E8650A]" : "text-[#7a6a55] dark:text-slate-400"}`}>Admin Credentials</span>
            </div>
            <div className="flex-1 h-0.5 bg-[#1A1208]/10 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full bg-gradient-to-r from-emerald-500 to-[#E8650A] transition-all duration-500`} style={{ width: step >= 3 ? "100%" : "0%" }} />
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${step === 3
                  ? "bg-[#E8650A] text-white shadow-lg shadow-[#E8650A]/25"
                  : "bg-[#F5EDE2] dark:bg-slate-800 text-[#7a6a55] dark:text-slate-400 border border-[#1A1208]/10 dark:border-slate-700"
                }`}>
                3
              </span>
              <span className={`text-xs font-semibold ${step === 3 ? "text-[#E8650A]" : "text-[#7a6a55] dark:text-slate-400"}`}>KYC Documents</span>
            </div>
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

          {/* Form Fields Container */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* STEP 1: MANDAL DETAILS */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-in-up">

                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Mandal / Organization Name *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={(e) => validateField("name", e.target.value)}
                      placeholder="e.g. Shree Ganesh Utsav Mandal"
                      className={`w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${errors.name
                          ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                        }`}
                      required
                    />
                  </div>
                  {errors.name && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Mandal Contact Phone *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </span>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      onBlur={(e) => validateField("phone", e.target.value)}
                      placeholder="e.g. 9876543210"
                      className={`w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${errors.phone
                          ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                        }`}
                      required
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{errors.phone}</span>
                    </p>
                  )}
                </div>

                {/* City */}
                <div className="space-y-1.5">
                  <label htmlFor="city" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    City / Town
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="e.g. Mumbai"
                      className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0b0f19] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A] transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label htmlFor="address" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Mandal Office Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="e.g. 101, Shiv Mandir Road"
                      className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0b0f19] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A] transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Next Step: Admin Account</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            )}

            {/* STEP 2: ADMIN ACCOUNT DETAILS */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in-up">

                {/* Admin Name */}
                <div className="space-y-1.5">
                  <label htmlFor="adminName" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Admin Full Name *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      id="adminName"
                      name="adminName"
                      value={formData.adminName}
                      onChange={handleChange}
                      onBlur={(e) => validateField("adminName", e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className={`w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${errors.adminName
                          ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                        }`}
                      required
                    />
                  </div>
                  {errors.adminName && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{errors.adminName}</span>
                    </p>
                  )}
                </div>

                {/* Admin Email */}
                <div className="space-y-1.5">
                  <label htmlFor="adminEmail" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Admin Email Address *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      id="adminEmail"
                      name="adminEmail"
                      value={formData.adminEmail}
                      onChange={handleChange}
                      onBlur={(e) => validateField("adminEmail", e.target.value)}
                      placeholder="rajesh@mandalname.com"
                      className={`w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${errors.adminEmail
                          ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                        }`}
                      required
                    />
                  </div>
                  {errors.adminEmail && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{errors.adminEmail}</span>
                    </p>
                  )}
                </div>

                {/* Admin Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Admin Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                      setAdminPhone(val);
                      if (val.length === 10) {
                        setErrors(prev => ({ ...prev, adminPhone: "" }));
                      }
                    }}
                    placeholder="e.g. 9876543210"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-white dark:bg-[#0b0f19] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                  />
                  {errors.adminPhone && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.adminPhone}</p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="adminPassword" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Password *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="adminPassword"
                      name="adminPassword"
                      value={formData.adminPassword}
                      onChange={handleChange}
                      onBlur={(e) => validateField("adminPassword", e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-11 pr-11 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${errors.adminPassword
                          ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                        }`}
                      required
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7a6a55] dark:text-slate-400 hover:text-[#1A1208] dark:hover:text-slate-200 cursor-pointer"
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

                  {/* Real-time Checklist */}
                  <div className="mt-2.5 p-3.5 bg-[#F5EDE2] dark:bg-slate-900/60 border border-[#1A1208]/10 dark:border-slate-800 rounded-xl space-y-2">
                    <p className="text-[10px] font-bold text-[#7a6a55] dark:text-slate-400 uppercase tracking-wider font-mono">Password Security Checklist:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1 text-[11px] font-medium">

                      {/* 8 characters min */}
                      <div className="flex items-center space-x-1.5">
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${passwordChecks.length
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-[#1A1208]/20 dark:border-slate-700 text-transparent"
                          }`}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span className={passwordChecks.length ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-[#7a6a55] dark:text-slate-400"}>
                          8+ Characters
                        </span>
                      </div>

                      {/* Capital Letter */}
                      <div className="flex items-center space-x-1.5">
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${passwordChecks.uppercase
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-[#1A1208]/20 dark:border-slate-700 text-transparent"
                          }`}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span className={passwordChecks.uppercase ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-[#7a6a55] dark:text-slate-400"}>
                          Uppercase (A-Z)
                        </span>
                      </div>

                      {/* Small Letter */}
                      <div className="flex items-center space-x-1.5">
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${passwordChecks.lowercase
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-[#1A1208]/20 dark:border-slate-700 text-transparent"
                          }`}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span className={passwordChecks.lowercase ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-[#7a6a55] dark:text-slate-400"}>
                          Lowercase (a-z)
                        </span>
                      </div>

                      {/* Number */}
                      <div className="flex items-center space-x-1.5">
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${passwordChecks.number
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-[#1A1208]/20 dark:border-slate-700 text-transparent"
                          }`}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span className={passwordChecks.number ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-[#7a6a55] dark:text-slate-400"}>
                          Number (0-9)
                        </span>
                      </div>

                      {/* Special character */}
                      <div className="flex items-center space-x-1.5">
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${passwordChecks.special
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-[#1A1208]/20 dark:border-slate-700 text-transparent"
                          }`}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span className={passwordChecks.special ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-[#7a6a55] dark:text-slate-400"}>
                          Special Char (e.g. @#$!)
                        </span>
                      </div>

                    </div>
                  </div>

                  {errors.adminPassword && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{errors.adminPassword}</span>
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7a6a55] dark:text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </span>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onBlur={(e) => validateField("confirmPassword", e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-11 pr-11 py-3 bg-white dark:bg-[#0b0f19] border rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${errors.confirmPassword
                          ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-[#1A1208]/15 dark:border-slate-800 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                        }`}
                      required
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7a6a55] dark:text-slate-400 hover:text-[#1A1208] dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? (
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
                  {errors.confirmPassword && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{errors.confirmPassword}</span>
                    </p>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex space-x-4 pt-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-1/3 py-3.5 px-4 bg-[#F5EDE2] hover:bg-[#ebdcc9] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1A1208] dark:text-slate-300 font-semibold rounded-xl border border-[#1A1208]/15 dark:border-slate-700 transition-all duration-300 transform active:scale-[0.98] cursor-pointer text-center text-sm"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext2}
                    className="flex-1 py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Next: Documents</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: KYC DOCUMENTS */}
            {step === 3 && (
              <div className="space-y-5 animate-fade-in-up">

                {/* UPI ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    UPI ID (optional but recommended)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    placeholder="e.g. mandal@okaxis"
                    className="w-full px-4 py-3 bg-white dark:bg-[#0b0f19] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                  />
                </div>

                {/* Pincode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    placeholder="e.g. 400028"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-white dark:bg-[#0b0f19] border border-[#1A1208]/15 dark:border-slate-800 rounded-xl text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E8650A]/20 focus:border-[#E8650A]"
                  />
                </div>

                {/* Document Uploads */}
                <div className="bg-[#F5EDE2] dark:bg-slate-900/60 border border-[#1A1208]/10 dark:border-slate-800 rounded-xl p-4 space-y-4">
                  <p className="text-xs font-bold text-[#1A1208] dark:text-slate-300 uppercase tracking-wider">
                    KYC Documents
                  </p>
                  <p className="text-xs text-[#7a6a55] dark:text-slate-400">
                    Upload clear photos or scanned copies. PDF, JPG, PNG accepted. Max 5MB each.
                  </p>

                  {[
                    { key: 'doc_admin_aadhaar', label: 'Admin Aadhaar', required: true, hint: 'Front and back in one file' },
                    { key: 'doc_bank_proof', label: 'Bank Proof', required: true, hint: 'Cancelled cheque or passbook first page' },
                    { key: 'doc_auth_letter', label: 'Authorisation Letter / Committee Resolution', required: true, hint: 'Signed by committee members' },
                    { key: 'doc_address_proof', label: 'Address Proof', required: true, hint: 'Utility bill, rent agreement, or property document' },
                    { key: 'doc_reg_cert', label: 'Registration Certificate', required: false, hint: 'If your organisation is registered' },
                    { key: 'doc_admin_pan', label: 'Admin PAN Card', required: false, hint: 'Recommended for faster verification' },
                    { key: 'doc_org_pan', label: 'Organisation PAN Card', required: false, hint: 'If organisation has a PAN' },
                  ].map(doc => (
                    <div key={doc.key} className="space-y-1">
                      <label className="text-xs font-semibold text-[#1A1208] dark:text-slate-300 flex items-center gap-1.5">
                        {doc.label}
                        {doc.required
                          ? <span className="text-rose-500">*</span>
                          : <span className="text-[#7a6a55] dark:text-slate-400 font-normal">(optional)</span>}
                      </label>
                      <p className="text-xs text-[#7a6a55] dark:text-slate-400">{doc.hint}</p>
                      <div
                        className={`relative border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-colors ${docs[doc.key]
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-[#1A1208]/20 dark:border-slate-700 hover:border-[#E8650A] bg-white/50 dark:bg-slate-900/40'}`}
                        onClick={() => document.getElementById(`file-${doc.key}`)?.click()}
                      >
                        {docs[doc.key] ? (
                          <div className="flex items-center justify-between px-2">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold truncate">
                              ✓ {docs[doc.key]?.name}
                            </span>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setDocs(prev => ({ ...prev, [doc.key]: null })) }}
                              className="text-slate-400 hover:text-rose-500 ml-2 flex-shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#7a6a55] dark:text-slate-400 font-medium">Tap to upload</span>
                        )}
                        <input
                          id={`file-${doc.key}`}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0] || null;
                            if (file && file.size > 5 * 1024 * 1024) {
                              setErrorMsg(`${doc.label} exceeds 5MB limit`);
                              return;
                            }
                            setDocs(prev => ({ ...prev, [doc.key]: file }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Navigation Buttons */}
                <div className="flex space-x-4 pt-2">
                  <button
                    type="button"
                    onClick={() => { setErrorMsg(''); setStep(2); }}
                    className="w-1/3 py-3.5 px-4 bg-[#F5EDE2] hover:bg-[#ebdcc9] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1A1208] dark:text-slate-300 font-semibold rounded-xl border border-[#1A1208]/15 dark:border-slate-700 transition-all duration-300 active:scale-[0.98] cursor-pointer text-center text-sm"
                  >
                    Go Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3.5 px-4 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl shadow-lg shadow-[#E8650A]/25 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 11-8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Submit Registration</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Prompt Login */}
          <div className="text-center pt-2">
            <p className="text-sm text-[#7a6a55] dark:text-slate-400">
              Already have a Mandal?{" "}
              <Link
                href="/login"
                className="font-bold text-[#E8650A] hover:text-[#d05807] transition-colors duration-200"
              >
                Log In
              </Link>
            </p>
          </div>

        </div>

        {/* Empty Spacer */}
        <div />
      </section>

    </main>
  );
}
