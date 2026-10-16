# CBTFlow — 1-Click Free Online Hosting Guide

**CBTFlow** is built with **Next.js 16 (React, TypeScript, Tailwind CSS)** and processes all conversions directly in the client's browser. This means:
- ✅ **100% Free Hosting Forever** (no backend servers or monthly bills)
- ✅ **Complete Privacy** (exam questions never leave the teacher's browser)
- ✅ **Instant Conversions** (no upload queues or server timeouts)

---

## 🚀 Option 1: Deploy to Vercel in 2 Minutes (Recommended & Free)

Vercel is the creator and official host for Next.js.

### Steps:
1. Push this project to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for CBTFlow"
   git remote add origin https://github.com/YOUR_USERNAME/cbtflow.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in with GitHub.
3. Click **"Add New Project"** and select your `cbtflow` repository.
4. Set the **Root Directory** to `frontend`.
5. Click **"Deploy"**!

Within 60 seconds, your app will be live with a free SSL URL (e.g., `https://cbtflow.vercel.app`) that anyone can use on mobile, tablet, or desktop!

---

## 🌐 Option 2: Deploy to Netlify (Also Free)

1. Go to [netlify.com](https://netlify.com) and click **"Add new site"** -> **"Import an existing project"**.
2. Connect your GitHub repository.
3. Set:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/.next`
4. Click **Deploy Site**.

---

## 💻 Running Locally on Your Computer

If you want to run CBTFlow locally for offline testing or school computer labs:

```powershell
cd frontend
npm run dev
```

Open your browser at **`http://localhost:3000`**.
