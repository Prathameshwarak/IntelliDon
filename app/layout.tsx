import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionWatcher from "@/components/SessionWatcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://intelli-don.vercel.app";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDF8F3" },
    { media: "(prefers-color-scheme: dark)", color: "#07090e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Intellidon | Online Donation Platform & Mandal Management System India",
    template: "%s | Intellidon",
  },
  description:
    "Intellidon is India's leading digital donation management platform for Mandals, NGOs, Ganesh Utsav, Navratri, and charitable trusts. Easily collect online and door-to-door donations, generate instant digital receipts (Varty/Bility), manage volunteer collectors, track rankings, and accept UPI payments with 0% commission.",
  keywords: [
    "donation app",
    "mandal donation software",
    "online donation receipt generator",
    "ganesh utsav donation collection",
    "navratri donation app",
    "digital bility software",
    "digital varty app",
    "ngo donation platform india",
    "mandal management system",
    "upi donation receipt software",
    "door to door donation collection",
    "festival donation manager",
    "intellidon",
    "intellidon vercel app",
  ],
  authors: [{ name: "Intellidon Team", url: siteUrl }],
  creator: "Intellidon Technologies",
  publisher: "Intellidon",
  category: "Finance & Non-Profit Technology",
  applicationName: "Intellidon Mandal Portal",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  verification: {
    google: "ZWehgJn-Rbvq6V2H5oc6Zk1DStDRIvLa3NFQuHPwfwo",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "Intellidon",
    title: "Intellidon | Digital Donation & Mandal Management Platform",
    description:
      "Collect door-to-door and online festival donations with instant digital receipts (Bility/Varty), live collector tracking, and 0% commission UPI payments for Mandals and NGOs.",
    images: [
      {
        url: `${siteUrl}/icon.png`,
        width: 512,
        height: 512,
        alt: "Intellidon Digital Donation Management System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Intellidon | Digital Donation & Mandal Management Platform",
    description:
      "Collect door-to-door and online festival donations with instant digital receipts (Bility/Varty), live collector tracking, and 0% commission UPI payments.",
    images: [`${siteUrl}/icon.png`],
    creator: "@intellidon",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

// JSON-LD Structured Data for Google Search Rich Snippets
const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Intellidon",
  operatingSystem: "All Web Browsers, Android, iOS",
  applicationCategory: "BusinessApplication",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "1280",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  description:
    "Digital donation management software for Mandals, NGOs, and Charitable Trusts to collect door-to-door and online donations with instant WhatsApp receipts.",
  url: siteUrl,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Intellidon",
  url: siteUrl,
  logo: `${siteUrl}/icon.png`,
  sameAs: [
    "https://facebook.com/intellidon",
    "https://instagram.com/intellidon",
    "https://twitter.com/intellidon",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Support",
    email: "support@intellidon.org",
    areaServed: "IN",
    availableLanguage: ["en", "hi", "mr"],
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Intellidon",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/donate/{search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Theme Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('intellidon-theme') || localStorage.getItem('theme');
                  if (stored === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    if (!stored) {
                      localStorage.setItem('intellidon-theme', 'light');
                      localStorage.setItem('theme', 'light');
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />

        {/* Google Schema.org Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionWatcher />
        {children}
      </body>
    </html>
  );
}
