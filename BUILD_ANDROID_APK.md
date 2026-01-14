# Build Standalone Android APK

This guide explains how to build a standalone Android APK that runs without Metro bundler.

## Prerequisites

1. Install EAS CLI globally:
```bash
npm install -g eas-cli
```

2. Login to your Expo account (create one at https://expo.dev if needed):
```bash
eas login
```

## Build Steps

### Option 1: Production APK (Recommended)

Build a production-ready APK:

```bash
cd lalarente-app
eas build --platform android --profile production
```

### Option 2: Preview APK (For Testing)

Build a preview APK for internal testing:

```bash
cd lalarente-app
eas build --platform android --profile preview
```

### Option 3: Local Build (Advanced)

If you prefer to build locally (requires Android Studio and SDK):

```bash
cd lalarente-app
eas build --platform android --profile production --local
```

## Build Process

1. EAS will ask you to configure your project (first time only)
2. It will create/update your Android credentials automatically
3. The build happens in the cloud (or locally if using --local flag)
4. Once complete, you'll get a download link for your APK

## Download & Install

1. After the build completes, download the APK from the provided link
2. Transfer the APK to your Android device
3. Enable "Install from Unknown Sources" in Android settings
4. Install the APK

## Build Configuration

The `eas.json` file contains three build profiles:

- **development**: For development builds with dev client
- **preview**: Internal testing APK (faster builds)
- **production**: Production-ready APK (optimized)

## Environment Variables

Make sure your `.env` and `.env.production` files contain all necessary API keys and configuration. EAS will use these during the build.

## Troubleshooting

### Build fails with "No Android credentials"
Run: `eas credentials` to configure Android keystore

### Build takes too long
Use the `preview` profile for faster builds during testing

### APK won't install
- Check Android version compatibility
- Ensure "Install from Unknown Sources" is enabled
- Try uninstalling any previous version first

## Check Build Status

View all your builds:
```bash
eas build:list
```

View specific build details:
```bash
eas build:view [BUILD_ID]
```

## Notes

- First build may take 15-20 minutes
- Subsequent builds are faster (5-10 minutes)
- APK size will be around 50-100MB depending on dependencies
- The APK is a standalone app - no Metro server needed!
