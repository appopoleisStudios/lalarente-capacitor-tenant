#!/bin/bash

# Build Android APK Script
# This script helps you build a standalone Android APK

echo "🚀 Building Android APK for Lalarente App"
echo "=========================================="
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g eas-cli
fi

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo "📝 Please login to your Expo account:"
    eas login
fi

# Initialize EAS project if needed
echo "🔧 Configuring EAS project..."
eas init --id $(uuidgen | tr '[:upper:]' '[:lower:]') --non-interactive || eas init

# Build the APK
echo ""
echo "🏗️  Starting build process..."
echo "Choose build type:"
echo "1) Production APK (optimized, recommended)"
echo "2) Preview APK (faster, for testing)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo "Building production APK..."
        eas build --platform android --profile production
        ;;
    2)
        echo "Building preview APK..."
        eas build --platform android --profile preview
        ;;
    *)
        echo "Invalid choice. Building production APK by default..."
        eas build --platform android --profile production
        ;;
esac

echo ""
echo "✅ Build submitted! Check the link above to download your APK when ready."
echo "📱 You can also check build status with: eas build:list"
