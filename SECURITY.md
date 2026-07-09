# Security & secrets

## What must never be committed

- `.dev.vars` (local Wrangler secrets)
- `.env` and `.env.*` (except `.env.example`)
- Real `DATABASE_URL` connection strings (Neon username/password)
- API keys (OpenAI, Twilio, etc.)
- Private keys (`.pem`, `.key`)

These paths are in `.gitignore`. Pre-commit and CI scans add a second layer.

## Rotate credentials (do this now if unsure)

Treat any secret that might have been shared or committed as compromised, even if git history only shows placeholders today.

### 1. Neon `DATABASE_URL`

1. Open [Neon Console](https://console.neon.tech) → your project → **Connection details**.
2. **Reset password** for the database role (or create a new role and retire the old one).
3. Copy the new connection string.

### 2. Update local dev

```bash
# Edit .dev.vars (never commit this file)
DATABASE_URL=postgresql://NEW_USER:NEW_PASSWORD@....neon.tech/...?sslmode=require
```

For Express-only local dev, also update `.env` if you use it.

### 3. Update Cloudflare Pages (production)

```bash
npx wrangler pages secret put DATABASE_URL
# paste the new connection string when prompted
```

Or: Cloudflare Dashboard → Pages → your project → **Settings** → **Environment variables** → edit `DATABASE_URL` (encrypted).

### 4. Redeploy

Trigger a new deployment so production picks up the new secret.

### 5. Revoke the old password

Confirm the old Neon password no longer works after the new one is live everywhere.

## Secret scanning

### Pre-commit (local)

Install gitleaks once:

```bash
brew install gitleaks
```

Every commit runs:

```bash
npm run secrets:protect
```

via the Husky pre-commit hook.

Manual full-repo scan:

```bash
npm run secrets:scan
```

### CI (GitHub)

`.github/workflows/gitleaks.yml` scans pushes and pull requests.

## Admin access

Admin login uses `ADMIN_PASSWORD` from the environment — **not** from client code.

1. Set locally in `.dev.vars` (Wrangler) or `.env` (Express):
   ```bash
   ADMIN_PASSWORD=your-strong-password-here
   ```
2. Set in Cloudflare Pages:
   ```bash
   npx wrangler pages secret put ADMIN_PASSWORD
   ```
3. Sign in at `/admin` — the browser stores a short-lived session token only.

**Rotate immediately** if a password was ever hardcoded in `admin.tsx` or committed to git. The old password must be treated as public.

Protected server routes include batch/slot management, order status updates, and listing all orders.

## If a real secret was pushed to GitHub

1. **Rotate immediately** (steps above).
2. Do not assume deleting the file from the latest commit is enough — history may still contain it.
3. For serious exposure, use [GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning) alerts and consider rewriting history with `git filter-repo` after rotation.
