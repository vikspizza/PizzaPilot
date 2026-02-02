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
3. Click **"Create a project"**
4. Click **"Connect to Git"**
5. Select your Git provider (GitHub, GitLab, or Bitbucket)
6. Authorize Cloudflare to access your repositories
7. Select the `PizzaPilot` repository
8. Click **"Begin setup"**

### 3. Configure Build Settings

In the build configuration screen, set:

- **Project name**: `pizzapilot` (or your preferred name)
- **Production branch**: `main` (or `master` if that's your default branch)
- **Build command**: `npm run build:cf`
- **Build output directory**: `dist/public`
- **Root directory**: `/` (leave empty or set to root)

### 4. Add Environment Variables

Click **"Add environment variable"** and add:

**For Production:**
- **Variable name**: `DATABASE_URL`
- **Value**: Your Neon database connection string
- **Encrypt**: ✅ Check this box (makes it a secret)

**Optional - For Preview Deployments:**
You can also add environment variables for preview branches if you want different settings for staging.

### 5. Deploy

Click **"Save and Deploy"**

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

## 🎯 Best Practices

1. **Use branches**: Create feature branches, test with preview deployments, then merge to main
2. **Monitor deployments**: Check deployment logs regularly
3. **Test locally first**: Use `npm run dev:cf` to test before pushing
4. **Keep secrets safe**: Never commit `DATABASE_URL` to Git - always use Cloudflare secrets

## 📚 Additional Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions Docs](https://developers.cloudflare.com/pages/platform/functions/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

