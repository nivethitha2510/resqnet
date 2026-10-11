# ResQNet — Intelligent Emergency Response Network

ResQNet is an emergency response coordination platform integrating real-time citizen reporting, Gemini AI emergency triage via secure serverless Edge Functions, deterministic incident clustering and priority calculation, authority dispatch and vehicle fleet management, and live citizen tracking with PostgreSQL Change Data Capture (CDC).

---

## 🚀 Production Deployment Guide

### 1. Build & Framework Specifications
- **Framework:** React 19 + TypeScript (ESM)
- **Bundler:** Vite 8
- **Styling:** Tailwind CSS 4
- **State & Realtime:** Supabase JS Client (v2) with PostgreSQL CDC
- **AI Processing:** Google Gemini via Supabase Edge Function (`analyze-emergency`)

---

### 2. Environment Variables

Create your production environment variables in your hosting provider's dashboard:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Public URL of your Supabase project | `https://xyzcompany.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public Anon / Publishable API key | `sb_publishable_...` |

#### ⚠️ Security Rules
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in frontend `.env` or client variables.
- **NEVER** expose `GEMINI_API_KEY` in frontend code. Gemini requests are securely executed server-side through the deployed Supabase Edge Function (`analyze-emergency`).

---

### 3. Edge Function & Gemini AI Deployment

The AI emergency analysis service runs exclusively inside the Supabase Edge Function:

```bash
# 1. Set the Gemini API key in Supabase Secrets
npx supabase secrets set GEMINI_API_KEY="your-gemini-api-key" --project-ref your-project-ref

# 2. Deploy the analyze-emergency Edge Function
npx supabase functions deploy analyze-emergency --project-ref your-project-ref
```

---

### 4. Supabase Authentication & Redirect URLs

In your [Supabase Dashboard](https://supabase.com/dashboard) under **Authentication** ➔ **URL Configuration**:

1. **Site URL:**
   ```
   https://your-production-domain.com
   ```

2. **Redirect URLs:**
   ```
   https://your-production-domain.com/**
   http://localhost:5173/**
   http://localhost:4173/**
   ```

---

### 5. Deployment Options

#### Option A: Vercel
1. Import repository into Vercel.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Environment Variables.
6. SPA routing is automatically handled via [`vercel.json`](./vercel.json).

#### Option B: Netlify
1. Import repository into Netlify.
2. Build Command: `npm run build`.
3. Publish Directory: `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Environment Variables.
5. SPA routing is automatically handled via [`public/_redirects`](./public/_redirects).

#### Option C: Cloudflare Pages
1. Create new project connected to Git repository.
2. Build Command: `npm run build`.
3. Output Directory: `dist`.
4. Add environment variables in Settings.

---

### 6. Local Production Build & Verification

```bash
# 1. Typecheck
npx tsc --noEmit

# 2. Compile production bundle
npm run build

# 3. Preview production build locally
npm run preview
```
