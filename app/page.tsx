'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Poppins, Inter } from 'next/font/google';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
});

type Lang = 'en' | 'mr' | 'hi';

const COPY: Record<Lang, { badge: string; headline: string; sub: string; cta: string; ctaSecondary: string; trust: string; navCta: string }> = {
  en: {
    badge: 'Temples · Churches · Mosques · Cultural associations',
    headline: 'Every donation,\na proper receipt',
    sub: "Collect door-to-door and event donations — cash or digital — and hand every donor a real receipt on the spot. No more receipt books, no more entries that don't add up.",
    cta: 'Register your organization — free',
    ctaSecondary: 'See how it works',
    trust: 'Trusted by 500+ community organizations · No setup fee · Cancel anytime',
    navCta: 'Register',
  },
  mr: {
    badge: 'मंदिर · चर्च · मशीद · सांस्कृतिक मंडळे',
    headline: 'प्रत्येक देणगीला,\nखरी पावती',
    sub: 'दारोदारी आणि कार्यक्रमातील देणग्या घ्या — रोख किंवा डिजिटल — आणि प्रत्येक देणगीदाराला जागच्या जागी खरी पावती द्या.',
    cta: 'तुमची संस्था नोंदवा — मोफत',
    ctaSecondary: 'कसं काम करतं ते बघा',
    trust: '500+ संस्थांचा विश्वास · No setup fee · कधीही रद्द करा',
    navCta: 'नोंदणी करा',
  },
  hi: {
    badge: 'मंदिर · चर्च · मस्जिद · सांस्कृतिक संगठन',
    headline: 'हर दान की,\nअसली रसीद',
    sub: 'घर-घर जाकर और कार्यक्रम में मिलने वाले दान लें — नकद या डिजिटल — और हर दानदाता को उसी वक़्त असली रसीद दें।',
    cta: 'अपना संगठन पंजीकृत करें — मुफ़्त',
    ctaSecondary: 'यह कैसे काम करता है देखें',
    trust: '500+ संगठनों का भरोसा · No setup fee · कभी भी रद्द करें',
    navCta: 'पंजीकरण करें',
  },
};

const LANG_LABEL: Record<Lang, string> = { en: 'English', mr: 'मराठी', hi: 'हिंदी' };

export default function LandingPage() {
  const [orgName, setOrgName] = useState('');
  const [lang, setLang] = useState<Lang>('en');
  const t = COPY[lang];
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dashboardPath, setDashboardPath] = useState('/dashboard');
  const { theme, isDark, toggleTheme } = useTheme();


  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setIsLoggedIn(true);
          const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (userProfile) {
            if (userProfile.role === 'super_admin') {
              setDashboardPath('/super-admin');
            } else if (userProfile.role === 'collector') {
              setDashboardPath('/collect');
            } else {
              setDashboardPath('/dashboard');
            }
          }
        }
      } catch (err) {
        console.error('Error checking auth session:', err);
      }
    }
    checkSession();
  }, []);

  const handleRegisterSubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = orgName.trim() ? `?org=${encodeURIComponent(orgName.trim())}` : '';
    router.push(`/register${query}`);
  };

  // ─── Theme tokens ────────────────────────────────────────────────────────────
  const bg = isDark ? '#07090e' : '#FDF8F3';
  const fg = isDark ? '#f1f5f9' : '#1A1208';
  const navBg = isDark ? 'rgba(7,9,14,0.75)' : 'rgba(253,248,243,0.85)';
  const navBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,18,8,0.08)';
  const mutedFg = isDark ? '#64748b' : '#7a6a55';
  const subFg = isDark ? '#94a3b8' : '#4a3d2c';
  const sectionBg = isDark ? '#0a0e1a' : '#F5EDE2';
  const cardBg = isDark ? 'rgba(15,20,35,0.7)' : '#FDF8F3';
  const cardBorder = isDark ? 'rgba(232,101,10,0.12)' : 'rgba(26,18,8,0.08)';
  const cardGlow = isDark ? '0 0 0 1px rgba(232,101,10,0.1), 0 8px 32px rgba(0,0,0,0.4)' : '0 1px 8px rgba(26,18,8,0.06)';
  const accent = '#E8650A';
  const gold = '#C49A3C';

  return (
    <div
      className={`${poppins.variable} ${inter.variable}`}
      style={{ fontFamily: 'var(--font-inter)', background: bg, color: fg, transition: 'background 0.4s, color 0.4s', minHeight: '100vh', position: 'relative' }}
    >
      {/* Dark mode ambient orbs */}
      {isDark && (
        <>
          <div style={{ position: 'fixed', top: '-10rem', right: '-8rem', width: '36rem', height: '36rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,101,10,0.12) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'fixed', top: '40%', left: '-12rem', width: '40rem', height: '40rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'fixed', bottom: '-8rem', right: '20%', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,154,60,0.07) 0%, transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0 }} />
          {/* Fine grid overlay */}
          <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />
        </>
      )}

      {/* NAV */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: navBg,
          borderBottom: `1px solid ${navBorder}`,
          position: 'relative',
          zIndex: 50,
          ...(isDark ? { boxShadow: '0 1px 40px rgba(0,0,0,0.4)' } : {}),
        }}
      >
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: '1.25rem', color: accent, letterSpacing: '-0.01em' }}>
            Intelli<span style={{ color: fg }}>don</span>
            {isDark && <span style={{ marginLeft: '0.4rem', fontSize: '0.55rem', fontWeight: 600, color: mutedFg, letterSpacing: '0.12em', textTransform: 'uppercase', verticalAlign: 'middle', fontFamily: 'var(--font-inter)' }}>Mandal Fundraiser</span>}
          </span>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1 text-sm">
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  style={{
                    background: lang === l ? 'rgba(232,101,10,0.12)' : 'transparent',
                    color: lang === l ? accent : mutedFg,
                    fontWeight: lang === l ? 600 : 400,
                  }}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
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

            {isLoggedIn ? (
              <Link
                href={dashboardPath}
                className="px-5 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                style={{ background: accent, color: '#FDF8F3', fontFamily: 'var(--font-poppins)' }}
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold hover:text-[#E8650A] transition-colors"
                  style={{ color: fg, fontFamily: 'var(--font-poppins)' }}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:inline-block px-5 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                  style={{ background: accent, color: '#FDF8F3', fontFamily: 'var(--font-poppins)' }}
                >
                  {t.navCta}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
        {!isDark && (
          <div
            aria-hidden
            className="absolute -top-32 -right-32 w-[32rem] h-[32rem] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #E8650A 0%, transparent 70%)' }}
          />
        )}
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-20 md:pt-24 md:pb-28 lg:pt-28 lg:pb-32 relative">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p
                className="inline-flex items-center gap-1.5 mb-5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
                style={{
                  background: isDark ? 'rgba(232,101,10,0.1)' : 'rgba(196,154,60,0.15)',
                  color: isDark ? '#fb923c' : '#8a6a20',
                  fontFamily: 'var(--font-poppins)',
                  border: isDark ? '1px solid rgba(232,101,10,0.2)' : 'none',
                }}
              >
                {isDark && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent, display: 'inline-block', animation: 'pulse 2s infinite' }} />}
                {t.badge}
              </p>
              <h1
                className="leading-tight mb-4 whitespace-pre-line"
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 800,
                  fontSize: 'clamp(2rem, 4vw, 4.25rem)',
                  color: isDark ? 'transparent' : fg,
                  backgroundImage: isDark ? 'linear-gradient(135deg, #f8fafc 0%, #fb923c 50%, #fbbf24 100%)' : 'none',
                  WebkitBackgroundClip: isDark ? 'text' : 'unset',
                  backgroundClip: isDark ? 'text' : 'unset',
                  letterSpacing: '-0.02em',
                }}
              >
                {t.headline}
              </h1>
              <p className="text-lg md:text-xl mb-8 max-w-xl leading-relaxed" style={{ color: subFg }}>
                {t.sub}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  className="px-7 py-3.5 rounded-full text-center font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: isDark ? 'linear-gradient(135deg, #E8650A, #f97316)' : accent,
                    color: '#fff',
                    fontFamily: 'var(--font-poppins)',
                    boxShadow: isDark ? '0 0 24px rgba(232,101,10,0.4), 0 4px 12px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  {t.cta}
                </Link>
                <a
                  href="#how-it-works"
                  className="px-7 py-3.5 rounded-full text-center font-semibold transition-all duration-200 hover:scale-105"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : fg,
                    border: `2px solid ${isDark ? 'rgba(255,255,255,0.12)' : fg}`,
                    color: isDark ? '#cbd5e1' : fg,
                    fontFamily: 'var(--font-poppins)',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'transparent',
                    backdropFilter: isDark ? 'blur(8px)' : 'none',
                  }}
                >
                  {t.ctaSecondary}
                </a>
              </div>
              <p className="mt-5 text-sm flex items-center gap-2" style={{ color: mutedFg }}>
                {isDark && <span style={{ fontSize: '0.8rem' }}>🛡️</span>}
                {t.trust}
              </p>
            </div>

            {/* Hero visual */}
            <div className="relative h-[420px] lg:h-[480px] flex items-center justify-center lg:scale-110">
              <div
                className="absolute w-56 h-72 rounded-sm shadow-xl"
                style={{
                  background: isDark ? '#1a2235' : '#F1E4C8',
                  transform: 'rotate(-9deg) translateX(-70px)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,18,8,0.15)'}`,
                  boxShadow: '4px 8px 24px rgba(26,18,8,0.25)',
                }}
              >
                <div className="p-4">
                  <div className="text-center border-b pb-2 mb-3" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,18,8,0.2)' }}>
                    <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: '0.85rem', color: fg }}>Community Fund</p>
                    <p className="text-[0.65rem]" style={{ color: mutedFg }}>Donation Receipt Book</p>
                  </div>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-2 mb-2.5 rounded-sm" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,18,8,0.15)', width: `${85 - i * 6}%` }} />
                  ))}
                </div>
              </div>
              <div className="absolute z-10 text-3xl" style={{ color: gold }}>→</div>
              <div
                className="absolute w-56 rounded-[1.75rem] shadow-2xl overflow-hidden"
                style={{
                  transform: 'rotate(6deg) translateX(70px)',
                  background: isDark ? '#1a2235' : '#1A1208',
                  padding: '10px',
                  boxShadow: '0 20px 45px rgba(26,18,8,0.35)',
                }}
              >
                <div className="rounded-[1.25rem] overflow-hidden" style={{ background: isDark ? '#07090e' : '#FDF8F3' }}>
                  <div className="p-4">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#2D6A4F', color: '#fff' }}>✓</div>
                    </div>
                    <p className="text-center text-xs font-semibold mb-1" style={{ fontFamily: 'var(--font-poppins)', color: fg }}>Receipt confirmed</p>
                    <p className="text-center text-[0.6rem] mb-3" style={{ color: mutedFg }}>Receipt No. CF24-0812</p>
                    <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(232,101,10,0.08)' }}>
                      <p className="text-center" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: '1.4rem', color: accent }}>₹500</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded-sm" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,18,8,0.1)', width: '90%' }} />
                      <div className="h-1.5 rounded-sm" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,18,8,0.1)', width: '70%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-20 lg:py-28" style={{ background: sectionBg, position: 'relative', zIndex: 1 }}>
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-6 lg:px-10 text-center">
          <h2 style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: fg, letterSpacing: '-0.02em' }}>
            The same struggle, everywhere
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: subFg }}>
            Whether it's a Ganeshotsav mandal, a church building fund, a mosque charity drive, or a
            neighborhood cultural association — the process is the same everywhere: one receipt book
            passed between volunteers, torn pages, and a treasurer reconciling cash and payment
            screenshots by hand before the event even starts.
          </p>
          <div className="mt-12 grid sm:grid-cols-3 gap-6 lg:gap-8 text-left">
            {[
              { h: 'One book, many hands', b: "A single physical book moves between several volunteers going door to door — no one has the full picture until it's copied back by hand.", emoji: '📖' },
              { h: "Cash and digital don't match", b: 'Cash entries and payment screenshots pile up separately. Matching them to receipt numbers at month-end takes days.', emoji: '🧾' },
              { h: 'Donors want proof they can keep', b: 'A hand-written slip is easy to lose. Donors increasingly expect something they can keep on their phone.', emoji: '📱' },
            ].map((c, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: cardGlow,
                  backdropFilter: isDark ? 'blur(12px)' : 'none',
                }}
              >
                {isDark && (
                  <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(232,101,10,0.12)', border: '1px solid rgba(232,101,10,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontSize: '1rem' }}>
                    {c.emoji}
                  </div>
                )}
                <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, marginBottom: '0.5rem', color: fg }}>{c.h}</p>
                <p className="text-sm leading-relaxed" style={{ color: subFg }}>{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 lg:py-28" style={{ position: 'relative', zIndex: 1 }}>
        <div className="max-w-5xl xl:max-w-6xl mx-auto px-6 lg:px-10">
          <h2 className="text-center mb-16" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: fg, letterSpacing: '-0.02em' }}>
            The actual flow — three steps
          </h2>
          <div className="relative">
            <div
              className="hidden md:block absolute top-8 left-[16.5%] right-[16.5%] h-px"
              style={{ background: isDark ? 'linear-gradient(90deg, transparent, rgba(232,101,10,0.4), rgba(196,154,60,0.4), transparent)' : `rgba(196,154,60,0.4)` }}
            />
            <div className="grid md:grid-cols-3 gap-10">
              {[
                { step: 'Step 1', h: 'Register, get your link', b: 'The organizer registers once. You instantly get a public donation link and a printable QR code for the event.' },
                { step: 'Step 2', h: 'Collect donations, any way donors prefer', b: 'Volunteers share the link on WhatsApp or in person, or the donor scans the QR and pays digitally, or a collector records a cash donation on the spot.' },
                { step: 'Step 3', h: 'Verify, receipt generates itself', b: 'The treasurer reviews the payment proof, confirms it, and a numbered digital receipt is generated automatically — no manual writing.' },
              ].map((s, i) => (
                <div key={i} className="relative text-center">
                  <div
                    className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center relative z-10"
                    style={{
                      background: isDark ? 'rgba(232,101,10,0.1)' : cardBg,
                      border: `2px solid ${accent}`,
                      boxShadow: isDark ? `0 0 20px rgba(232,101,10,0.25)` : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 800, color: accent, fontSize: '1.1rem' }}>{i + 1}</span>
                  </div>
                  <p className="text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: isDark ? '#fb923c' : gold, fontFamily: 'var(--font-poppins)' }}>{s.step}</p>
                  <p className="mb-2" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, color: fg }}>{s.h}</p>
                  <p className="text-sm leading-relaxed" style={{ color: subFg }}>{s.b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RECEIPT SHOWCASE */}
      <section
        className="py-20 lg:py-28 relative overflow-hidden"
        style={{ background: isDark ? '#060a14' : '#1A1208' }}
      >
        {/* Section glow */}
        {isDark && (
          <div style={{ position: 'absolute', top: '50%', left: '30%', transform: 'translateY(-50%)', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        )}
        <div className="max-w-5xl xl:max-w-6xl mx-auto px-6 lg:px-10 grid md:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
          <div>
            <h2 className="mb-4" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Still looks like a receipt, just digital now
            </h2>
            <p className="mb-6 leading-relaxed" style={{ color: 'rgba(203,213,225,0.75)' }}>
              Every field your donors already recognize is still there — organization name, receipt
              number, donor name, amount, date — so it still feels official. The difference: it reaches
              them on WhatsApp in two seconds, and it's numbered automatically so nothing goes missing.
            </p>
            <ul className="space-y-3 text-sm">
              {['Auto-numbered receipts, no duplicates possible', 'PDF, downloadable and shareable on WhatsApp', 'Full ledger for the treasurer, exportable anytime'].map(item => (
                <li key={item} className="flex items-center gap-2.5" style={{ color: 'rgba(203,213,225,0.8)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent, flexShrink: 0, boxShadow: isDark ? '0 0 6px rgba(232,101,10,0.6)' : 'none' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            <div
              className="w-72 rounded-2xl p-6 shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
              style={{
                background: isDark ? 'rgba(15,20,35,0.9)' : '#FDF8F3',
                border: isDark ? '1px solid rgba(232,101,10,0.15)' : 'none',
                boxShadow: isDark ? '0 0 0 1px rgba(232,101,10,0.1), 0 25px 60px rgba(0,0,0,0.5)' : '0 25px 60px rgba(0,0,0,0.3)',
                backdropFilter: isDark ? 'blur(20px)' : 'none',
              }}
            >
              <div className="text-center border-b pb-3 mb-4" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,18,8,0.15)' }}>
                <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, color: isDark ? '#f1f5f9' : '#1A1208' }}>Riverside Community Fund</p>
                <p className="text-xs mt-0.5" style={{ color: isDark ? '#64748b' : '#7a6a55' }}>Donation Receipt · No. CF24-0812</p>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span style={{ color: isDark ? '#64748b' : '#7a6a55' }}>Donor</span><span style={{ color: isDark ? '#e2e8f0' : '#1A1208', fontWeight: 500 }}>A. Fernandes</span></div>
                <div className="flex justify-between"><span style={{ color: isDark ? '#64748b' : '#7a6a55' }}>Amount</span><span style={{ fontWeight: 700, color: accent, fontSize: '1rem' }}>₹500</span></div>
                <div className="flex justify-between"><span style={{ color: isDark ? '#64748b' : '#7a6a55' }}>Method</span><span style={{ color: isDark ? '#e2e8f0' : '#1A1208' }}>Digital</span></div>
                <div className="flex justify-between"><span style={{ color: isDark ? '#64748b' : '#7a6a55' }}>Date</span><span style={{ color: isDark ? '#e2e8f0' : '#1A1208' }}>12 Jul 2026</span></div>
              </div>
              <div
                className="mt-4 pt-3 text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                style={{ borderTop: isDark ? '1px dashed rgba(255,255,255,0.08)' : '1px dashed rgba(26,18,8,0.2)', color: '#22c55e' }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px rgba(34,197,94,0.6)' }} />
                Verified Receipt
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 lg:py-28" style={{ position: 'relative', zIndex: 1 }}>
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="mb-3" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: fg, letterSpacing: '-0.02em' }}>
            Simple pricing, no hidden charges
          </h2>
          <p className="mb-14" style={{ color: subFg }}>Flat monthly or yearly subscription. We never take a cut from donations.</p>
          <div className="grid sm:grid-cols-3 gap-6 lg:gap-8 text-left max-w-3xl mx-auto items-stretch">
            {[
              {
                plan: 'Trial',
                amount: 'Free',
                period: '30 days',
                features: ['1 active event', 'Up to 3 collectors', 'PDF receipts', 'Admin dashboard'],
                featured: false,
              },
              {
                plan: 'Basic',
                amount: '₹299',
                period: 'per month',
                features: ['1 active event', 'Up to 5 collectors', 'PDF receipts', 'Public donation link', 'Donation reports'],
                featured: true,
                popular: true,
              },
              {
                plan: 'Standard',
                amount: '₹599',
                period: 'per month',
                features: ['3 active events', 'Unlimited collectors', 'Everything in Basic', 'CSV export', 'Priority support'],
                featured: false,
              },
            ].map((p) => (
              <div
                key={p.plan}
                className="p-8 rounded-2xl relative flex flex-col justify-between transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: p.featured
                    ? isDark ? 'linear-gradient(135deg, #0f172a, #1e1030)' : '#1A1208'
                    : isDark ? cardBg : sectionBg,
                  border: p.featured
                    ? isDark ? '1px solid rgba(232,101,10,0.3)' : 'none'
                    : `1px solid ${cardBorder}`,
                  color: p.featured ? '#FDF8F3' : fg,
                  boxShadow: p.featured && isDark
                    ? '0 0 0 1px rgba(232,101,10,0.15), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(232,101,10,0.1)'
                    : isDark ? cardGlow : 'none',
                  backdropFilter: isDark && !p.featured ? 'blur(12px)' : 'none',
                }}
              >
                {p.popular && (
                  <span
                    className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: isDark ? 'linear-gradient(135deg, #E8650A, #f97316)' : accent,
                      color: '#fff',
                      boxShadow: isDark ? '0 0 12px rgba(232,101,10,0.4)' : 'none',
                    }}
                  >
                    Most popular
                  </span>
                )}
                <div>
                  <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: p.featured ? (isDark ? '#fb923c' : 'rgba(253,248,243,0.6)') : mutedFg }}>{p.plan}</p>
                  <p className="my-2" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 800, fontSize: '2.25rem', letterSpacing: '-0.03em' }}>{p.amount}</p>
                  <p className="text-sm mb-6" style={{ opacity: 0.55 }}>{p.period}</p>
                  <ul className="text-sm space-y-2 mb-8">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <span style={{ color: p.featured ? (isDark ? '#fb923c' : '#fbbf24') : accent, fontSize: '0.75rem', fontWeight: 700 }}>✓</span>
                        <span style={{ color: p.featured ? 'rgba(241,245,249,0.85)' : subFg }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href="/register"
                  className="block w-full text-center px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 hover:scale-105"
                  style={{
                    background: p.featured
                      ? isDark ? 'linear-gradient(135deg, #E8650A, #f97316)' : accent
                      : isDark ? 'rgba(255,255,255,0.07)' : fg,
                    color: '#FDF8F3',
                    fontFamily: 'var(--font-poppins)',
                    border: isDark && !p.featured ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    boxShadow: p.featured && isDark ? '0 0 16px rgba(232,101,10,0.35)' : 'none',
                  }}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REGISTER CTA */}
      <section
        id="register"
        className="py-24 lg:py-32 relative overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0f172a 0%, #1a0a00 50%, #0f172a 100%)'
            : accent,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {isDark && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(232,101,10,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,101,10,0.15) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
          </>
        )}
        <div className="max-w-xl lg:max-w-2xl mx-auto px-6 text-center relative z-10">
          <h2 className="mb-3" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', color: '#f8fafc', letterSpacing: '-0.02em' }}>
            Register your organization today
          </h2>
          <p className="mb-8" style={{ color: isDark ? 'rgba(203,213,225,0.8)' : 'rgba(253,248,243,0.9)' }}>
            Set up in under two minutes. Get your donation link the same day.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 items-start" onSubmit={handleRegisterSubmit}>
            <div className="flex-1 w-full flex flex-col gap-2">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Enter your organization's name"
                className="w-full px-5 py-3.5 rounded-full outline-none text-sm transition-all duration-200"
                style={{
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  color: '#1A1208',
                  background: isDark ? 'rgba(255,255,255,0.9)' : '#FFFFFF',
                  boxShadow: isDark ? '0 0 0 0 transparent' : 'none',
                }}
              />
              <p className="text-xs text-center" style={{ color: isDark ? 'rgba(148,163,184,0.8)' : 'rgba(253,248,243,0.75)' }}>
                No credit card required · Free to start
              </p>
            </div>
            <button
              type="submit"
              className="px-7 py-3.5 rounded-full font-bold transition-all duration-200 hover:scale-105 active:scale-95 w-full sm:w-auto cursor-pointer"
              style={{
                background: isDark ? 'linear-gradient(135deg, #E8650A, #f97316)' : '#1A1208',
                color: '#FDF8F3',
                fontFamily: 'var(--font-poppins)',
                boxShadow: isDark ? '0 0 20px rgba(232,101,10,0.5)' : 'none',
              }}
            >
              Get started
            </button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10" style={{ background: isDark ? '#04060b' : '#1A1208' }}>
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, color: '#FDF8F3' }}>
            Intelli<span style={{ color: accent }}>don</span>
          </span>
          <p className="text-xs" style={{ color: 'rgba(253,248,243,0.5)' }}>
            © 2026 Intellidon · Built for community organizations everywhere
          </p>
        </div>
      </footer>
    </div>
  );
}
