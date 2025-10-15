import { StyleSheet } from 'react-native';

const RSA = { blue: '#002395' };

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: '#6b7280' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  addButton: { backgroundColor: RSA.blue, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  
  filtersContainer: { padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  searchInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
    height: 40,
  },
  filtersRow: { gap: 8 },
  pickerWrapper: { marginBottom: 6 },
  pickerLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  pickerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 16, 
    backgroundColor: '#f3f4f6', 
    borderWidth: 1, 
    borderColor: '#e5e7eb' 
  },
  filterChipActive: { backgroundColor: RSA.blue, borderColor: RSA.blue },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#ffffff' },
  
  listContent: { padding: 16, paddingBottom: 100 },
  emptyState: { 
    alignItems: 'center', 
    paddingVertical: 40, 
    paddingHorizontal: 24, 
    backgroundColor: '#f9fafb', 
    borderRadius: 12, 
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  emptyButton: { backgroundColor: RSA.blue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  emptyButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});
