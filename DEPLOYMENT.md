# Cloudflare Pages Deployment via Git

This guide explains how to set up automatic deployments from your Git repository to Cloudflare Pages.

## 🚀 Setup Steps

### 1. Push Your Code to GitHub

Your repository is already connected to GitHub at `git@github.com:vikspizza/PizzaPilot.git`.

Commit and push your current changes:

```bash
git add .
git commit -m "Ready for Cloudflare deployment"
git push origin main
```

### 2. Connect Repository to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** in the sidebar
3. Click **"Create Application"** (or "Create a project" in older UI)
4. Click **"Connect to Git"**
5. Select your Git provider (GitHub, GitLab, or Bitbucket)
6. Authorize Cloudflare to access your repositories
7. Select the `PizzaPilot` repository (or `vikspizza/PizzaPilot`)
8. Click **"Begin setup"**

### 3. Configure Build Settings

In the "Set up your application" screen, configure:

- **Project name**: `PizzaPilot` (or your preferred name - already filled in)
- **Build command**: `npm run build:cf` (already filled in - keep this)
- **Deploy command**: **Leave this empty or remove `npx wrangler deploy`** - Pages doesn't need a deploy command, it deploys automatically after the build
- **Builds for non-production branches**: ✅ Check this box (enables preview deployments)

**Note:** If you see "Advanced settings", click it to access:
- **Build output directory**: `dist/public`
- **Root directory**: `/` (leave empty or set to root)
- **Production branch**: `main` (or `master` if that's your default branch)

### 4. Add Environment Variables

**Important:** Environment variables are configured **after** the initial deployment, not during setup.

After clicking "Deploy", you'll need to:
1. Go to your project → **Settings** → **Environment variables**
2. Click **"Add environment variable"**
3. Add:
   - **Variable name**: `DATABASE_URL`
   - **Value**: Your Neon database connection string
   - **Encrypt**: ✅ Check this box (makes it a secret)
4. Save and redeploy

**Alternative:** If you see an "Advanced settings" link during setup, you may be able to add environment variables there.

### 5. Deploy

Click **"Deploy"** button

Cloudflare will:
1. Clone your repository
2. Install dependencies (`npm install`)
3. Run the build command (`npm run build:cf`)
4. Deploy the output to Cloudflare Pages

## 🔄 Automatic Deployments

Once set up, every time you push to your main branch:
- Cloudflare automatically detects the push
- Runs the build process
- Deploys the new version
- Your site is updated automatically!

### Preview Deployments

Cloudflare also creates preview deployments for:
- Pull requests
- Other branches

These are great for testing changes before merging to production.

## 📝 Managing Deployments

### View Deployments
- Go to your project in Cloudflare Pages
- Click on **"Deployments"** tab
- See all past deployments with their status

### Rollback
- If something goes wrong, you can rollback to a previous deployment
- Click on a previous deployment → **"Retry deployment"** or **"Rollback to this deployment"**

### Custom Domain
- Go to **"Custom domains"** in your project settings
- Add your domain (e.g., `vikspizza.com`)
- Cloudflare will automatically set up SSL certificates

## 🔐 Environment Variables

To update environment variables after initial setup:
1. Go to your project → **Settings** → **Environment variables**
2. Add, edit, or remove variables
3. Redeploy to apply changes (or they'll apply to the next deployment)

## 📦 What Gets Deployed

- **Static files**: Everything in `dist/public/` (your React app)
- **Functions**: Everything in `functions/` (your API routes)
- **Assets**: Everything in `attached_assets/` (copied during build)

## 🐛 Troubleshooting

### UI Shows "Worker" Setup Instead of "Pages"
If the setup screen says "Configure your Worker project" but you're deploying a Pages app:
- This is normal - Cloudflare has unified the UI
- **Remove or leave empty** the "Deploy command" field (Pages doesn't need it)
- Keep the "Build command" as `npm run build:cf`
- After deployment, verify it's listed under **Pages** in the sidebar, not Workers

### Build Fails
- Check the build logs in Cloudflare Dashboard
- Make sure `package.json` has all required dependencies
- Verify build command is correct: `npm run build:cf`

### Functions Not Working
- Ensure `functions/` directory is in the root
- Check that `functions/api/[[path]].ts` exists
- Verify `DATABASE_URL` is set as an encrypted secret

### Database Connection Issues
- Verify `DATABASE_URL` is correctly set
- Make sure it's marked as **Encrypted** (secret)
- Check that your Neon database allows connections from Cloudflare IPs

### Can't Find Environment Variables During Setup
- Environment variables are typically added **after** the first deployment
- Go to: Project → **Settings** → **Environment variables**
- Add `DATABASE_URL` there, then trigger a new deployment

## 🎯 Best Practices

1. **Use branches**: Create feature branches, test with preview deployments, then merge to main
2. **Monitor deployments**: Check deployment logs regularly
3. **Test locally first**: Use `npm run dev:cf` to test before pushing
4. **Keep secrets safe**: Never commit `DATABASE_URL` to Git - always use Cloudflare secrets

## 📚 Additional Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions Docs](https://developers.cloudflare.com/pages/platform/functions/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

