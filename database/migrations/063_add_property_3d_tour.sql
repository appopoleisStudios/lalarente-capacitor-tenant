-- 063_add_property_3d_tour.sql
-- Plane #92 (Phase 1): owner can attach an optional 3D tour URL to a property.
-- The in-app viewer renders it fullscreen in a WebView; when absent the
-- listing falls back to the photo gallery (the "View in 3D" CTA is hidden,
-- never lies).
ALTER TABLE properties
  ADD COLUMN media_3d_url TEXT;

COMMENT ON COLUMN properties.media_3d_url IS
  'Optional URL to an embedded 3D tour (Matterport/Polycam/3DGS/panorama). Rendered in the in-app WebView viewer.';
