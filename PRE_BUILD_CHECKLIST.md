# ✈️ Pre-Build Checklist

## Before Running `./build-client-test.sh`

### 1. Code Quality ✅
- [ ] All features tested locally
- [ ] No critical bugs
- [ ] TypeScript errors resolved (or acceptable)
- [ ] Code committed to git

### 2. Environment Setup ✅
- [ ] Node.js installed (v24.4.1+)
- [ ] npm installed (v11.0.0+)
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Logged into Expo (`eas login`)

### 3. Configuration ✅
- [ ] Supabase credentials in `.env`
- [ ] Google Maps API key configured
- [ ] App package name correct: `com.lalarente.app`

### 4. Testing ✅
- [ ] Login/logout works
- [ ] Property listing loads
- [ ] Viewing request works
- [ ] Application submission works
- [ ] Lease creation works
- [ ] No crashes on critical paths

### 5. Documentation ✅
- [ ] Known issues documented
- [ ] Testing focus areas identified
- [ ] Client instructions prepared

---

## Quick Pre-Flight Test

### Test These Core Flows (5 minutes)
```
1. Login as Owner
   ✓ Dashboard loads
   ✓ Properties list shows

2. Login as Tenant
   ✓ Search works
   ✓ Property detail opens
   ✓ Can request viewing

3. Login as Vendor
   ✓ Dashboard loads
   ✓ Jobs list shows
```

---

## Build Command

### First Build
```bash
./build-client-test.sh
```

### Hotfix Build
```bash
./build-client-test.sh --revision
```

### Feature Build
```bash
./build-client-test.sh --build
```

---

## Expected Build Time
⏱️ **10-20 minutes**

---

## After Build Success

### Immediate Actions
1. [ ] Download APK from EAS link
2. [ ] Test APK on physical device
3. [ ] Verify BUILD_INFO.txt created
4. [ ] Check VERSION.md updated

### Share with Client
1. [ ] APK file
2. [ ] BUILD_INFO.txt
3. [ ] Installation instructions
4. [ ] Testing focus areas

---

## If Build Fails

### Auto-Recovery
- ✅ Backup files automatically restored
- ✅ Version numbers rolled back
- ✅ No manual cleanup needed

### Next Steps
1. Read error message
2. Fix the issue
3. Run build script again

---

## Client Testing Expectations

### What Works (Test These)
- ✅ Property management
- ✅ Viewing requests
- ✅ Applications
- ✅ Lease creation
- ✅ Maintenance requests

### What's Limited (Inform Client)
- ⚠️ Payment gateway not integrated
- ⚠️ Lease signatures need setup
- ⚠️ No messaging system
- ⚠️ No push notifications

---

## Version Info

### This Build
- **Version**: 1.0.0
- **Build**: 1
- **Revision**: 0
- **Full**: 1.0.0-build.1-rev.0
- **Type**: Client Testing (Alpha)

---

## Ready to Build?

### Final Check
```bash
# Are you in the right directory?
pwd
# Should show: .../lalarente-app

# Is the script executable?
ls -la build-client-test.sh
# Should show: -rwxr-xr-x

# Are you logged in?
eas whoami
# Should show your username
```

### Go!
```bash
./build-client-test.sh
```

---

## Support

### During Build
- ☕ Grab coffee (10-20 min wait)
- 📱 Can close terminal (build continues on EAS)
- 🔗 Save the build link from output

### After Build
- 📥 Download: `eas build:download --latest`
- 📊 Status: `eas build:list`
- 📝 Logs: `eas build:view`

---

**All checks passed? Let's build!** 🚀

```bash
./build-client-test.sh
```
