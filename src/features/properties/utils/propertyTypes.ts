/**
 * Property types an owner can pick on Add / Edit Property (CT7-065).
 *
 * `properties.property_type` is free text in the DB. The values stay
 * lower-case because tenant search filters on house / apartment / townhouse
 * with a lower-cased compare.
 */
export const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'room', label: 'Room' },
] as const;
