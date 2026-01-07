# Lampara Website Deployment Guide

## ✅ Step 1: Upload to GitHub

### Option A: Using GitHub Desktop (Easiest)

1. **Download GitHub Desktop**
   - Go to: https://desktop.github.com/
   - Install and sign in with your GitHub account

2. **Create Repository**
   - Click "File" → "New Repository"
   - Name: `lampara-website`
   - Local path: `C:\Users\deguz\OneDrive\Pictures\Web Design\Websites\lampara-website`
   - Click "Create Repository"

3. **Publish to GitHub**
   - Click "Publish repository"
   - Uncheck "Keep this code private" (or keep it private, up to you)
   - Click "Publish repository"

4. **✅ Done!** Your website is now on GitHub

---

### Option B: Using Git Command Line

If you prefer command line:

```bash
cd "C:\Users\deguz\OneDrive\Pictures\Web Design\Websites\lampara-website"
git init
git add .
git commit -m "Initial commit - Lampara website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/lampara-website.git
git push -u origin main
```

---

## ✅ Step 2: Deploy to Vercel

1. **Go to Vercel**
   - Visit: https://vercel.com
   - Click "Sign Up" (use GitHub account)

2. **Import Project**
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"
   - Select `lampara-website`

3. **Configure Project**
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: Leave empty
   - Output Directory: Leave empty

4. **Deploy**
   - Click "Deploy"
   - Wait 30-60 seconds
   - ✅ Your site is live!

**Your URL will be:** `lampara-website.vercel.app` (or custom)

---

## ✅ Step 3: Enable Netlify Identity (for Admin Access)

1. **Go to Netlify**
   - Visit: https://app.netlify.com
   - Sign up with GitHub

2. **Link Your Site**
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub → Select `lampara-website`
   - Click "Deploy site"

3. **Enable Identity**
   - Go to "Site settings" → "Identity"
   - Click "Enable Identity"

4. **Set Up Git Gateway**
   - In Identity settings, click "Services" → "Git Gateway"
   - Click "Enable Git Gateway"

5. **Invite Yourself**
   - Go to Identity tab
   - Click "Invite users"
   - Enter your email
   - Check email and set password

---

## ✅ Step 4: Access Admin Panel

1. **Visit Admin**
   - Go to: `https://lampara-website.vercel.app/admin`
   - OR: `https://your-netlify-url.netlify.app/admin`

2. **Login**
   - Use the email/password you set up

3. **Start Managing Gallery!**
   - Click "Gallery Projects"
   - Click "New Gallery Projects"
   - Fill in details
   - Upload photos
   - Click "Publish"

---

## 🎯 Quick Summary

**Total time:** ~20 minutes

**Steps:**
1. Upload to GitHub (5 min)
2. Deploy to Vercel (3 min)
3. Set up Netlify Identity (7 min)
4. Access admin panel (1 min)

**You'll have:**
- ✅ Live website on Vercel
- ✅ Admin panel at `/admin`
- ✅ Easy photo management
- ✅ Auto-deploy on changes

---

## 💡 Tips

- **Use Vercel for hosting** (faster, better CDN)
- **Use Netlify for admin/identity** (they work together!)
- **Keep GitHub repo** (automatic backups)

---

## ❓ Need Help?

Let me know which step you're on and I'll guide you through it!
