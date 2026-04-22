# 🎯 Quick Build Reference Card - Local Gradle

## First Build (Right Now!)
```bash
cd lalarente-app
./build-client-test.sh
```
**Creates**: `builds/lalarente-1.0.0-build.1-rev.0.apk`  
**Time**: 5-10 minutes (local build)

---

## Prerequisites Check
```bash
# Check Java
java -version  # Need 17+

# Check Android SDK
echo $ANDROID_HOME  # Should show path

# If not set
export ANDROID_HOME=~/Library/Android/sdk
```

---

## Common Scenarios

### 🐛 Client Reports Bug
```bash
# 1. Fix the bug
# 2. Test locally
# 3. Build hotfix
./build-client-test.sh --revision
```
**Creates**: 1.0.0-build.1-rev.1

### ✨ Added New Feature
```bash
# 1. Implement feature
# 2. Test locally
# 3. Build new version
./build-client-test.sh --build
```
**Creates**: 1.0.0-build.2-rev.0

### 📋 Multiple Bugs Fixed
```bash
# Fix bug 1 → ./build-client-test.sh --revision (rev.1)
# Fix bug 2 → ./build-client-test.sh --revision (rev.2)
# Fix bug 3 → ./build-client-test.sh --revision (rev.3)
```

---

## After Build

### Find Your APK
```bash
ls -lh builds/
# lalarente-1.0.0-build.1-rev.0.apk
```

### Install on Device
```bash
# Via ADB
adb install builds/lalarente-1.0.0-build.1-rev.0.apk

# Or transfer to device and install manually
```

### Check APK Size
```bash
du -h builds/*.apk
```

---

## Files to Share with Client

1. ✅ **APK file** (from `builds/` directory)
2. ✅ **BUILD_INFO-*.txt** (from `builds/` directory)
3. ✅ **Installation instructions**

---

## Build Time
⏱️ **5-10 minutes** (local Gradle build)

```
1.0.0-build.1-rev.0
│ │ │   │     │   └─ Hotfix number (bugs)
│ │ │   │     └───── Build number (features)
│ │ │   └─────────── Build label
│ │ └─────────────── Patch (0)
│ └───────────────── Minor (0)
└─────────────────── Major (1)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Script not executable | `chmod +x build-client-test.sh` |
| EAS not found | `npm install -g eas-cli` |
| Not logged in | `eas login` |
| Build fails | Check errors, backups auto-restored |
| Type errors | Fix or continue when prompted |

---

## Build Time
⏱️ **10-20 minutes** (runs on EAS servers, can close terminal)

---

## Need Help?
```bash
./build-client-test.sh --help
```

Or read: `README_BUILD.md`

---

**Ready? Let's build!** 🚀
```bash
./build-client-test.sh
```
