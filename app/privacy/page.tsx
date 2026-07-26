'use client'

import Link from 'next/link'

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-bold text-[#1A1208] mb-3">Privacy Policy</h1>
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

        <p className="mb-8 text-sm leading-relaxed font-semibold text-[#3A2E1E] bg-[#E8650A]/5 border border-[#E8650A]/20 rounded-xl p-4">
          PLEASE READ THIS PRIVACY POLICY CAREFULLY BEFORE USING THE PLATFORM. THIS IS A TEST /
          BETA PRODUCT. BY ACCESSING OR USING THE PLATFORM (“Platform”, “Service”), OPERATED BY
          INTELLIDON (“Intellidon”, “Company”, “we”, “us”, “our”), YOU ACKNOWLEDGE THAT YOU HAVE
          READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THIS PRIVACY POLICY IN FULL.
        </p>

        <div className="prose prose-sm max-w-none space-y-8 text-[#1A1208]">

          <Section title="1. Testing / Beta Status of the Platform">
            <p>
              The Platform is currently provided in a <strong>testing, beta, or pre-release
              capacity</strong>. It is not a finished commercial product and may contain bugs,
              errors, incomplete features, or unstable functionality. Data handling practices
              described in this Policy may change without notice as the Platform evolves.
            </p>
            <p>
              You acknowledge and accept that use of a testing product carries inherent risk,
              including risk of data loss, data corruption, unauthorized access, or service
              interruption, and you use the Platform entirely at your own risk.
            </p>
          </Section>

          <Section title="2. Information We Collect (Product Specific)">
            <p>Intellidon collects data necessary to operate donation tracking, receipt generation, event expense management, and Mandal verification:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Organisation & Administrator Identity:</strong> Mandal name, registration number, office address, city, state, pincode, contact phone number, designated UPI ID, and Administrator full name, email address, phone number, and password.
              </li>
              <li>
                <strong>Mandal Verification (KYC Documents):</strong> Scanned copies or images of Admin Aadhaar Card, Bank Account Proof (cancelled cheque/passbook), Committee Resolution / Authorisation Letter, Address Proof, Registration Certificate, and PAN Cards submitted for Super Admin verification.
              </li>
              <li>
                <strong>Field Collector Information:</strong> Collector full names, contact mobile numbers, daily collection targets, field donation logs, and cash/UPI settlement records.
              </li>
              <li>
                <strong>Donor & Donation Data:</strong> Donor full name, phone number, donation amount, payment mode (Cash/UPI), payment reference ID, city/location, and digital PDF receipt history.
              </li>
              <li>
                <strong>Event & Vendor Expense Data:</strong> Event titles, dates, budgets, expense line items, category classifications, vendor names, payment statuses, and uploaded vendor invoices/bills.
              </li>
              <li>
                <strong>Sponsor Information:</strong> Sponsor organization/brand name, contact person, phone number, email address, sponsorship tier, pledged amounts, payment schedules, and benefit fulfillment status.
              </li>
              <li>
                <strong>Technical & Device Data:</strong> IP address, device type, browser specifications, login timestamps, and session identifiers.
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Product Information">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>To register and verify Mandals via Super Admin KYC review.</li>
              <li>To generate dynamic UPI QR codes directly targeting the Organisation's bank account.</li>
              <li>To generate downloadable digital PDF donation receipts and enable WhatsApp/messaging receipt link sharing.</li>
              <li>To track field collector daily collections, target progress, and cash/UPI handovers.</li>
              <li>To manage event budgets, log vendor expenses, and maintain financial records for festival projects.</li>
              <li>To track sponsorship packages, payment statuses, and benefit delivery checklists.</li>
              <li>To enforce subscription tier limits (Free, Pro, Premium) and platform security.</li>
              <li>To debug software, improve user experience, and prevent illegal fundraising or fraudulent activities.</li>
            </ul>
          </Section>

          <Section title="4. Storage & Security of Sensitive Documents">
            <p>
              4.1 <strong>KYC Verification Files:</strong> Documents uploaded by Mandals (Aadhaar, bank proof, PAN, authorisation letters) are stored in secure, private cloud storage accessible solely by authorized Super Administrators for account verification.
            </p>
            <p className="mt-2">
              4.2 <strong>Public Donation Receipts:</strong> Generated donation PDF receipts are stored in access-controlled cloud storage to allow donors to view and download their receipts via direct link or QR scan.
            </p>
          </Section>

          <Section title="5. No Guarantee of Data Integrity or Availability">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                AS THIS IS A TESTING PRODUCT, INTELLIDON MAKES NO REPRESENTATION OR WARRANTY, EXPRESS
                OR IMPLIED, REGARDING THE ACCURACY, INTEGRITY, SECURITY, BACKUP, OR PERMANENT
                AVAILABILITY OF ANY DATA STORED ON THE PLATFORM.
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                Data — including but not limited to donation records, receipts, KYC documents, event
                data, collector settlements, and payment records — may be lost, altered, corrupted, or deleted due to
                software errors, database resets during testing, server infrastructure updates,
                maintenance activity, or any other cause.
              </p>
              <p className="text-sm font-semibold text-red-800">
                Intellidon, its developers, employees, contractors, and affiliates shall bear no
                responsibility or liability whatsoever for any data loss, corruption, or unavailability
                arising from use of this testing Platform. Users and organizations are solely
                responsible for independently maintaining their own records (including physical
                receipt books) during the testing period.
              </p>
            </div>
          </Section>

          <Section title="6. Data Sharing & Third-Party Integrations">
            <p>We share data strictly in the following scenarios:</p>
            <ul className="list-disc pl-6 space-y-1.5 mt-2">
              <li><strong>Direct UPI Apps & Banking:</strong> Displaying the Organisation's UPI ID allows donors' native UPI applications (such as GPay, PhonePe, Paytm, BHIM) to execute direct peer-to-peer transfers to the Organisation's bank account.</li>
              <li><strong>Mandal Super Admins & Committee Officers:</strong> Transaction, receipt, collector, expense, and sponsor data within a Mandal is accessible to that Mandal's authorized admins.</li>
              <li><strong>Intellidon Super Admins:</strong> For KYC document inspection, Mandal approval/rejection, and platform abuse monitoring.</li>
              <li><strong>WhatsApp / Messaging Links:</strong> Receipt links generated by the Platform may be shared via messaging apps directly by collectors or admins with donors.</li>
              <li><strong>Legal Compliance:</strong> When required by Indian law, court order, or governmental authorities.</li>
            </ul>
            <p className="mt-2 font-medium">
              Intellidon does not sell, rent, or trade donor or Mandal personal data to third parties for marketing purposes.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <p>
              During the beta testing phase, data may be retained, migrated, or purged at Intellidon's sole discretion without advance notice. Organisations are encouraged to download PDF reports and maintain independent backups.
            </p>
          </Section>

          <Section title="8. User Responsibilities">
            <ul className="list-disc pl-6 space-y-1">
              <li>Organisations and collectors are responsible for the accuracy of all donor entries and amounts.</li>
              <li>Organisations must obtain donor consent before recording details and sending digital receipts.</li>
              <li>Organisations are responsible for keeping independent physical receipt backups during testing.</li>
              <li>Admins and collectors must safeguard their account login credentials.</li>
            </ul>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              The Platform is designed for organizational management by adults. We do not knowingly collect personal data from individuals under 18 for account creation.
            </p>
          </Section>

          <Section title="10. Your Rights & Data Access">
            <p>
              Subject to applicable Indian data protection legislation (including the Digital Personal Data Protection Act, 2023), you may request access to, correction of, or deletion of your personal or organizational data by contacting us. Requests will be processed on a reasonable-efforts basis given the beta testing status of the Platform.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              Intellidon reserves the right to update this Privacy Policy at any time. Continued use of the Platform after updates constitutes acceptance of the revised Policy.
            </p>
          </Section>

          <Section title="12. Limitation of Liability">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4">
              <p className="text-sm leading-relaxed text-[#3A2E1E] font-semibold">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, INTELLIDON AND ITS DEVELOPERS, OFFICERS,
                EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
                SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM OR RELATED TO THE COLLECTION, USE,
                STORAGE, OR LOSS OF DATA ON THIS TESTING PLATFORM.
              </p>
            </div>
          </Section>

          <Section title="13. Governing Law">
            <p>
              This Privacy Policy shall be governed by and construed in accordance with the laws of
              India, and any disputes shall be subject to the exclusive jurisdiction of the courts located in
              <strong> Mumbai, Maharashtra, India</strong>.
            </p>
          </Section>

          {/* Contact */}
          <section className="bg-[#E8650A]/5 border border-[#E8650A]/20 rounded-xl p-5">
            <h2 className="text-lg font-bold text-[#1A1208] mb-3">14. Contact Us</h2>
            <p className="text-sm leading-relaxed text-[#3A2E1E]">
              For any questions regarding this Privacy Policy, please contact us at:
            </p>
            <div className="mt-3 space-y-1 text-sm text-[#3A2E1E]">
              <p><strong>Intellidon Legal & Privacy Team</strong></p>
              <p>{contactAddress}</p>
              <p>Email: <a href={`mailto:${contactEmail}`} className="text-[#E8650A] hover:underline">{contactEmail}</a></p>
            </div>
          </section>

          {/* Footer note */}
          <div className="border-t border-[#1A1208]/10 pt-6 text-center">
            <p className="text-xs text-[#9C8870]">
              By using Intellidon, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.
            </p>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs">
              <Link href="/terms" className="text-[#E8650A] hover:underline">Terms & Conditions</Link>
              <span className="text-[#9C8870]">·</span>
              <Link href="/" className="text-[#E8650A] hover:underline">Back to Home</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-[#1A1208] mb-3 pb-2 border-b border-[#1A1208]/10">{title}</h2>
      <div className="space-y-3 leading-relaxed text-sm text-[#3A2E1E]">{children}</div>
    </section>
  )
}
