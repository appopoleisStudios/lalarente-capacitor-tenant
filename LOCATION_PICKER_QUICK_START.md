# Location Picker - Quick Start

## 🚀 Two Options Available

### Option 1: Full Google Maps Integration (Recommended)
**Features:**
- ✅ Google Places Autocomplete
- ✅ Interactive map with draggable marker
- ✅ Reverse geocoding
- ✅ Professional UX

**Setup Required:**
1. Apply database migration (see SETUP_LOCATION_FEATURE.md)
2. Install packages: `npm install react-native-maps react-native-google-places-autocomplete`
3. Get Google Maps API key
4. Configure API key in .env

**Current Status:** ✅ Implemented, needs setup

---

### Option 2: Simple Manual Entry (Fallback)
**Features:**
- ✅ Manual address entry
- ✅ No external dependencies
- ✅ Works immediately

**To Use:**
Replace the import in `AddPropertyScreen.tsx`:

```typescript
// Change this:
import { LocationPicker } from '../components/LocationPicker';

// To this:
import { SimpleLocationPicker as LocationPicker } from '../components/SimpleLocationPicker';
```

**Current Status:** ✅ Ready to use

---

## 📝 Current Implementation

The AddPropertyScreen currently uses **LocationPicker** (Google Maps version).

If you haven't set up Google Maps yet, you'll see errors. Switch to **SimpleLocationPicker** temporarily.

## 🎯 Recommended Approach

1. **For Development/Testing:** Use SimpleLocationPicker
2. **For Production:** Set up Google Maps (follow SETUP_LOCATION_FEATURE.md)

## 📋 Database Migration Status

⚠️ **Action Required:** Run the SQL migration in Supabase to add latitude/longitude fields.

```sql
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude);
```

After running, regenerate types:
```bash
npx supabase gen types typescript --linked > src/types/database.types.ts
```

---

## 🔄 Switching Between Options

### To use Simple (Manual) Entry:
```typescript
import { SimpleLocationPicker as LocationPicker } from '../components/SimpleLocationPicker';
```

### To use Google Maps:
```typescript
import { LocationPicker } from '../components/LocationPicker';
```

Both components have the same interface, so no other changes needed!

---

## 📚 Full Documentation

See **SETUP_LOCATION_FEATURE.md** for complete setup instructions.
