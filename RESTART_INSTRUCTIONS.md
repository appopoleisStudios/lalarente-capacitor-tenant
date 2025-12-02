# Restart Instructions

## ✅ Configuration Complete!

All Google Maps setup is done. Now you need to restart your development server.

## Steps:

1. **Stop the current Metro bundler** (Ctrl+C in the terminal where it's running)

2. **Clear the cache and restart:**
   ```bash
   npx expo start -c
   ```
   
   The `-c` flag clears the cache, which is important after:
   - Installing new packages
   - Changing .env files
   - Updating app.json

3. **Rebuild the app** (if on physical device or emulator):
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Or scan the QR code with Expo Go

## What Should Work Now:

✅ Type in the "Property Location" field  
✅ See autocomplete suggestions for South African addresses  
✅ Select an address from the dropdown  
✅ See the map update with the location  
✅ Drag the marker to adjust position  
✅ Auto-fill: address, city, province, postal code  

## Testing:

Try searching for:
- "40 Burgundy Monavoni Centurion"
- "Sandton City"
- "V&A Waterfront Cape Town"

## Troubleshooting:

### If autocomplete still doesn't work:
1. Check the API key is correct in `.env`
2. Verify Places API is enabled in Google Cloud Console
3. Check API key restrictions (should allow your app's bundle ID)
4. Look for errors in the Metro bundler console

### If map shows wrong location:
- The default is Johannesburg (-26.2041, 28.0473)
- This will update once you search for an address

### If you see "This API project is not authorized":
- Add your bundle ID to API key restrictions in Google Cloud Console
- For development, you can temporarily remove restrictions

## Need Help?

Check the console logs for any error messages and let me know!
