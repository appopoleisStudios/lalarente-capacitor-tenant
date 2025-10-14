# Google Maps Places API Setup Guide

## Overview
This guide explains how to set up Google Maps Places API for address autocomplete functionality in the Lala Rente property management system.

## Prerequisites
- Google Cloud Platform account
- Billing enabled on your Google Cloud project
## Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project

## Step 2: Enable Required APIs
1. Navigate to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - **Places API (Legacy)** - ⚠️ **REQUIRED**: Currently needed for JavaScript autocomplete
   - **Maps JavaScript API**
   
   **Note**: As of March 2025, Google's new Places API doesn't yet have JavaScript autocomplete support. The legacy API is still required for autocomplete functionality. This will be updated when Google releases the new JavaScript APIs.

## Step 3: Create API Key
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key

## Step 4: Restrict API Key (Recommended)
1. Click on your API key to edit it
2. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add your domain(s): `localhost:3000`, `yourdomain.com`
3. Under "API restrictions":
   - Select "Restrict key"
   - Choose: "Places API (Legacy)" and "Maps JavaScript API"

## Step 5: Configure Environment Variables
1. Open `.env.local` file in the project root
2. Add your Google Maps API key:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

## Step 6: Test the Integration
1. Start the development server: `npm run dev`
2. Navigate to "Add Property" or "Edit Property"
3. Click on the Address field
4. Start typing a South African address
5. Verify that autocomplete suggestions appear
6. Select an address and verify that city, province, and postal code are auto-populated

## Features
- **Address Autocomplete**: Type to get suggestions
- **South Africa Focus**: Results restricted to South African addresses
- **Auto-population**: City, province, and postal code automatically filled
- **Fallback**: Works without API key (shows regular input field)

## Troubleshooting
- **No suggestions**: Check API key and ensure Places API is enabled
- **CORS errors**: Verify domain restrictions in Google Cloud Console
- **Billing issues**: Ensure billing is enabled and has sufficient quota

## Cost Considerations
- Google Maps Places API has usage-based pricing
- Autocomplete requests are charged per session
- Consider setting up usage quotas and alerts

## Security Notes
- Never commit API keys to version control
- Use environment variables for API keys
- Restrict API keys to specific domains and APIs
- Monitor usage regularly
