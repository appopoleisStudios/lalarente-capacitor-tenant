import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { documentsApi } from '../api/documentsApi';
import {
  DocumentWithRelations,
  DocumentFilter,
  DocumentType,
  DOCUMENT_CATEGORIES,
} from '../types';
import { supabase } from '../../../lib/supabase';

const COLORS = {
  owner: { primary: '#002395', secondary: '#FFB81C' },
  tenant: { primary: '#007A4D', secondary: '#FFB81C' },
};

interface Props {
  role: 'owner' | 'tenant';
  propertyId?: string;
  leaseId?: string;
}

export default function DocumentsScreen({ role = 'owner', propertyId, leaseId }: Props) {
  const router = useRouter();
  const colors = COLORS[role];

  const [documents, setDocuments] = useState<DocumentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<DocumentFilter>({ type: 'all' });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadDocuments();
    }
  }, [userId, filter, propertyId, leaseId]);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadDocuments = async () => {
    if (!userId) return;

    try {
      let data: DocumentWithRelations[];

      if (propertyId) {
        data = await documentsApi.getPropertyDocuments(propertyId);
      } else if (leaseId) {
        data = await documentsApi.getLeaseDocuments(leaseId);
      } else {
        data = await documentsApi.getUserDocuments(userId, role, filter);
      }

      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = async () => {
    if (!userId || !searchQuery.trim()) {
      loadDocuments();
      return;
    }

    try {
      setLoading(true);
      const data = await documentsApi.searchDocuments(userId, role, searchQuery);
      setDocuments(data);
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDocuments();
  }, [userId, filter, propertyId, leaseId]);

  const navigateToDocument = (documentId: string) => {
    router.push(`/(${role})/documents/${documentId}` as any);
  };

  const navigateToUpload = () => {
    router.push(`/(${role})/documents/upload` as any);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDocumentIcon = (type: DocumentType) => {
    const iconMap: Record<DocumentType, string> = {
      id_document: 'card',
      proof_of_income: 'cash',
      bank_statement: 'document-text',
      employment_letter: 'briefcase',
      reference_letter: 'people',
      lease_agreement: 'document-attach',
      inspection_report: 'clipboard',
      payment_receipt: 'receipt',
      utility_bill: 'flash',
      tax_certificate: 'document',
      police_clearance: 'shield-checkmark',
      other: 'folder',
    };
    return iconMap[type] || 'document';
  };

  const renderDocument = ({ item }: { item: DocumentWithRelations }) => {
    const category = DOCUMENT_CATEGORIES[item.type as DocumentType];

    return (
      <TouchableOpacity
        style={styles.documentCard}
        onPress={() => navigateToDocument(item.id)}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons
            name={getDocumentIcon(item.type as DocumentType) as any}
            size={24}
            color={colors.primary}
          />
        </View>

        <View style={styles.documentContent}>
          <Text style={styles.documentTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.documentType}>{category?.label || item.type}</Text>
          <View style={styles.documentMeta}>
            <Text style={styles.metaText}>{formatFileSize(item.file_size)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>
          {item.property && (
            <View style={styles.propertyTag}>
              <Ionicons name="home-outline" size={12} color="#666" />
              <Text style={styles.propertyText} numberOfLines={1}>
                {item.property.title}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="folder-open-outline" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>No Documents</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'No documents match your search'
          : "You haven't uploaded any documents yet"}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: colors.primary }]}
          onPress={navigateToUpload}
        >
          <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFilters = () => {
    const types: Array<DocumentType | 'all'> = [
      'all',
      'lease_agreement',
      'id_document',
      'proof_of_income',
      'payment_receipt',
    ];

    return (
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={types}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter.type === item && { backgroundColor: colors.primary },
              ]}
              onPress={() => setFilter({ ...filter, type: item })}
            >
              <Text
                style={[
                  styles.filterText,
                  filter.type === item && { color: '#FFF' },
                ]}
              >
                {item === 'all' ? 'All' : DOCUMENT_CATEGORIES[item]?.label || item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Documents</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={navigateToUpload}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); loadDocuments(); }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filters */}
        {renderFilters()}

        {/* Document List */}
        <FlatList
          data={documents}
          keyExtractor={item => item.id}
          renderItem={renderDocument}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={documents.length === 0 && styles.emptyList}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: '#333',
  },
  filterContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  documentType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  metaDot: {
    fontSize: 12,
    color: '#999',
    marginHorizontal: 6,
  },
  propertyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  propertyText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyList: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
