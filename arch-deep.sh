#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "��️  LALARENTE ARCHITECTURE - DEEP CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# App directory
echo ""
echo "📱 APP/ (Expo Router Screens)"
find app -type f \( -name "*.tsx" -o -name "*.ts" \) | 
  grep -v node_modules | 
  while read file; do
    lines=$(wc -l < "$file" | xargs)
    echo "   $file ($lines L)"
  done

# Src directory
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 SRC/FEATURES/ (Business Logic)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for feature in src/features/*; do
  if [ -d "$feature" ]; then
    feature_name=$(basename "$feature")
    echo ""
    echo "📦 $feature_name/"
    
    # Screens
    if [ -d "$feature/screens" ]; then
      screen_count=$(find "$feature/screens" -name "*.tsx" | wc -l | xargs)
      echo "   ├─ screens/ ($screen_count files)"
      find "$feature/screens" -name "*.tsx" -o -name "*.ts" | 
        while read file; do
          echo "   │  └─ $(basename $file)"
        done
    fi
    
    # Components
    if [ -d "$feature/components" ]; then
      comp_count=$(find "$feature/components" -name "*.tsx" | wc -l | xargs)
      echo "   ├─ components/ ($comp_count files)"
      find "$feature/components" -name "*.tsx" | 
        while read file; do
          echo "   │  └─ $(basename $file)"
        done
    fi
    
    # API/Services
    if [ -d "$feature/api" ]; then
      api_count=$(find "$feature/api" -name "*.ts" | wc -l | xargs)
      echo "   ├─ api/ ($api_count files)"
      find "$feature/api" -name "*.ts" | 
        while read file; do
          echo "   │  └─ $(basename $file)"
        done
    fi
  fi
done

# Shared/Lib
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 SRC/LIB/ & SRC/SHARED/ (Core)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "src/lib" ]; then
  find src/lib -name "*.ts" | while read file; do
    echo "   $file"
  done
fi
if [ -d "src/shared" ]; then
  find src/shared -name "*.ts*" | while read file; do
    echo "   $file"
  done
fi

# Types
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SRC/TYPES/ (TypeScript)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "src/types" ]; then
  find src/types -name "*.ts" | while read file; do
    echo "   $file"
  done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ARCHITECTURE CHECK COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
