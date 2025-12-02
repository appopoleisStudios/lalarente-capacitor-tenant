# Apply Location Migration

To add latitude/longitude fields to the properties table, run this SQL in your Supabase SQL Editor:

```sql
-- Add location fields to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude);

-- Add comment
COMMENT ON COLUMN properties.latitude IS 'Property latitude coordinate for map display';
COMMENT ON COLUMN properties.longitude IS 'Property longitude coordinate for map display';
```

After running this, regenerate the types:
```bash
npx supabase gen types typescript --linked > src/types/database.types.ts
```
