# Plane.so Setup for Admin Panel Proxy

To get Plane issues working in the dev admin panel, please:

## 1. Expose Plane with a tunnel

On the Linux PC running Plane, run one of these:

**Option A — ngrok:**
```bash
ngrok http 8082
```
Copy the forwarding URL (e.g., `https://abc123.ngrok.app`)

**Option B — Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:8082
```
Copy the URL (e.g., `https://xyz.trycloudflare.com`)

## 2. Find your Plane API key

In Plane on your Linux PC:
- Go to Settings → API Tokens
- Create a new token
- Copy it

## 3. Find your workspace slug

The workspace slug is in Plane's URL:
```
http://100.79.34.78:8082/<workspace-slug>/...
```

## 4. Paste these 3 things to me in Codebuff

Once you have all three, paste them in a message like:
```
Plane URL: https://abc123.ngrok.app
API key: plane_api_xxx...
Workspace slug: lalarente
```

I'll set them as Supabase edge function secrets and the proxy will work.
