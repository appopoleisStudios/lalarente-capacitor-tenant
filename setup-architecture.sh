#!/bin/bash

echo "🏗️  Setting up Role-Based Architecture..."
echo ""

# Create role-based feature folders
echo "📦 Creating role-based features..."

# Owner feature
mkdir -p src/features/owner/{screens,components,hooks,types}
touch src/features/owner/screens/.gitkeep
touch src/features/owner/components/.gitkeep
touch src/features/owner/hooks/.gitkeep
touch src/features/owner/types/.gitkeep

# Tenant feature
mkdir -p src/features/tenant/{screens,components,hooks,types}
touch src/features/tenant/screens/.gitkeep
touch src/features/tenant/components/.gitkeep
touch src/features/tenant/hooks/.gitkeep
touch src/features/tenant/types/.gitkeep

# Vendor feature
mkdir -p src/features/vendor/{screens,components,hooks,types}
touch src/features/vendor/screens/.gitkeep
touch src/features/vendor/components/.gitkeep
touch src/features/vendor/hooks/.gitkeep
touch src/features/vendor/types/.gitkeep

# Domain features (shared business logic - no screens)
echo "📦 Creating domain features..."

# Properties domain (CRUD only, no UI)
mkdir -p src/features/properties/{api,hooks,types}
touch src/features/properties/api/.gitkeep
touch src/features/properties/hooks/.gitkeep
touch src/features/properties/types/.gitkeep

# Leases domain
mkdir -p src/features/leases/{api,hooks,types}
touch src/features/leases/api/.gitkeep

# Payments domain
mkdir -p src/features/payments/{api,hooks,types}
touch src/features/payments/api/.gitkeep

# Maintenance domain
mkdir -p src/features/maintenance/{api,hooks,types}
touch src/features/maintenance/api/.gitkeep

# Messaging domain (shared by all roles)
mkdir -p src/features/messaging/{api,hooks,types,components}
touch src/features/messaging/components/.gitkeep

# Inspections domain
mkdir -p src/features/inspections/{api,hooks,types}
touch src/features/inspections/api/.gitkeep

# Vendors domain
mkdir -p src/features/vendors/{api,hooks,types}
touch src/features/vendors/api/.gitkeep

echo ""
echo "✅ Architecture setup complete!"
echo ""
echo "📊 Structure:"
echo "   src/features/"
echo "   ├─ owner/          (Owner role screens)"
echo "   ├─ tenant/         (Tenant role screens)"
echo "   ├─ vendor/         (Vendor role screens)"
echo "   ├─ auth/           (Shared auth)"
echo "   ├─ properties/     (Domain: Property CRUD)"
echo "   ├─ leases/         (Domain: Lease CRUD)"
echo "   ├─ payments/       (Domain: Payment CRUD)"
echo "   ├─ maintenance/    (Domain: Maintenance CRUD)"
echo "   ├─ messaging/      (Domain: Chat system)"
echo "   ├─ inspections/    (Domain: Inspection CRUD)"
echo "   └─ vendors/        (Domain: Vendor CRUD)"
echo ""

