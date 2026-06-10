# Admin Panel — Vercel Deployment

## One-time setup

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import the `lalarente-capacitor-tenant` repository
4. **Configure project:**
   - **Root Directory:** `admin/`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
5. **Environment Variables** (add these):

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://vvepwaolnkzfzhzgxlwr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(your anon key)* |
| `VITE_PLANE_API_KEY` | *(your Plane API key — optional)* |
| `VITE_PLANE_WORKSPACE_SLUG` | *(your Plane workspace slug)* |
| `VITE_PLANE_PROJECT_ID` | *(your Plane project ID)* |

6. Click **Deploy**

## Post-deploy

- Vercel provides a `*.vercel.app` URL automatically
- For a custom domain: Project → Settings → Domains

## Updating

- Every push to `main` auto-deploys (Vercel GitHub integration)
- The `admin/vercel.json` ensures React Router works on all paths

## Local build test

```bash
cd admin
npm run build
npm run preview
```
