# Wedding Memories
1. supabase.com → New project (free). In Authentication settings, enable **Allow new users to sign up** and, in Sign In / Providers, enable **Anonymous Sign-Ins**. Guests use an automatic guest session and do not need to register or enter a password. SQL Editor → paste `supabase.sql` → Run.
2. Authentication → Users → Add user (couple's email + password). Anonymous guests are created as new Supabase users, so **Allow new users to sign up** must stay enabled. In the couple user's metadata, set `app_metadata.role` to `couple`, then sign out and sign in again so Supabase refreshes the role. Run `supabase.sql` again in the SQL Editor. Protect the project with Supabase Auth rate limits/CAPTCHA if needed.
3. Copy Project URL + anon key into `.env` (see .env.example). `npm install && npm run dev`.
4. GitHub: push to `main`; Settings → Pages → Source: GitHub Actions; add the 3 values as repo Secrets.
5. Open `https://USER.github.io/REPO/#/admin` → login → print table QR codes.
