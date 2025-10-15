# Quick Start: Real Authentication Setup

## 🚀 5-Minute Setup Guide

### Step 1: Create Users in Supabase (2 min)

1. Go to **Supabase Dashboard**
2. Navigate to **Authentication → Users**
3. Click **"Add User"** (or "Invite")
4. Create 3 users:

```
Email: owner@lalarente.co.za
Password: Test123!

Email: tenant@lalarente.co.za
Password: Test123!

Email: vendor@lalarente.co.za
Password: Test123!
```

### Step 2: Set Roles in Database (1 min)

1. Go to **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste from `setup-test-users.sql`
4. Click **"Run"**

Or manually:
1. Go to **Table Editor → profiles**
2. Find each user by email
3. Set their `role` field:
   - `owner@lalarente.co.za` → role: `owner`
   - `tenant@lalarente.co.za` → role: `tenant`
   - `vendor@lalarente.co.za` → role: `vendor`

### Step 3: Test Login (2 min)

```bash
cd lalarente-app
npx expo start
```

**Test Owner:**
- Email: `owner@lalarente.co.za`
- Password: `Test123!`
- Should see owner dashboard

**Test Tenant:**
- Email: `tenant@lalarente.co.za`
- Password: `Test123!`
- Should see dashboard (currently owner view)

**Test Vendor:**
- Email: `vendor@lalarente.co.za`
- Password: `Test123!`
- Should see dashboard (currently owner view)

---

## ✅ What's Working Now

- ✅ Real Supabase authentication
- ✅ Email/password login
- ✅ User profiles from database
- ✅ Role-based user data
- ✅ Session persistence
- ✅ Sign out

## 📊 What's Still Mock

- 📊 Maintenance requests (using mockData.ts)
- 📊 Properties (referenced in mock data)
- 📊 Categories (referenced in mock data)

## 🚧 What's Next

- Create tenant-specific routes
- Create vendor-specific routes
- Add role-based navigation
- Build role-specific screens

---

## 🐛 Troubleshooting

**"Invalid credentials" error:**
- Check user exists in Supabase Auth
- Verify password is correct
- Check Supabase connection

**"Cannot read property 'role'" error:**
- Check profile exists in profiles table
- Verify role field is set
- Run setup-test-users.sql script

**User logs in but no profile:**
- Check profiles table has matching user ID
- Verify RLS policies allow reading profiles
- Check Supabase logs for errors

---

## 🎯 Quick Test Checklist

- [ ] Created 3 users in Supabase Auth
- [ ] Set roles in profiles table
- [ ] Can login as owner
- [ ] Can login as tenant
- [ ] Can login as vendor
- [ ] Profile data loads correctly
- [ ] Can sign out
- [ ] Session persists on reload

---

**That's it! You now have real authentication working! 🎉**
