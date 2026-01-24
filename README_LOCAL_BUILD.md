# 🚀 LaLarente App - Local Gradle Build Guide

## Quick Start

### First Client Test Build (Local)
```bash
cd lalarente-app
./build-client-test.sh
```

This creates version **1.0.0-build.1-rev.0** using **local Gradle** (no EAS, no cloud).

---

## Prerequisites

### Required Software

#### 1. Node.js & npm
```bash
node --version  # Should be v24.4.1+
npm --version   # Should be v11.0.0+
```

#### 2. Java JDK 17+
```bash
java -version   # Should be 17 or higher
```

**Install Java (macOS):**
```bash
brew install openjdk@17
```

#### 3. Android SDK
The script will auto-detect Android SDK at:
- macOS: `~/Library/Android/sdk`
- Linux: `~/Android/Sdk`

**Or set manually:**
```bash
export ANDROID_HOME=~/Library/Android/sdk
export ANDROID_SDK_ROOT=~/Library/Android/sdk
```

**Install Android SDK:**
- Install Android Studio
- Or use `sdkmanager` command-line tools

---

## Build Process

### What the Script Does

```
1. Check Prerequisites
   ✓ Node.js, npm, Java
   ✓ Android SDK
   ✓ Gradle wrapper

2. Update Version Numbers
   ✓ build.gradle (versionCode, versionName)
   ✓ app.json (version)
   ✓ package.json (version)

3. Create Build Info
   ✓ BUILD_INFO.txt with details

4. Install Dependencies
   ✓ npm install

5. Type Check
   ✓ TypeScript validation

6. Export React Native Bundle
   ✓ Bundle JavaScript code
   ✓ Copy assets to Android

7. Clean Previous Builds
   ✓ ./gradlew clean

8. Build APK
   ✓ ./gradlew assembleRelease
   ✓ 5-10 minutes

9. Copy APK to builds/
   ✓ lalarente-1.0.0-build.1-rev.0.apk
```

---

## Usage

### Create First Build
```bash
./build-client-test.sh
```
**Output:** `builds/lalarente-1.0.0-build.1-rev.0.apk`

### Hotfix (Bug Fix)
```bash
./build-client-test.sh --revision
```
**Output:** `builds/lalarente-1.0.0-build.1-rev.1.apk`

### New Features
```bash
./build-client-test.sh --build
```
**Output:** `builds/lalarente-1.0.0-build.2-rev.0.apk`

---

## Build Output

### Files Created

```
builds/
├── lalarente-1.0.0-build.1-rev.0.apk      # The APK
└── BUILD_INFO-1.0.0-build.1-rev.0.txt     # Build details

android/app/build/outputs/apk/release/
└── app-release.apk                         # Original APK
```

### APK Location
```bash
# Main output (versioned)
builds/lalarente-1.0.0-build.1-rev.0.apk

# Original (overwritten each build)
android/app/build/outputs/apk/release/app-release.apk
```

---

## Installation

### Install on Device via ADB
```bash
# Connect device via USB
adb devices

# Install APK
adb install builds/lalarente-1.0.0-build.1-rev.0.apk

# Or force reinstall
adb install -r builds/lalarente-1.0.0-build.1-rev.0.apk
```

### Install Manually
1. Transfer APK to device
2. Enable "Install from unknown sources"
3. Tap APK file to install

---

## Troubleshooting

### Java Not Found
```bash
# Install Java 17
brew install openjdk@17

# Add to PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
```

### Android SDK Not Found
```bash
# Set environment variables
export ANDROID_HOME=~/Library/Android/sdk
export ANDROID_SDK_ROOT=~/Library/Android/sdk

# Add to PATH
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

### Gradle Build Fails
```bash
# Clean and retry
cd android
./gradlew clean
cd ..
./build-client-test.sh
```

### Bundle Export Fails
```bash
# Clear Metro cache
npx expo start --clear

# Or manually clear
rm -rf node_modules/.cache
rm -rf .expo
```

### APK Not Found After Build
```bash
# Check build output
ls -la android/app/build/outputs/apk/release/

# Check for errors in build log
cd android
./gradlew assembleRelease --stacktrace
```

---

## Build Time

| Step | Time |
|------|------|
| Dependencies | 1-2 min |
| Type Check | 10-30 sec |
| Bundle Export | 30-60 sec |
| Gradle Clean | 10-20 sec |
| Gradle Build | 3-8 min |
| **Total** | **5-10 min** |

Much faster than EAS cloud builds (10-20 min)!

---

## Version Format

```
1.0.0-build.1-rev.0
│ │ │   │     │   └─ Revision (hotfixes)
│ │ │   │     └───── Build number (features)
│ │ │   └─────────── Build identifier
│ │ └─────────────── Patch version
│ └───────────────── Minor version
└─────────────────── Major version
```

---

## Comparison: Local vs EAS

| Feature | Local Gradle | EAS Build |
|---------|-------------|-----------|
| Build Time | 5-10 min | 10-20 min |
| Internet Required | No (after deps) | Yes |
| Build Location | Your machine | Cloud |
| Cost | Free | Free tier limited |
| Control | Full | Limited |
| Debugging | Easy | Harder |
| CI/CD | Manual | Automated |

---

## Advanced

### Build Specific Architecture
```bash
# Edit android/gradle.properties
reactNativeArchitectures=arm64-v8a

# Then build
./build-client-test.sh
```

### Debug Build
```bash
cd android
./gradlew assembleDebug
```

### View Build Info
```bash
# APK info
aapt dump badging builds/lalarente-1.0.0-build.1-rev.0.apk

# APK size
du -h builds/lalarente-1.0.0-build.1-rev.0.apk
```

### Sign APK (Production)
For production, you need a proper keystore:

```bash
# Generate keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore lalarente-release.keystore \
  -alias lalarente-key \
  -keyalg RSA -keysize 2048 -validity 10000

# Configure in android/gradle.properties
MYAPP_RELEASE_STORE_FILE=lalarente-release.keystore
MYAPP_RELEASE_KEY_ALIAS=lalarente-key
MYAPP_RELEASE_STORE_PASSWORD=****
MYAPP_RELEASE_KEY_PASSWORD=****
```

---

## Environment Variables

### Required
```bash
export ANDROID_HOME=~/Library/Android/sdk
export ANDROID_SDK_ROOT=~/Library/Android/sdk
```

### Optional
```bash
export JAVA_HOME=/path/to/java
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Add to Shell Profile
```bash
# Add to ~/.zshrc or ~/.bashrc
echo 'export ANDROID_HOME=~/Library/Android/sdk' >> ~/.zshrc
echo 'export ANDROID_SDK_ROOT=~/Library/Android/sdk' >> ~/.zshrc
source ~/.zshrc
```

---

## Files Modified

### During Build
- `android/app/build.gradle` - versionCode, versionName
- `app.json` - expo.version
- `package.json` - version
- `android/app/src/main/assets/index.android.bundle` - JS bundle

### Created
- `builds/lalarente-*.apk` - Versioned APK
- `builds/BUILD_INFO-*.txt` - Build details
- `BUILD_INFO.txt` - Current build info
- `*.backup` - Backup files (auto-deleted on success)

---

## Best Practices

### ✅ Do
- Test locally before building
- Commit code changes before building
- Keep builds/ directory in .gitignore
- Document issues in VERSION.md
- Test APK on physical device

### ❌ Don't
- Build without testing
- Skip type checking
- Delete backup files manually
- Forget to increment version
- Share debug builds with clients

---

## Quick Commands

```bash
# Build first version
./build-client-test.sh

# Build hotfix
./build-client-test.sh --revision

# Build with new features
./build-client-test.sh --build

# Install on device
adb install builds/lalarente-*.apk

# View APK info
aapt dump badging builds/lalarente-*.apk

# Check APK size
du -h builds/*.apk

# Clean builds
rm -rf android/app/build
rm -rf builds/*.apk
```

---

## Support

### Common Issues

| Issue | Solution |
|-------|----------|
| Java not found | Install JDK 17+ |
| Android SDK not found | Install Android Studio or set ANDROID_HOME |
| Gradle build fails | Run `./gradlew clean` |
| Bundle export fails | Clear Metro cache |
| APK not found | Check build logs |

### Get Help
```bash
# Show help
./build-client-test.sh --help

# Check Gradle version
cd android && ./gradlew --version

# Check Android SDK
$ANDROID_HOME/tools/bin/sdkmanager --list
```

---

**Ready to build locally?**
```bash
./build-client-test.sh
```

Your APK will be in `builds/` directory! 🚀
