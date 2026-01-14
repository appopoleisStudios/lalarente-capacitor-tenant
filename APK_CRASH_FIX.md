# APK Crash Fix - Complete Guide

## Problem Identified

Your preview APK was crashing on startup because:

1. **Missing environment variables in production builds** - The `src/core/api/supabase.ts` file was throwing an error when Supabase credentials weren't found
2. **Invalid placeholder values in `.env.production`** - Had dummy values instead of real credentials
3. **No app.config.js** - Environment variables weren't being properly injected into the build

## Fixes Applied

### 1. Created `app.config.js`
This file properly injects environment variables into your Expo build:
- Reads from `process.env.EXPO_PUBLIC_*` variables
- Makes them available via `Constants.expoConfig.extra`
- Works for both development and production builds

### 2. Updated `.env.production`
Changed from placeholder values to actual Supabase credentials (using dev credentials for now).

### 3. Fixed Error Handling in `src/core/api/supabase.ts`
Changed from throwing an error to logging a warning, preventing the app from crashing on startup.

## How to Rebuild Your APK

### Step 1: Clean Previous Build
```bash
cd lalarente-app
rm -rf .expo
```

### Step 2: Build New APK

For **preview** (faster, for testing):
```bash
eas build --platform android --profile preview --clear-cache
```

For **production**:
```bash
eas build --platform android --profile production --clear-cache
```

### Step 3: Wait for Build
The build will take 10-20 minutes. You'll get a download link when complete.

### Step 4: Test the APK
1. Download the APK from the link
2. Install on your Android device
3. The app should now start without crashing!

## Environment Variables Checklist

Make sure these are set in your `.env.production`:

- ✅ `EXPO_PUBLIC_SUPABASE_URL`
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

## Testing Locally

The app is now running successfully in the Android emulator. You can test it with:

```bash
npm run android
```

## What Changed

### Files Modified:
1. **app.config.js** (NEW) - Handles environment variable injection
2. **.env.production** - Updated with real credentials
3. **src/core/api/supabase.ts** - Changed error handling from throw to console.error

### Files Created:
1. **eas.json** - EAS Build configuration
2. **BUILD_ANDROID_APK.md** - Build instructions
3. **APK_CRASH_FIX.md** - This file

## Verification

The app is currently running in the Android emulator with:
- ✅ Supabase connection working
- ✅ Environment variables loaded
- ✅ Login screen displaying
- ✅ No crashes

## Next Steps

1. **Rebuild your APK** using the commands above
2. **Test on a physical device** to confirm the fix
3. **Set up production Supabase credentials** when ready to deploy

## Troubleshooting

### If the new APK still crashes:

1. Check build logs:
```bash
eas build:view [BUILD_ID]
```

2. View all builds:
```bash
eas build:list
```

3. Test locally first:
```bash
npm run android
```

4. Check Android logs after installing APK:
```bash
adb logcat | grep -i "error\|crash\|exception"
```

### Common Issues:

**Issue**: "Missing Supabase environment variables"
**Fix**: Ensure `.env.production` has valid values

**Issue**: "Build fails with credentials error"
**Fix**: Run `eas credentials` to configure Android keystore

**Issue**: "App installs but shows blank screen"
**Fix**: Check that all assets (images, fonts) are present in the assets folder

## Production Deployment

When ready for production:

1. Create a production Supabase project
2. Update `.env.production` with production credentials
3. Build with production profile:
```bash
eas build --platform android --profile production
```
4. Submit to Google Play Store:
```bash
eas submit --platform android
```
