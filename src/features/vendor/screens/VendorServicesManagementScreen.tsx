import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/shared/theme/colors';
import {
  vendorProfileApi,
  VendorService,
  VendorServiceArea,
  ServiceCategory,
} from '@/src/features/vendor/api/profileApi';

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

export default function ServicesManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<VendorService[]>([]);
  const [serviceAreas, setServiceAreas] = useState<VendorServiceArea[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  // Add Service Modal
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [serviceTitle, setServiceTitle] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [pricingUnit, setPricingUnit] = useState('');
  const [addingService, setAddingService] = useState(false);

  // Add Area Modal
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [addingArea, setAddingArea] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [profileData, categoriesData] = await Promise.all([
        vendorProfileApi.getProfile(user.id),
        vendorProfileApi.getServiceCategories(),
      ]);

      if (profileData) {
        setServices(profileData.services);
        setServiceAreas(profileData.service_areas);
      }
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!user?.id || !selectedCategory || !serviceTitle || !basePrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setAddingService(true);
      const newService = await vendorProfileApi.addService(
        user.id,
        selectedCategory,
        serviceTitle,
        parseFloat(basePrice),
        pricingUnit || undefined
      );

      setServices([...services, newService]);
      setShowAddServiceModal(false);
      setSelectedCategory('');
      setServiceTitle('');
      setBasePrice('');
      setPricingUnit('');
      Alert.alert('Success', 'Service added successfully');
    } catch (error) {
      console.error('Error adding service:', error);
      Alert.alert('Error', 'Failed to add service. Please try again.');
    } finally {
      setAddingService(false);
    }
  };

  const handleRemoveService = (service: VendorService) => {
    Alert.alert('Remove Service', `Remove "${service.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await vendorProfileApi.removeService(service.id);
            setServices(services.filter((s) => s.id !== service.id));
            Alert.alert('Success', 'Service removed');
          } catch (error) {
            console.error('Error removing service:', error);
            Alert.alert('Error', 'Failed to remove service');
          }
        },
      },
    ]);
  };

  const handleAddArea = async () => {
    if (!user?.id || !selectedCity || !selectedProvince) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setAddingArea(true);
      const newArea = await vendorProfileApi.addServiceArea(
        user.id,
        selectedCity,
        selectedProvince
      );

      setServiceAreas([...serviceAreas, newArea]);
      setShowAddAreaModal(false);
      setSelectedCity('');
      setSelectedProvince('');
      Alert.alert('Success', 'Service area added successfully');
    } catch (error) {
      console.error('Error adding area:', error);
      Alert.alert('Error', 'Failed to add service area. Please try again.');
    } finally {
      setAddingArea(false);
    }
  };

  const handleRemoveArea = (area: VendorServiceArea) => {
    Alert.alert(
      'Remove Area',
      `Remove "${area.city}, ${area.province}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await vendorProfileApi.removeServiceArea(area.id);
              setServiceAreas(serviceAreas.filter((a) => a.id !== area.id));
              Alert.alert('Success', 'Service area removed');
            } catch (error) {
              console.error('Error removing area:', error);
              Alert.alert('Error', 'Failed to remove service area');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Manage Services</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Services</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Services Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🛠️ Your Services</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowAddServiceModal(true)}
            >
              <Ionicons name="add" size={20} color={colors.background.default} />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>

          {services.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔧</Text>
              <Text style={styles.emptyText}>No services added yet</Text>
              <Text style={styles.emptySubtext}>
                Add services to receive relevant maintenance requests
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {services.map((service, index) => (
                <View
                  key={service.id}
                  style={[styles.serviceItem, index > 0 && styles.itemBorder]}
                >
                  <View style={styles.serviceIcon}>
                    <Text style={styles.serviceIconText}>🔧</Text>
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceTitle}>{service.title}</Text>
                    <Text style={styles.serviceCategory}>
                      {service.category?.name || 'General'}
                    </Text>
                    <Text style={styles.servicePrice}>
                      R {service.base_price.toLocaleString()}
                      {service.pricing_unit && ` / ${service.pricing_unit}`}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveService(service)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.rsa.red} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Service Areas Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📍 Service Areas</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowAddAreaModal(true)}
            >
              <Ionicons name="add" size={20} color={colors.background.default} />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>

          {serviceAreas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🗺️</Text>
              <Text style={styles.emptyText}>No service areas added</Text>
              <Text style={styles.emptySubtext}>
                Add areas where you provide services
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {serviceAreas.map((area, index) => (
                <View
                  key={area.id}
                  style={[styles.areaItem, index > 0 && styles.itemBorder]}
                >
                  <Ionicons name="location" size={20} color={colors.rsa.blue} />
                  <Text style={styles.areaText}>
                    {area.city}, {area.province}
                  </Text>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveArea(area)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.rsa.red} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.rsa.blue} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Why add services?</Text>
            <Text style={styles.infoText}>
              Adding services helps property owners find you for relevant maintenance
              requests. The more specific your services, the better matches you'll receive.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Add Service Modal */}
      <Modal
        visible={showAddServiceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddServiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Service</Text>
              <Pressable onPress={() => setShowAddServiceModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>
                Category <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.pickerContainer}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat.id && styles.categoryChipSelected,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === cat.id && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>
                Service Title <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={serviceTitle}
                onChangeText={setServiceTitle}
                placeholder="e.g., Plumbing Repairs"
                placeholderTextColor={colors.text.tertiary}
              />

              <Text style={styles.label}>
                Base Price (R) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={basePrice}
                onChangeText={setBasePrice}
                placeholder="e.g., 500"
                keyboardType="numeric"
                placeholderTextColor={colors.text.tertiary}
              />

              <Text style={styles.label}>Pricing Unit (Optional)</Text>
              <TextInput
                style={styles.input}
                value={pricingUnit}
                onChangeText={setPricingUnit}
                placeholder="e.g., per hour, per visit"
                placeholderTextColor={colors.text.tertiary}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddServiceModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddService}
                disabled={addingService}
              >
                {addingService ? (
                  <ActivityIndicator size="small" color={colors.background.default} />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Add Service</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Area Modal */}
      <Modal
        visible={showAddAreaModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddAreaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Service Area</Text>
              <Pressable onPress={() => setShowAddAreaModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>
                City <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={selectedCity}
                onChangeText={setSelectedCity}
                placeholder="e.g., Cape Town"
                placeholderTextColor={colors.text.tertiary}
              />

              <Text style={styles.label}>
                Province <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.pickerContainer}>
                {PROVINCES.map((province) => (
                  <Pressable
                    key={province}
                    style={[
                      styles.categoryChip,
                      selectedProvince === province && styles.categoryChipSelected,
                    ]}
                    onPress={() => setSelectedProvince(province)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedProvince === province && styles.categoryChipTextSelected,
                      ]}
                    >
                      {province}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddAreaModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddArea}
                disabled={addingArea}
              >
                {addingArea ? (
                  <ActivityIndicator size="small" color={colors.background.default} />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Add Area</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.default,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.rsa.blue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background.default,
  },
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.rsa.blue + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceIconText: {
    fontSize: 20,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  serviceCategory: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.rsa.green,
  },
  removeButton: {
    padding: 8,
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  areaText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.rsa.blue + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.rsa.blue + '30',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.default,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalScroll: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
    marginTop: 16,
  },
  required: {
    color: colors.rsa.red,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryChipSelected: {
    backgroundColor: colors.rsa.blue,
    borderColor: colors.rsa.blue,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  categoryChipTextSelected: {
    color: colors.background.default,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalButtonPrimary: {
    backgroundColor: colors.rsa.blue,
  },
  modalButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background.default,
  },
});
