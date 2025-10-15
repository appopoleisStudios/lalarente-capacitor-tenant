#!/bin/bash

echo "🧹 Cleaning up redundant folders..."
echo ""

# Check what's in old folders before deleting
echo "📋 Checking old folders..."
if [ "$(ls -A src/features/tenants 2>/dev/null)" ]; then
  echo "⚠️  tenants/ has content:"
  find src/features/tenants -type f
  echo ""
  read -p "Delete tenants/ folder? (y/n): " confirm
  if [ "$confirm" = "y" ]; then
    rm -rf src/features/tenants
    echo "✅ Deleted src/features/tenants/"
  fi
else
  rm -rf src/features/tenants
  echo "✅ Deleted empty src/features/tenants/"
fi

if [ "$(ls -A src/features/vendors 2>/dev/null)" ]; then
  echo "⚠️  vendors/ has content:"
  find src/features/vendors -type f
  echo ""
  read -p "Delete vendors/ folder? (y/n): " confirm
  if [ "$confirm" = "y" ]; then
    rm -rf src/features/vendors
    echo "✅ Deleted src/features/vendors/"
  fi
else
  rm -rf src/features/vendors
  echo "✅ Deleted empty src/features/vendors/"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLEANUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Final structure:"
echo "   src/features/"
echo "   ├─ owner/          ✅ (Role: Owner screens)"
echo "   ├─ tenant/         ✅ (Role: Tenant screens)"
echo "   ├─ vendor/         ✅ (Role: Vendor screens)"
echo "   ├─ auth/           ✅ (Shared auth)"
echo "   ├─ properties/     ✅ (Domain API)"
echo "   ├─ leases/         ✅ (Domain API)"
echo "   ├─ payments/       ✅ (Domain API)"
echo "   ├─ maintenance/    ✅ (Domain API)"
echo "   ├─ messaging/      ✅ (Domain API)"
echo "   └─ inspections/    ✅ (Domain API)"
echo ""

