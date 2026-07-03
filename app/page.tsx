"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  // Storage Test State (Preserved)
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [showDevTools, setShowDevTools] = useState(false);

  async function uploadFile() {
    if (!file) {
      setMessage("Please select a file");
      return;
    }

    const fileName = `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("payment-screenshots")
      .upload(fileName, file);

    if (error) {
      console.error(error);
      setMessage(error.message);
    } else {
      console.log(data);
      setMessage("Upload Successful!");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white flex flex-col justify-between relative overflow-hidden transition-colors duration-300">
      
      {/* Decorative Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none animate-float-slow animate-pulse-soft" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none animate-float-medium animate-pulse-soft" />

      {/* Header / Navigation Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-[#07090e]/60 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-white font-black text-lg italic">i</span>
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wide">Intellidon</h1>
              <p className="text-[9px] text-indigo-400 font-mono tracking-wider uppercase leading-none">Mandal Portal</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link 
              href="/login" 
              className="text-sm font-semibold text-slate-600 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="text-sm font-semibold py-2.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl transition-all shadow-md shadow-slate-900/10"
            >
              Register Mandal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Body section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center relative z-10 max-w-4xl mx-auto space-y-12">
        
        {/* Welcome titles */}
        <div className="space-y-4 animate-fade-in-up">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono uppercase tracking-wider">
            Now Open for Registrations
          </span>
          <h2 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Empower Your Mandal with <br />
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-500 bg-clip-text text-transparent">
              Digital Leadership
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Manage your community organization seamlessly. Accept transparent donations, generate instant receipts, track members, and publish audit reports.
          </p>
        </div>

        {/* Portal Entry Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl pt-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          
          {/* Card 1: Admin Login */}
          <Link 
            href="/login" 
            className="group p-8 bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between items-start text-left relative overflow-hidden"
          >
            {/* Hover card glow accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/10 to-transparent blur-xl group-hover:from-indigo-500/20 pointer-events-none" />
            
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-110">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                  Mandal Admin Login
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Log in to your Mandal workspace to view donations dashboard, verify payments, and manage updates.
                </p>
              </div>
            </div>
            
            <span className="mt-6 flex items-center text-xs font-bold text-indigo-500 dark:text-indigo-400 group-hover:translate-x-1.5 transition-transform">
              <span>Access Workspace</span>
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

          {/* Card 2: Register Mandal */}
          <Link 
            href="/register" 
            className="group p-8 bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between items-start text-left relative overflow-hidden"
          >
            {/* Hover card glow accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent blur-xl group-hover:from-amber-500/20 pointer-events-none" />

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center transition-transform group-hover:scale-110">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                  Register Your Mandal
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Submit a registration request for your Mandal. Set up your admin account and secure digital ID card.
                </p>
              </div>
            </div>
            
            <span className="mt-6 flex items-center text-xs font-bold text-amber-500 group-hover:translate-x-1.5 transition-transform">
              <span>Start Registration</span>
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

        </div>

      </section>

      {/* Collapsible Developer Tool Section (Preserving previous Storage utility) */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/10 backdrop-blur-sm relative z-10 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Intellidon Admin & Mandal Registration Portal. Built using Next.js, Supabase, and Tailwind CSS.
          </p>
          
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 flex items-center space-x-1 border border-indigo-500/20 px-3 py-1.5 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
          >
            <span>{showDevTools ? "Hide" : "Show"} Developer Utilities</span>
            <svg className={`w-3.5 h-3.5 transform transition-transform ${showDevTools ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Storage Test Box (Visible if toggled) */}
        {showDevTools && (
          <div className="max-w-3xl mx-auto mt-6 mx-6 p-6 bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner animate-fade-in-up">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Storage Testing Utility</span>
            </h3>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <input
                type="file"
                onChange={(e) => {
                  if (e.target.files) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="block w-full text-xs text-slate-500 dark:text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-xs file:font-semibold
                  file:bg-amber-500/10 file:text-amber-500
                  hover:file:bg-amber-500/20"
              />

              <button 
                onClick={uploadFile}
                className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-full shadow-md transition-colors"
              >
                Upload File
              </button>
            </div>

            {message && (
              <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-xs font-mono overflow-auto">
                <pre>{message}</pre>
              </div>
            )}
          </div>
        )}
      </footer>

    </main>
  );
}