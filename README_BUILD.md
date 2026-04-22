# 🚀 LaLarente App - Build Guide

## Quick Start

### First Client Test Build
```bash
cd lalarente-app
./build-client-test.sh
```

This will create version **1.0.0-build.1-rev.0** - your first client testing build.

---

## Build Script Features

### ✅ Automated Version Management
- Updates `android/app/build.gradle` (versionCode, versionName)
- Updates `app.json` (expo.version)
- Updates `package.json` (version)
- Creates backup files before changes

### ✅ Build Information
- Generates `BUILD_INFO.txt` with complete build details
- Updates `VERSION.md` with version history
- Includes feature list and known limitations

### ✅ Pre-Build Checks
- Verifies Node.js and npm installation
- Checks EAS CLI installation
- Validates Expo authentication
- Runs TypeScript type checking

### ✅ Smart Versioning
- Build number for new features
- Revision number for hotfixes
- Automatic backup and restore on failure

---

## Usage

### Create First Build
```bash
./build-client-test.sh
```
**Output**: 1.0.0-build.1-rev.0

### Hotfix (Client Reports Bug)
```bash
./build-client-test.sh --revision
```
**Output**: 1.0.0-build.1-rev.1

### New Features Added
```bash
./build-client-test.sh --build
```
**Output**: 1.0.0-build.2-rev.0

### Show Help
```bash
./build-client-test.sh --help
```

---

## Version Format

### Structure
```
MAJOR.MINOR.PATCH-build.BUILD_NUMBER-rev.REVISION
```

### Example
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

## Build Process Flow

```
┌─────────────────────────────────────────┐
│  1. Check Prerequisites                 │
│     - Node.js, npm, EAS CLI             │
│     - Expo authentication               │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  2. Update Version Numbers              │
│     - build.gradle (versionCode/Name)   │
│     - app.json (version)                │
│     - package.json (version)            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  3. Create Build Info                   │
│     - BUILD_INFO.txt                    │
│     - Feature list                      │
│     - Known limitations                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  4. Install Dependencies                │
│     - npm install                       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  5. Type Check                          │
│     - npm run type-check                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  6. Build APK                           │
│     - eas build (10-20 minutes)         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  7. Success / Failure                   │
│     - Download link (success)           │
│     - Restore backups (failure)         │
└─────────────────────────────────────────┘
```

---

## After Build

### Download APK
```bash
# List all builds
eas build:list

# Download latest build
eas build:download --latest

# Download specific build
eas build:download --id <BUILD_ID>
```

### View Build Status
```bash
# View build details
eas build:view

# Check build logs
eas build:view --id <BUILD_ID>
```

---

## Distribution to Client

### Files to Share
1. **APK file** - The actual app installer
2. **BUILD_INFO.txt** - Build details and testing focus
3. **VERSION.md** - Version history and known issues

### Installation Instructions for Client
1. Enable "Install from unknown sources" on Android device
2. Transfer APK to device
3. Tap APK file to install
4. Open LaLarente app
5. Test features listed in BUILD_INFO.txt

---

## Versioning Strategy

### Scenario 1: Client Reports Bug
```bash
# Fix the bug in code
git commit -m "fix: resolved login issue"

# Build with revision increment
./build-client-test.sh --revision

# Result: 1.0.0-build.1-rev.1
```

### Scenario 2: Multiple Bugs Fixed
```bash
# Fix bug 1
git commit -m "fix: property search"

# Build revision 1
./build-client-test.sh --revision
# Result: 1.0.0-build.1-rev.1

# Fix bug 2
git commit -m "fix: viewing request"

# Build revision 2
./build-client-test.sh --revision
# Result: 1.0.0-build.1-rev.2
```

### Scenario 3: Add New Feature
```bash
# Implement payment gateway
git commit -m "feat: integrate PayFast"

# Build with build increment
./build-client-test.sh --build

# Result: 1.0.0-build.2-rev.0
```

### Scenario 4: Major Release
```bash
# Update version manually in script
# Change MAJOR=1 to MAJOR=2

./build-client-test.sh

# Result: 2.0.0-build.1-rev.0
```

---

## Troubleshooting

### Build Fails
- Check error messages in terminal
- Backup files are automatically restored
- Fix issues and run script again

### EAS CLI Not Found
```bash
npm install -g eas-cli
```

### Not Logged In
```bash
eas login
```

### Type Check Fails
- Fix TypeScript errors
- Or continue anyway when prompted

### Build Takes Too Long
- Normal: 10-20 minutes
- Check EAS dashboard for progress
- Can close terminal, build continues on EAS servers

---

## Files Created/Modified

### Created
- `BUILD_INFO.txt` - Build details for client
- `VERSION.md` - Version history
- `*.backup` - Backup files (auto-deleted on success)

### Modified
- `android/app/build.gradle` - versionCode, versionName
- `app.json` - expo.version
- `package.json` - version

---

## Best Practices

### ✅ Do
- Run script from `lalarente-app` directory
- Commit code changes before building
- Test locally before building
- Include BUILD_INFO.txt with APK
- Document issues in VERSION.md

### ❌ Don't
- Manually edit version numbers
- Skip type checking
- Build without testing
- Delete backup files manually
- Forget to increment version

---

## Support

### Common Commands
```bash
# Check EAS account
eas whoami

# List all builds
eas build:list

# Cancel running build
eas build:cancel

# View project info
eas project:info

# Update EAS CLI
npm install -g eas-cli@latest
```

### Need Help?
- Check EAS documentation: https://docs.expo.dev/build/introduction/
- View build logs in EAS dashboard
- Contact development team

---

## Version History

See `VERSION.md` for complete version history and changelog.

---

**Ready to build?**
```bash
./build-client-test.sh
```

Good luck! 🚀
