# Install Google Maps Packages

Run these commands to install the required packages:

```bash
# Install Google Places Autocomplete
npm install react-native-google-places-autocomplete

# Install React Native Maps
npm install react-native-maps

# For Expo (if using Expo)
npx expo install react-native-maps
```

## Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Places API
   - Geocoding API
4. Create API credentials (API Key)
5. Add the API key to your `.env` file:

```env
GOOGLE_MAPS_API_KEY=your_api_key_here
```

6. For iOS, add to `app.json`:
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_API_KEY"
      }
    }
  }
}
```

7. For Android, add to `app.json`:
```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_API_KEY"
        }
      }
    }
  }
}
```
