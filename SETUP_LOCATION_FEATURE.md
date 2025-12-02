# Setup Guide: Location Picker Feature

This guide will help you set up the Google Maps location picker feature for property creation.

## ✅ What's Been Implemented

1. **Database Migration** - Added latitude/longitude fields to properties table
2. **LocationPicker Component** - Full-featured map component with:
   - Google Places Autocomplete
   - Interactive map with draggable marker
   - Reverse geocoding
   - Auto-fill address, city, province, postal code
3. **AddPropertyScreen Integration** - Replaced manual address entry with LocationPicker
4. **API Updates** - Added latitude/longitude to property creation

## 📋 Setup Steps

### Step 1: Apply Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add location fields to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude);

-- Add comments
COMMENT ON COLUMN properties.latitude IS 'Property latitude coordinate for map display';
COMMENT ON COLUMN properties.longitude IS 'Property longitude coordinate for map display';
```

### Step 2: Regenerate Database Types

```bash
cd lalarente-app
npx supabase gen types typescript --linked > src/types/database.types.ts
```

### Step 3: Install Required Packages

```bash
# Install Google Places Autocomplete
npm install react-native-google-places-autocomplete

# Install React Native Maps (for Expo)
npx expo install react-native-maps

# If not using Expo, install directly
npm install react-native-maps
```

### Step 4: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Places API**
   - **Geocoding API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

### Step 5: Configure API Key

#### Option A: Using .env file (Recommended)

Create or update `.env` file:

```env
GOOGLE_MAPS_API_KEY=AIzaSy...your_key_here
```

#### Option B: Using app.json (Expo)

Update `app.json`:

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "AIzaSy...your_key_here"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSy...your_key_here"
        }
      }
    }
  }
}
```

### Step 6: Restrict API Key (Security)

In Google Cloud Console:

1. Go to your API key
2. Click **Edit API key**
3. Under **Application restrictions**:
   - For Android: Add your app's package name and SHA-1 certificate fingerprint
   - For iOS: Add your app's bundle identifier
4. Under **API restrictions**:
   - Select "Restrict key"
   - Enable only: Maps SDK for Android, Maps SDK for iOS, Places API, Geocoding API

### Step 7: Test the Feature

1. Run your app: `npm start` or `npx expo start`
2. Navigate to Add Property screen
3. Try searching for an address
4. Verify the map shows and marker is draggable
5. Check that address fields auto-populate

## 🎯 Features

### Google Places Autocomplete
- Type to search for addresses
- Restricted to South Africa (can be changed in LocationPicker.tsx)
- Auto-completes as you type

### Interactive Map
- Shows property location
- Draggable marker for precise positioning
- Reverse geocoding when marker is moved
- Shows user's current location

### Auto-Fill
When you select an address or move the marker:
- ✅ Full address
- ✅ City
- ✅ Province
- ✅ Postal code
- ✅ Latitude
- ✅ Longitude

## 🔧 Customization

### Change Default Location

Edit `LocationPicker.tsx`:

```typescript
const [region, setRegion] = useState({
  latitude: -26.2041, // Change to your default latitude
  longitude: 28.0473, // Change to your default longitude
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
});
```

### Change Country Restriction

Edit `LocationPicker.tsx`:

```typescript
query={{
  key: process.env.GOOGLE_MAPS_API_KEY || '',
  language: 'en',
  components: 'country:za', // Change 'za' to your country code
}}
```

### Adjust Map Height

Edit `LocationPicker.tsx` styles:

```typescript
mapContainer: {
  height: 300, // Change to desired height
  // ...
}
```

## 🐛 Troubleshooting

### "Cannot find module 'react-native-maps'"
- Run: `npx expo install react-native-maps`
- Restart Metro bundler

### Map shows blank/gray
- Check API key is correct
- Verify Maps SDK is enabled in Google Cloud
- Check API key restrictions

### Autocomplete not working
- Verify Places API is enabled
- Check API key in .env file
- Ensure API key has Places API access

### "This API project is not authorized"
- Add your app's bundle ID (iOS) or package name (Android) to API key restrictions
- For development, temporarily remove restrictions

## 💰 Google Maps Pricing

- **First $200/month**: FREE (Google Cloud free tier)
- **Places Autocomplete**: $2.83 per 1,000 requests
- **Geocoding API**: $5.00 per 1,000 requests
- **Maps SDK**: $7.00 per 1,000 loads

For a typical property rental app with moderate usage, you'll likely stay within the free tier.

## 📚 Additional Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [React Native Maps Documentation](https://github.com/react-native-maps/react-native-maps)
- [Google Places Autocomplete](https://github.com/FaridSafi/react-native-google-places-autocomplete)

## ✅ Verification Checklist

- [ ] Database migration applied
- [ ] Types regenerated
- [ ] Packages installed
- [ ] Google Maps API key obtained
- [ ] API key configured in .env or app.json
- [ ] APIs enabled in Google Cloud Console
- [ ] API key restrictions configured
- [ ] App tested and location picker works
- [ ] Address auto-fills correctly
- [ ] Map displays property location
- [ ] Marker is draggable

---

**Need Help?** Check the troubleshooting section or refer to the official documentation links above.
