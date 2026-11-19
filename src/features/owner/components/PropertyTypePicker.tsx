import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/src/shared/components/ui/Chip';
import { PROPERTY_TYPE_OPTIONS } from '@/src/features/properties/utils/propertyTypes';
import { optionLabel } from '@/src/shared/utils/optionLabel';

const findOption = (value: string) =>
  PROPERTY_TYPE_OPTIONS.find((o) => o.value === value.trim().toLowerCase());

/**
 * Single-select Property Type chips for Add / Edit Property (CT7-065).
 * The old free-text input let owners type anything and showed the raw value.
 *
 * A stored value that isn't in the list (typed before this picker existed)
 * is kept as an extra chip, so editing such a property never loses it.
 */
export function PropertyTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [legacyValue, setLegacyValue] = useState<string | null>(null);
  useEffect(() => {
    if (value && !findOption(value)) setLegacyValue(value);
  }, [value]);

  const selected = findOption(value)?.value ?? value;

  return (
    <View testID="property-type-picker" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {PROPERTY_TYPE_OPTIONS.map((option) => (
        <Chip
          key={option.value}
          testID={`property-type-chip-${option.value}`}
          label={option.label}
          selected={selected === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
      {legacyValue && (
        <Chip
          testID="property-type-chip-custom"
          label={optionLabel(legacyValue, PROPERTY_TYPE_OPTIONS)}
          selected={value === legacyValue}
          onPress={() => onChange(legacyValue)}
        />
      )}
    </View>
  );
}
