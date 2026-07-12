'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Poppins, Inter } from 'next/font/google';
import { supabase } from '@/lib/supabase';

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

  return (
    <div className={`${poppins.variable} ${inter.variable}`} style={{ fontFamily: 'var(--font-inter)', background: '#FDF8F3', color: '#1A1208' }}>

      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(253,248,243,0.85)', borderBottom: '1px solid rgba(26,18,8,0.08)' }}>
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: '1.25rem', color: '#E8650A' }}>
            Intelli<span style={{ color: '#1A1208' }}>don</span>
          </span>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1 text-sm">
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: lang === l ? 'rgba(232,101,10,0.12)' : 'transparent',
                    color: lang === l ? '#E8650A' : '#7a6a55',
                    fontWeight: lang === l ? 600 : 400,
                  }}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
            {isLoggedIn ? (
              <Link
                href={dashboardPath}
                className="px-5 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                style={{ background: '#E8650A', color: '#FDF8F3', fontFamily: 'var(--font-poppins)' }}
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold hover:text-[#E8650A] transition-colors"
                  style={{ color: '#1A1208', fontFamily: 'var(--font-poppins)' }}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:inline-block px-5 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                  style={{ background: '#E8650A', color: '#FDF8F3', fontFamily: 'var(--font-poppins)' }}
                >
                  {t.navCta}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-32 -right-32 w-[32rem] h-[32rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #E8650A 0%, transparent 70%)' }}
        />
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-20 md:pt-24 md:pb-28 lg:pt-28 lg:pb-32 relative">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p
                className="inline-block mb-5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
                style={{ background: 'rgba(196,154,60,0.15)', color: '#8a6a20', fontFamily: 'var(--font-poppins)' }}
              >
                {t.badge}
              </p>
              <h1
                className="leading-tight mb-3 whitespace-pre-line"
                style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 4rem)', color: '#1A1208' }}
              >
                {t.headline}
              </h1>
              <p className="text-lg md:text-xl mb-8 max-w-xl" style={{ color: '#4a3d2c' }}>
                {t.sub}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  className="px-7 py-3.5 rounded-full text-center font-semibold transition-transform hover:scale-105"
                  style={{ background: '#E8650A', color: '#FDF8F3', fontFamily: 'var(--font-poppins)' }}
                >
                  {t.cta}
                </Link>
                <a
                  href="#how-it-works"
                  className="px-7 py-3.5 rounded-full text-center font-semibold border-2 transition-colors"
                  style={{ borderColor: '#1A1208', color: '#1A1208', fontFamily: 'var(--font-poppins)' }}
                >
                  {t.ctaSecondary}
                </a>
              </div>
              <p className="mt-4 text-sm" style={{ color: '#7a6a55' }}>
                {t.trust}
              </p>
            </div>

            {/* Hero visual */}
            <div className="relative h-[420px] lg:h-[480px] flex items-center justify-center lg:scale-110">
              <div
                className="absolute w-56 h-72 rounded-sm shadow-xl"
                style={{
                  background: '#F1E4C8',
                  transform: 'rotate(-9deg) translateX(-70px)',
                  border: '1px solid rgba(26,18,8,0.15)',
                  boxShadow: '4px 8px 24px rgba(26,18,8,0.25)',
                }}
              >
                <div className="p-4">
                  <div className="text-center border-b pb-2 mb-3" style={{ borderColor: 'rgba(26,18,8,0.2)' }}>
                    <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: '0.85rem' }}>Community Fund</p>
                    <p className="text-[0.65rem]" style={{ color: '#7a6a55' }}>Donation Receipt Book</p>
                  </div>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-2 mb-2.5 rounded-sm" style={{ background: 'rgba(26,18,8,0.15)', width: `${85 - i * 6}%` }} />
                  ))}
                </div>
              </div>
              <div className="absolute z-10 text-3xl" style={{ color: '#C49A3C' }}>→</div>
              <div
                className="absolute w-56 rounded-[1.75rem] shadow-2xl overflow-hidden"
                style={{
                  transform: 'rotate(6deg) translateX(70px)',
                  background: '#1A1208',
                  padding: '10px',
                  boxShadow: '0 20px 45px rgba(26,18,8,0.35)',
                }}
              >
                <div className="rounded-[1.25rem] overflow-hidden" style={{ background: '#FDF8F3' }}>
                  <div className="p-4">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#2D6A4F', color: '#fff' }}>✓</div>
                    </div>
                    <p className="text-center text-xs font-semibold mb-1" style={{ fontFamily: 'var(--font-poppins)' }}>Receipt confirmed</p>
                    <p className="text-center text-[0.6rem] mb-3" style={{ color: '#7a6a55' }}>Receipt No. CF24-0812</p>
                    <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(232,101,10,0.08)' }}>
                      <p className="text-center" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: '1.4rem', color: '#E8650A' }}>₹500</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded-sm" style={{ background: 'rgba(26,18,8,0.1)', width: '90%' }} />
                      <div className="h-1.5 rounded-sm" style={{ background: 'rgba(26,18,8,0.1)', width: '70%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-20 lg:py-28" style={{ background: '#F5EDE2' }}>
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-6 lg:px-10 text-center">
          <h2 style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
            The same struggle, everywhere
          </h2>
          <p className="mt-4 text-lg" style={{ color: '#4a3d2c' }}>
            Whether it's a Ganeshotsav mandal, a church building fund, a mosque charity drive, or a
            neighborhood cultural association — the process is the same everywhere: one receipt book
            passed between volunteers, torn pages, and a treasurer reconciling cash and payment
            screenshots by hand before the event even starts.
          </p>
          <div className="mt-10 grid sm:grid-cols-3 gap-6 lg:gap-8 text-left">
            {[
              { h: 'One book, many hands', b: "A single physical book moves between several volunteers going door to door — no one has the full picture until it's copied back by hand." },
              { h: 'Cash and digital don\'t match', b: 'Cash entries and payment screenshots pile up separately. Matching them to receipt numbers at month-end takes days.' },
              { h: 'Donors want proof they can keep', b: 'A hand-written slip is easy to lose. Donors increasingly expect something they can keep on their phone.' },
            ].map((c, i) => (
              <div key={i} className="p-6 rounded-2xl" style={{ background: '#FDF8F3', border: '1px solid rgba(26,18,8,0.08)' }}>
                <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, marginBottom: '0.5rem' }}>{c.h}</p>
                <p className="text-sm" style={{ color: '#4a3d2c' }}>{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 lg:py-28">
        <div className="max-w-5xl xl:max-w-6xl mx-auto px-6 lg:px-10">
          <h2 className="text-center mb-14" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
            The actual flow — three steps
          </h2>
          <div className="relative">
            <div className="hidden md:block absolute top-8 left-[16.5%] right-[16.5%] h-0.5" style={{ background: 'rgba(196,154,60,0.4)' }} />
            <div className="grid md:grid-cols-3 gap-10">
              {[
                { step: 'Step 1', h: 'Register, get your link', b: 'The organizer registers once. You instantly get a public donation link and a printable QR code for the event.' },
                { step: 'Step 2', h: 'Collect donations, any way donors prefer', b: 'Volunteers share the link on WhatsApp or in person, or the donor scans the QR and pays digitally, or a collector records a cash donation on the spot.' },
                { step: 'Step 3', h: 'Verify, receipt generates itself', b: 'The treasurer reviews the payment proof, confirms it, and a numbered digital receipt is generated automatically — no manual writing.' },
              ].map((s, i) => (
                <div key={i} className="relative text-center">
                  <div
                    className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center relative z-10"
                    style={{ background: '#FDF8F3', border: '2px solid #E8650A' }}
                  >
                    <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, color: '#E8650A' }}>{i + 1}</span>
                  </div>
                  <p className="text-xs font-semibold mb-1 tracking-wide" style={{ color: '#C49A3C', fontFamily: 'var(--font-poppins)' }}>{s.step}</p>
                  <p className="mb-2" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600 }}>{s.h}</p>
                  <p className="text-sm" style={{ color: '#4a3d2c' }}>{s.b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RECEIPT SHOWCASE */}
      <section className="py-20 lg:py-28" style={{ background: '#1A1208' }}>
        <div className="max-w-5xl xl:max-w-6xl mx-auto px-6 lg:px-10 grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <h2 className="mb-4" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: '#FDF8F3' }}>
              Still looks like a receipt, just digital now
            </h2>
            <p className="mb-6" style={{ color: 'rgba(253,248,243,0.75)' }}>
              Every field your donors already recognize is still there — organization name, receipt
              number, donor name, amount, date — so it still feels official. The difference: it reaches
              them on WhatsApp in two seconds, and it's numbered automatically so nothing goes missing.
            </p>
            <ul className="space-y-2 text-sm" style={{ color: 'rgba(253,248,243,0.75)' }}>
              <li>• Auto-numbered receipts, no duplicates possible</li>
              <li>• PDF, downloadable and shareable on WhatsApp</li>
              <li>• Full ledger for the treasurer, exportable anytime</li>
            </ul>
          </div>
          <div className="flex justify-center">
            <div className="w-72 rounded-2xl p-6 shadow-2xl" style={{ background: '#FDF8F3' }}>
              <div className="text-center border-b pb-3 mb-4" style={{ borderColor: 'rgba(26,18,8,0.15)' }}>
                <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700 }}>Riverside Community Fund</p>
                <p className="text-xs" style={{ color: '#7a6a55' }}>Donation Receipt · No. CF24-0812</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span style={{ color: '#7a6a55' }}>Donor</span><span>A. Fernandes</span></div>
                <div className="flex justify-between"><span style={{ color: '#7a6a55' }}>Amount</span><span style={{ fontWeight: 700, color: '#E8650A' }}>₹500</span></div>
                <div className="flex justify-between"><span style={{ color: '#7a6a55' }}>Method</span><span>Digital</span></div>
                <div className="flex justify-between"><span style={{ color: '#7a6a55' }}>Date</span><span>12 Jul 2026</span></div>
              </div>
              <div className="mt-4 pt-3 text-center text-xs" style={{ borderTop: '1px dashed rgba(26,18,8,0.2)', color: '#2D6A4F' }}>
                ✓ Verified
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="mb-3" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
            Simple pricing, no hidden charges
          </h2>
          <p className="mb-12" style={{ color: '#4a3d2c' }}>Flat monthly or yearly subscription. We never take a cut from donations.</p>
          <div className="grid sm:grid-cols-3 gap-6 lg:gap-8 text-left max-w-3xl mx-auto">
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
                className="p-8 rounded-2xl relative"
                style={{
                  background: p.featured ? '#1A1208' : '#F5EDE2',
                  border: p.featured ? 'none' : '1px solid rgba(26,18,8,0.08)',
                  color: p.featured ? '#FDF8F3' : '#1A1208',
                }}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#E8650A', color: '#FDF8F3' }}>
                    Most popular
                  </span>
                )}
                <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: '0.95rem', opacity: p.featured ? 0.7 : 1 }}>{p.plan}</p>
                <p className="my-2" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: '2rem' }}>{p.amount}</p>
                <p className="text-sm mb-5" style={{ opacity: 0.6 }}>{p.period}</p>
                <ul className="text-sm space-y-1.5 mb-6" style={{ opacity: p.featured ? 0.8 : 0.75 }}>
                  {p.features.map(f => <li key={f}>• {f}</li>)}
                </ul>
                <Link
                  href="/register"
                  className="block w-full text-center px-5 py-2.5 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                  style={{
                    background: p.featured ? '#E8650A' : '#1A1208',
                    color: '#FDF8F3',
                    fontFamily: 'var(--font-poppins)',
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
      <section id="register" className="py-24 lg:py-32" style={{ background: '#E8650A' }}>
        <div className="max-w-xl lg:max-w-2xl mx-auto px-6 text-center">
          <h2 className="mb-3" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', color: '#FDF8F3' }}>
            Register your organization today
          </h2>
          <p className="mb-8" style={{ color: 'rgba(253,248,243,0.9)' }}>
            Set up in under two minutes. Get your donation link the same day.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 items-start" onSubmit={handleRegisterSubmit}>
            <div className="flex-1 w-full flex flex-col gap-2">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Enter your organization's name"
                className="w-full px-5 py-3.5 rounded-full outline-none text-sm"
                style={{ border: 'none', color: '#1A1208', background: '#FFFFFF' }}
              />
              <p className="text-xs text-center" style={{ color: 'rgba(253,248,243,0.75)' }}>
                No credit card required · Free to start
              </p>
            </div>
            <button
              type="submit"
              className="px-7 py-3.5 rounded-full font-semibold transition-transform hover:scale-105 w-full sm:w-auto"
              style={{ background: '#1A1208', color: '#FDF8F3', fontFamily: 'var(--font-poppins)' }}
            >
              Get started
            </button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10" style={{ background: '#1A1208' }}>
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, color: '#FDF8F3' }}>
            Intelli<span style={{ color: '#E8650A' }}>don</span>
          </span>
          <p className="text-xs" style={{ color: 'rgba(253,248,243,0.5)' }}>
            © 2026 Intellidon · Built for community organizations everywhere
          </p>
        </div>
      </footer>
    </div>
  );
}