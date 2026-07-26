'use client'

import Link from 'next/link'

export default function TermsAndConditionsPage() {
  const effectiveDate = 'July 1, 2026'
  const companyName = 'Intellidon'
  const contactEmail = 'intellidon26+leagal@gmail.com'
  const contactAddress = 'Mumbai, Maharashtra, India'

  return (
    <div className="min-h-screen bg-[#FDF8F3] text-[#1A1208]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-[#1A1208]/08 bg-[#FDF8F3]/90 px-6 py-4 flex items-center justify-between">
        <Link href="/" style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: '1.2rem', color: '#E8650A' }}>
          Intelli<span style={{ color: '#1A1208' }}>don</span>
        </Link>
        <Link href="/" className="text-sm text-[#1A1208]/60 hover:text-[#E8650A] transition-colors">
          ← Back to Home
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="inline-block bg-[#E8650A]/10 text-[#E8650A] text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
            Legal Document
          </div>
          <h1 className="text-3xl font-bold text-[#1A1208] mb-3">Terms and Conditions</h1>
          <p className="text-sm text-[#5C4A30]">
            Effective Date: <strong>{effectiveDate}</strong> &nbsp;·&nbsp; Last Updated: <strong>{effectiveDate}</strong>
          </p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800 font-medium">
              ⚠ BETA / TESTING NOTICE: Intellidon is currently in active development and testing phase.
              Features may change, be unavailable, or behave unexpectedly. Use at your own risk.
              Data loss, downtime, or service interruptions may occur without prior notice.
            </p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-[#1A1208]">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              By accessing, registering on, or using the Intellidon platform, website, mobile application, or any associated services (collectively, the <strong>"Platform"</strong>), you (<strong>"User"</strong>, <strong>"Organisation"</strong>, or <strong>"Mandal"</strong>) agree to be legally bound by these Terms and Conditions (<strong>"Terms"</strong>). If you do not agree with any part of these Terms, you must immediately discontinue use of the Platform.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              These Terms constitute a binding legal agreement between you and <strong>Intellidon</strong>, a software product operated and owned by its founding team, with principal place of operation in Mumbai, Maharashtra, India.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              By clicking "Register," "Submit," "I Agree," or by continuing to use the Platform, you confirm that you have read, understood, and accepted these Terms in full.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">2. Platform Description & Architecture</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              Intellidon is a specialized digital management software-as-a-service (SaaS) platform designed for community organisations, festival mandals, cultural associations, and non-profit entities (<strong>"Organisations"</strong>).
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              The Platform provides integrated management modules including:
            </p>
            <ul className="text-sm text-[#3A2E1E] space-y-1.5 mt-2 ml-4 list-disc">
              <li><strong>Donation Management & Dynamic UPI QR:</strong> Recording cash and online donations, generating dynamic UPI QR codes mapped to Organisation accounts, and producing instant PDF donation receipts for donor distribution (including WhatsApp sharing).</li>
              <li><strong>Field Collector Management:</strong> Authorising field collectors, setting collection targets, and tracking daily cash and UPI settlements and handovers.</li>
              <li><strong>Event Lifecycle & Expense Tracking:</strong> Creating festival/event projects, logging category-wise expenses, uploading vendor invoices, and managing vendor payments.</li>
              <li><strong>Sponsorship Management:</strong> Tracking sponsor leads, tier packages (Bronze, Silver, Gold, Platinum), payment schedules, and benefit fulfillment checklists.</li>
              <li><strong>Mandal Verification (KYC):</strong> Uploading organizational and administrator verification documents for Super Admin audit.</li>
              <li><strong>Subscription Tiers:</strong> Tiered feature access (Free, Pro, Premium) governing organizational limits.</li>
            </ul>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-3 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              <strong>INTELLIDON IS NOT A PAYMENT GATEWAY, PAYMENT AGGREGATOR, BANK, OR FINANCIAL INSTITUTION.</strong> Intellidon does not hold, process, escrow, or intermediate monetary transactions between Donors and Organisations. All financial transactions occur directly between the Donor and the Organisation via direct Cash or direct UPI transfer to the Organisation's designated bank account.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">3. Beta / Testing Phase Disclaimer</h2>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">THIS IS A BETA / TESTING PRODUCT. PLEASE READ THIS SECTION CAREFULLY.</p>
              <p className="text-sm leading-relaxed text-red-700">
                3.1 The Platform is currently in a beta testing phase and is provided strictly on an <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> basis without any warranties of any kind, express or implied.
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                3.2 <strong>Data loss may occur at any time.</strong> Intellidon and its developers, founders, employees, agents, and affiliates shall bear absolutely no responsibility or liability whatsoever for any loss, corruption, deletion, or inaccessibility of data, including but not limited to donation records, receipt histories, collector settlements, event expenses, sponsor records, uploaded KYC documents, or any other content stored on the Platform.
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                3.3 The Platform may experience downtime, bugs, calculation errors, security vulnerabilities, incorrect PDF rendering, or complete service failure at any time without prior notice.
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                3.4 Features of the Platform may be added, modified, suspended, or permanently removed at the sole discretion of Intellidon at any time without notice or liability.
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                3.5 Any receipts, financial summaries, expense reports, or audit logs generated during the beta phase should not be solely relied upon for official tax exemptions (e.g. 80G), GST compliance, or legal audit purposes. Organisations are strongly advised to maintain independent physical receipt books and bank statements.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">4. Registration and Account Obligations</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              4.1 To access the Platform, Organisations must complete the registration form and create an Administrator account. Registration requires submission of accurate organizational details, administrator contact details, pincode, and verification documents.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              4.2 You represent and warrant that all information provided during registration and thereafter is true, accurate, complete, and up to date. Providing false, misleading, or fraudulent information is a material breach of these Terms and will result in immediate account termination and potential reporting to law enforcement.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              4.3 You are solely responsible for maintaining the security of your login credentials and for all activities that occur under your Mandal account (including activities by added collectors and team members). You must immediately notify Intellidon of any unauthorized account access.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              4.4 Intellidon Super Administrators reserve the right to approve, reject, suspend, or permanently terminate any Mandal account at their sole discretion without prior notice or liability.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">5. KYC Verification & Mandal Onboarding</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              5.1 To prevent fraud and illegal fundraising, Intellidon requires Organisations to submit Know Your Customer (KYC) documentation, which may include:
            </p>
            <ul className="text-sm text-[#3A2E1E] space-y-1 mt-2 ml-4 list-disc">
              <li>Administrator Aadhaar Card</li>
              <li>Bank Account Proof (cancelled cheque or passbook front page)</li>
              <li>Authorisation Letter / Committee Resolution signed by office bearers</li>
              <li>Address Proof (utility bill, rent agreement, or property document)</li>
              <li>Registration Certificate (for registered trusts/societies)</li>
              <li>Administrator & Organisation PAN Cards</li>
            </ul>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              5.2 Submission of KYC documents does not guarantee approval. Intellidon Super Administrators inspect submitted documents and retain sole discretion over approval, rejection, or resubmission requests.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              5.3 KYC documents are stored in access-controlled private cloud storage. However, given the beta status of the Platform, Intellidon disclaims liability for any security breaches or unauthorized access to uploaded verification files.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">6. Collector Operations & Field Settlements</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              6.1 Organisations may create and assign Field Collector logins to volunteers or committee members to record donations in the field.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              6.2 Organisations are solely responsible for supervising their collectors, verifying cash handovers, confirming UPI transaction screenshots, and conducting daily settlement reconciliations.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              6.3 Intellidon is not responsible or liable for any theft, misappropriation, unrecorded cash collections, or disputes between an Organisation and its field collectors.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">7. Donor Data, Receipts & WhatsApp Messaging</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              7.1 Organisations and their collectors are solely responsible for ensuring the accuracy of donor information (name, phone, donation amount, payment mode) entered into the Platform.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              7.2 Digital PDF receipts generated by the Platform reflect data inputted by the Mandal. Intellidon does not verify donor identities or guarantee the legal or tax exemption status of receipts.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              7.3 Sharing receipts via WhatsApp or messaging links is initiated directly by the User or Mandal. Organisations must ensure they have donor consent to communicate via phone numbers provided, in compliance with applicable laws including the Digital Personal Data Protection Act, 2023 (India).
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">8. Event Expenses & Sponsorship Management</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              8.1 Expense tracking tools and vendor receipt uploads provided on the Platform are internal organizational record-keeping utilities only.
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              8.2 Sponsorship tracking features (package tiers, payment statuses, and benefit checklists) serve as internal coordination tools. Intellidon is not a party to any sponsorship contract or commercial agreement between an Organisation and its sponsors.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">9. Subscription Plans & Payments</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              9.1 Access to advanced features (such as higher collector counts, multi-event tracking, and custom receipt branding) may require an active paid subscription (Free, Pro, Premium).
            </p>
            <p className="text-sm leading-relaxed text-[#3A2E1E] mt-2">
              9.2 Subscription fees are non-refundable unless explicitly agreed in writing by Intellidon. Subscription payment does not guarantee 100% uptime or zero data loss during the beta phase.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">10. Prohibited Uses</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">You must not use the Platform to:</p>
            <ul className="text-sm text-[#3A2E1E] space-y-1.5 mt-2 ml-4 list-disc">
              <li>Conduct unauthorized, deceptive, or illegal fundraising activities</li>
              <li>Collect donations under a false or misleading organization identity</li>
              <li>Bypass or hack Platform security, database permissions, or API endpoints</li>
              <li>Misuse donor or collector personal data in violation of privacy laws</li>
              <li>Upload malicious code, invalid files, or corrupt invoices</li>
              <li>Engage in money laundering, financial fraud, or illegal financial activities</li>
              <li>Attempt to reverse-engineer, clone, or copy the Intellidon codebase</li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">11. Intellectual Property</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              All source code, UI designs, brand assets, logos, and features of Intellidon remain the exclusive intellectual property of Intellidon and its creators. Users receive a limited, revocable, non-transferable licence to use the Platform strictly for internal donation management.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">12. Limitation of Liability</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 space-y-2">
              <p className="text-sm leading-relaxed text-[#3A2E1E]">
                To the maximum extent permitted by applicable law, <strong>Intellidon and its developers, founders, and affiliates shall not be liable for any direct, indirect, incidental, or consequential damages</strong> (including loss of donation data, missed payments, system downtime, or receipt errors) arising out of your use of the Platform. Total aggregate liability is limited to the subscription fees paid by you in the preceding 3 months or ₹500, whichever is lower. During the beta phase, liability is excluded to the fullest extent permitted by law.
              </p>
            </div>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">13. Governing Law & Dispute Resolution</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              These Terms are governed by the laws of India. Any legal disputes shall be subject to the exclusive jurisdiction of the courts located in <strong>Mumbai, Maharashtra, India</strong>. Before initiating legal proceedings, users agree to attempt informal resolution by contacting Intellidon at {contactEmail}.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-[#E8650A]/5 border border-[#E8650A]/20 rounded-xl p-5">
            <h2 className="text-lg font-bold text-[#1A1208] mb-3">14. Contact Information</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              For questions or notices regarding these Terms and Conditions, please contact:
            </p>
            <div className="mt-3 space-y-1 text-sm text-[#3A2E1E]">
              <p><strong>Intellidon Legal Department</strong></p>
              <p>{contactAddress}</p>
              <p>Email: <a href={`mailto:${contactEmail}`} className="text-[#E8650A] hover:underline">{contactEmail}</a></p>
            </div>
          </section>

          {/* Footer note */}
          <div className="border-t border-[#1A1208]/10 pt-6 text-center">
            <p className="text-xs text-[#9C8870]">
              By using Intellidon, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </p>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs">
              <Link href="/privacy" className="text-[#E8650A] hover:underline">Privacy Policy</Link>
              <span className="text-[#9C8870]">·</span>
              <Link href="/" className="text-[#E8650A] hover:underline">Back to Home</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
