import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onSelect: (option: SelectOption) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function Select({ options, value, onSelect, placeholder = 'Select...', style }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !selectedOption && styles.placeholderText]}>
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#A3A3A3" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && styles.optionSelected]}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionTextSelected]}>
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Ionicons name="checkmark" size={20} color="#007A4D" />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  triggerText: {
    fontSize: 15,
    color: '#171717',
    flex: 1,
  },
  placeholderText: {
    color: '#A3A3A3',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4D4D4',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionSelected: {
    backgroundColor: '#F0FDF4',
  },
  optionText: {
    fontSize: 15,
    color: '#171717',
  },
  optionTextSelected: {
    color: '#007A4D',
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 20,
  },
});
