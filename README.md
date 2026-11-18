# Wedding Memories

1. Create a Supabase project. In Authentication settings, enable **Allow new users to sign up** and, in Sign In / Providers, enable **Anonymous Sign-Ins**. Guests do not register or enter a password; the app creates a guest session for photo uploads and ownership checks.
2. In the Supabase SQL Editor, run `supabase.sql`. Photos are viewable by anyone. Guests can delete only photos uploaded from their own guest session.
3. Configure the login-free couple link:
   - Generate a random secret at least 32 characters long, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   - In Supabase Dashboard → Edge Functions → Secrets, add it as `COUPLE_ACCESS_TOKEN`.
   - Install/use the Supabase CLI, run `npx supabase login`, then deploy from this project folder: `npx supabase functions deploy couple-delete-photo --project-ref YOUR_PROJECT_REF --no-verify-jwt`.
   - Create the private couple link: `https://USER.github.io/REPO/#/admin?key=YOUR_RANDOM_SECRET`.

   Treat this link like a password: anyone who has it can delete any photo. Do not put the secret in the app's `.env`, GitHub repository secrets, or source code. To revoke access, replace `COUPLE_ACCESS_TOKEN` in Supabase and share a new link.
4. Put the Supabase Project URL and anon key in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run `npm install` and `npm run dev`.
5. To deploy, push to `main`; in GitHub Settings → Pages, select **GitHub Actions**. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_COUPLE_NAMES` as repository secrets.
6. Guests scan table QR codes or open `https://USER.github.io/REPO/#/t/1` to upload, view all photos, and delete their own uploads. The couple link opens the gallery with download and delete controls.
