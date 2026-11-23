# 钱包 Pocket

A simple money tracker for iPhone and Android. It's a PWA: open it in Safari or Chrome, then add it to your home screen.

- React + Vite, works offline (IndexedDB + service worker)
- Supabase for login (email 6-digit code) and storage; every table is protected by row-level security
- Multi-currency with daily rates from open.er-api.com; each entry converts using the rates for its own date

## Set up
1. Create a Supabase project, then run `supabase/schema.sql` in the SQL editor.
2. Auth → Email templates → "Magic Link": put `{{ .Token }}` in the body so the email contains the 6-digit code.
3. Local dev: create `.env.local` with `VITE_SUPABASE_URL=...` and `VITE_SUPABASE_KEY=<publishable/anon key>`, then run `npm run dev`.
4. GitHub Pages: set the repo variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and set Pages → Source to "GitHub Actions".

## Move old data in
`node scripts/migrate.mjs --dry` shows what will be imported; drop `--dry` to write it. This reads `../finance/*.csv` and `../finance/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `POCKET_EMAIL`).
