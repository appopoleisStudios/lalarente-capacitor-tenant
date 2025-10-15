#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  LALARENTE ARCHITECTURE CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# App folder (Expo Router)
echo "📱 APP/ (Expo Router Screens)"
find app -name "*.tsx" -o -name "*.ts" | sort | while read file; do
  lines=$(wc -l < "$file" | tr -d ' ')
  echo "   $file (${lines}L)"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 SRC/FEATURES/ (Business Logic)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for feature in src/features/*/; do
  if [ -d "$feature" ]; then
    feature_name=$(basename "$feature")
    echo ""
    echo "📦 $feature_name/"
    
    for subdir in screens components api hooks types; do
      dir="$feature$subdir"
      if [ -d "$dir" ]; then
        count=$(find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | wc -l | tr -d ' ')
        if [ $count -gt 0 ]; then
          echo "   ├─ $subdir/ ($count files)"
          find "$dir" -maxdepth 1 -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | sort | while read f; do
            echo "   │  └─ $(basename $f)"
          done
        fi
      fi
    done
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VERDICT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if dashboard is in wrong place
if [ -f "src/features/properties/screens/DashboardScreen.tsx" ]; then
  echo "❌ WRONG: Dashboard in properties/ (should have owner role)"
else
  echo "✅ CORRECT: No dashboard in properties/"
fi

# Check if we have proper feature separation
if [ -d "src/features/owner" ]; then
  echo "✅ CORRECT: owner/ feature exists"
else
  echo "❌ MISSING: owner/ feature doesn't exist"
fi

if [ -d "src/features/tenant" ]; then
  echo "✅ CORRECT: tenant/ feature exists"
else
  echo "❌ MISSING: tenant/ feature doesn't exist"
fi

echo ""
