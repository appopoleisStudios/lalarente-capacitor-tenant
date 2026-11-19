/**
 * Display text for a stored option value (CT7-059).
 *
 * The known option's own label wins ("bbq" → "BBQ",
 * "prepaid_water_electricity" → "Prepaid Water/Electricity"). Anything else
 * (a custom amenity the owner typed) gets every underscore replaced and each
 * word capitalised. Replacing with a string pattern changed only the first
 * underscore, so the chip read "Prepaid Water_electricity".
 */
export function optionLabel(value: string, options: readonly { value: string; label: string }[]) {
  const known = options.find((o) => o.value === value);
  if (known) return known.label;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
