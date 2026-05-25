# Deploy Agent Mesh SRE to Vercel with Google Sign-In

This guide takes you from zero to a live public URL where any Gmail user can sign in and explore the Agent Mesh SRE demo.

---

## Prerequisites

- A GitHub account (the repo already exists: `https://github.com/aswinayyolath/agent-mesh-sre`)
- A Google account for Google Cloud Console
- A Vercel account (free Hobby plan is sufficient)

---

## Step 1 — Install next-auth locally

On your machine, in the project folder:

```bash
cd ~/Desktop/agent-mesh-sre
npm install
```

This picks up the newly added `next-auth` dependency from `package.json`.

---

## Step 2 — Create Google OAuth credentials

1. Open [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one) — name it e.g. **"Agent Mesh SRE"**
3. In the left menu go to **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - Fill in App name, support email, developer email → Save
   - Scopes: just the defaults (email, profile, openid) are enough
   - Test users: add your Gmail(s) during development
4. Go to **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Agent Mesh SRE`
   - **Authorized redirect URIs** — add both:
     ```
     http://localhost:3000/api/auth/callback/google
     https://<your-app>.vercel.app/api/auth/callback/google
     ```
     (Replace `<your-app>` with your actual Vercel URL — you'll come back and add it after Step 4)
5. Click **Create** — copy the **Client ID** and **Client Secret**

---

## Step 3 — Set your local `.env.local`

Open `~/Desktop/agent-mesh-sre/.env.local` and fill in:

```env
GOOGLE_CLIENT_ID=<paste Client ID here>
GOOGLE_CLIENT_SECRET=<paste Client Secret here>
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

Test locally:

```bash
npm run dev
# Visit http://localhost:3000 — you should be redirected to /login
# Click "Sign in with Google" — it should authenticate and return you to the dashboard
```

---

## Step 4 — Push to GitHub

```bash
cd ~/Desktop/agent-mesh-sre
git add .
git commit -m "feat: add Google OAuth + Vercel deployment config"
git push
```

> ⚠️ `.env.local` is already in `.gitignore` — your credentials are safe.

---

## Step 5 — Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import the `agent-mesh-sre` repo
4. Vercel auto-detects Next.js — no build settings needed
5. Under **Environment Variables**, add each of these (copy from your `.env.local`):

   | Key | Value |
   |-----|-------|
   | `KAFKA_MODE` | `MOCK` |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_SECURE` | `false` |
   | `SMTP_USER` | `surajcs@gmail.com` |
   | `SMTP_PASS` | *(your Gmail App Password)* |
   | `NOTIFICATION_EMAIL` | `surajcs@gmail.com` |
   | `GOOGLE_CLIENT_ID` | *(from Google Console)* |
   | `GOOGLE_CLIENT_SECRET` | *(from Google Console)* |
   | `NEXTAUTH_SECRET` | *(run `openssl rand -base64 32`)* |
   | `NEXTAUTH_URL` | *(leave blank — Vercel sets this automatically)* |

6. Click **Deploy** → wait ~2 minutes

---

## Step 6 — Add Vercel URL back to Google Console

1. Copy your Vercel deployment URL, e.g. `https://agent-mesh-sre.vercel.app`
2. Return to Google Cloud Console → **APIs & Services → Credentials → your OAuth client**
3. Under **Authorized redirect URIs**, add:
   ```
   https://agent-mesh-sre.vercel.app/api/auth/callback/google
   ```
4. Save

---

## Step 7 — Test the live deployment

1. Open your Vercel URL in an incognito window
2. You should see the **Agent Mesh SRE login page**
3. Click **Sign in with Google** — authenticate with any Gmail account
4. You're in! The full MRAL dashboard should load

Share the Vercel URL with anyone who has a Gmail account — they can sign in immediately.

---

## Notes on in-memory state

The agent mesh simulation runs in-memory using a `globalThis` singleton. On Vercel's serverless platform, function containers are reused for active connections, so the MRAL loop events will flow correctly to the SSE stream during a normal demo session. If events stop flowing after a scenario trigger, simply **refresh the page** and re-trigger the scenario — the container will re-warm.

For a persistent multi-user production deployment, the event bus would need to be backed by Vercel KV (Redis pub/sub), but that's beyond the scope of this demo.

---

## Restricting access to specific Gmail addresses

By default, any Google account can sign in. To limit access to specific emails, edit `src/lib/auth.ts` and uncomment the `signIn` callback:

```ts
callbacks: {
  async signIn({ user }) {
    const allowed = ["surajcs@gmail.com", "colleague@gmail.com"];
    return allowed.includes(user.email ?? "");
  },
},
```

Redeploy and only listed addresses will be granted access.
