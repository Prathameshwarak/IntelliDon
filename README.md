# IntelliDon 🎗️

IntelliDon is a modern web application designed for Mandals to easily record donations, collect payments via cash or dynamic UPI QR codes, and automatically generate and distribute digital receipts instantly to donors.

---

## 🚀 Tech Stack & Versions

- **Framework**: Next.js `16.2.9` (App Router)
- **Language**: TypeScript / JavaScript (ES6+)
- **Styling**: Tailwind CSS `v4` & PostCSS
- **Backend & Database**: Supabase (PostgreSQL with Realtime capabilities)
- **PDF Generation**: `pdf-lib` (Pure JS, runs serverless without browser dependencies/Puppeteer)
- **QR Generation**: `qrcode` / `@types/qrcode`
- **Node.js Recommended**: Node.js `18.x` or `20.x` (LTS versions)

---

## 🛠️ Local Setup Instructions

Follow these steps to set up the project on your local machine:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18+ or 20+).

### 2. Clone and Install Dependencies
Navigate to the project folder and run:
```bash
npm install
```

### 3. Configure Environment Variables
You need a Supabase project instance.
1. Copy the example environment template file to create a local environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and fill in your Supabase project credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-for-admin-privileges

   Contact Prathamesh for all keys and db releted things
   ```
   *Note: `.env.local` is listed in `.gitignore` and must never be committed to version control.*

### 4. Supabase Setup Required
Ensure your Supabase project contains:
- A database schema with tables for `mandals`, `events`, `donations`, and `users`.
- A public Storage Bucket named **`receipts`** to store the generated PDF receipts:
  - Go to your Supabase Dashboard → **Storage**.
  - Create a new bucket named `receipts`.
  - Toggle **Public bucket** ON (so that generated receipt links can be accessed by donors without requiring authentication).

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🧑‍💻 Useful Commands

- **Start Dev Server**: `npm run dev`
- **Build for Production**: `npm run build`
- **Run Type Checks**: `npx tsc --noEmit`
- **Lint Code**: `npm run lint`
