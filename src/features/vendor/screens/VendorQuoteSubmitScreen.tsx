import { useAuth } from '@/src/contexts/AuthContext';
import { getVendorRequestById, type VendorMaintenanceRequest } from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395', green: '#007A4D', gold: '#FFB81C', red: '#DE3831' };

// Common item templates for easy selection
const COMMON_ITEMS = [
  { name: 'Labor Cost', unit: 'day', typical_price: 500 },
  { name: 'Materials', unit: 'set', typical_price: 1000 },
  { name: 'Transport', unit: 'trip', typical_price: 200 },
  { name: 'Equipment Rental', unit: 'day', typical_price: 300 },
];

// Duration options (no typing)
const DURATION_OPTIONS = [
  '1-2 hours',
  '3-4 hours',
  '1 day',
  '2-3 days',
  '4-5 days',
  '1 week',
  '2 weeks',
  '3-4 weeks',
  '1 month',
  '2+ months',
];

// Warranty options
const WARRANTY_OPTIONS = [
  'No warranty',
  '1 month',
  '3 months',
  '6 months',
  '1 year',
  '2 years',
  '5 years',
];

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export default function VendorQuoteSubmitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const segments = useSegments();
  const [request, setRequest] = useState<VendorMaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Detect if we're in edit mode by checking the route segments
  const isEditMode = (segments as string[]).includes('edit');
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 VendorQuoteSubmitScreen - Route segments:', segments);
    console.log('🔍 VendorQuoteSubmitScreen - isEditMode:', isEditMode);
  }, [segments, isEditMode]);
  
  // Form state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', name: '', quantity: 1, unit_price: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [duration, setDuration] = useState('');
  const [warranty, setWarranty] = useState('No warranty');
  const [notes, setNotes] = useState('');
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showWarrantyPicker, setShowWarrantyPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (id && user?.id) {
      fetchRequestDetails();
      loadDraftIfExists();
    }
  }, [id, user?.id]);

  const handleUseTemplate = (template: typeof COMMON_ITEMS[0]) => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      name: template.name,
      quantity: 1,
      unit_price: template.typical_price,
    };
    setLineItems([...lineItems, newItem]);
    setShowTemplates(false);
  };

  const loadDraftIfExists = async () => {
    try {
      // TODO: Implement draft loading once AsyncStorage is properly configured
      // For now, skip draft loading
      console.log('Draft loading will be implemented in next update');
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      const data = await getVendorRequestById(id, user.id);
      
      // Check if vendor can quote (skip in edit mode)
      if (!isEditMode && !data.can_quote) {
        Alert.alert(
          'Cannot Submit Quote',
          'Your service categories do not match this request. Please update your profile first.',
          [
            { text: 'Cancel', onPress: () => router.back(), style: 'cancel' },
            { 
              text: 'Update Profile', 
              onPress: () => {
                router.back();
                router.push('/(vendor)/profile/services');
              },
            },
          ]
        );
        return;
      }
      
      setRequest(data);
      
      console.log('🔍 Request loaded:', {
        hasQuote: !!data.my_quote,
        quoteId: data.my_quote?.id,
        quoteStatus: data.my_quote?.status,
        isEditMode,
      });
      
      // Load existing quote data in edit mode
      if (isEditMode && data.my_quote) {
        console.log('✅ Loading quote data in edit mode');
        await loadExistingQuoteData(data.my_quote.id);
      } else {
        console.log('❌ NOT loading quote data:', { isEditMode, hasQuote: !!data.my_quote });
      }
    } catch (error: any) {
      console.error('Error fetching request:', error);
      Alert.alert('Error', 'Failed to load request details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadExistingQuoteData = async (quoteId: string) => {
    try {
      console.log('📝 Loading existing quote data for:', quoteId);
      
      // Import quotesApi
      const { quotesApi } = await import('@/src/features/maintenance/api/quotesApi');
      
      // Fetch quote with line items
      const quote = await quotesApi.getQuoteById(quoteId);
      console.log('📝 Quote loaded:', quote);
      
      // Fetch quote lines
      const { supabase } = await import('@/src/lib/supabase');
      const { data: quoteLines } = await supabase
        .from('quote_lines')
        .select('*')
        .eq('quote_id', quoteId);
      
      console.log('📝 Quote lines loaded:', quoteLines);
      
      // Pre-fill form with existing data
      if (quoteLines && quoteLines.length > 0) {
        const loadedItems: LineItem[] = quoteLines.map((line: any, index: number) => ({
          id: (index + 1).toString(),
          name: line.description || '',
          quantity: line.qty || 1,
          unit_price: line.unit_price || 0,
        }));
        console.log('📝 Setting line items:', loadedItems);
        setLineItems(loadedItems);
      }
      
      setDiscount(quote.discount_amount || 0);
      setNotes(quote.notes || '');
      
      // TODO: Load duration and warranty from quote metadata if stored
    } catch (error) {
      console.error('Error loading quote data:', error);
      Alert.alert('Error', 'Failed to load existing quote data');
    }
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const vatAmount = subtotal * 0.15; // 15% VAT
  const total = subtotal + vatAmount - discount;
  const platformFee = total * 0.10; // Assume 10% platform fee
  const estimatedEarnings = total - platformFee;

  const addLineItem = () => {
    const newId = (lineItems.length + 1).toString();
    setLineItems([...lineItems, { id: newId, name: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one line item');
      return;
    }
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const useTemplate = (template: typeof COMMON_ITEMS[0]) => {
    const lastItem = lineItems[lineItems.length - 1];
    if (lastItem.name === '' && lastItem.unit_price === 0) {
      // Update the last empty item
      updateLineItem(lastItem.id, 'name', template.name);
      updateLineItem(lastItem.id, 'unit_price', template.typical_price);
    } else {
      // Add new item
      const newId = (lineItems.length + 1).toString();
      setLineItems([...lineItems, { 
        id: newId, 
        name: template.name, 
        quantity: 1, 
        unit_price: template.typical_price 
      }]);
    }
    setShowTemplates(false);
  };

  const validateForm = (): boolean => {
    // Check if at least one line item has data
    const hasValidItems = lineItems.some(item => item.name.trim() !== '' && item.unit_price > 0);
    if (!hasValidItems) {
      Alert.alert('Missing Information', 'Please add at least one work item with a price');
      return false;
    }

    // Check if duration is selected
    if (!duration) {
      Alert.alert('Missing Information', 'Please select an estimated duration');
      return false;
    }

    // Check if total is reasonable
    if (total <= 0) {
      Alert.alert('Invalid Amount', 'Total amount must be greater than zero');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (isEditMode) {
      // In edit mode, just confirm the update
      Alert.alert(
        'Update Quote',
        `You are about to update your quote to R ${total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Update', 
            style: 'default',
            onPress: submitQuote,
          },
        ]
      );
    } else {
      // In create mode, show warning about not being able to edit
      Alert.alert(
        '⚠️ Important Notice',
        `Once you submit this quote for R ${total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}, you CANNOT edit it until the property owner requests changes.\n\nAre you sure all details are correct?`,
        [
          { 
            text: 'Save Draft', 
            style: 'cancel',
            onPress: handleSaveDraft,
          },
          { 
            text: 'Review Again', 
            style: 'default',
          },
          { 
            text: 'Yes, Submit', 
            style: 'destructive',
            onPress: submitQuote,
          },
        ]
      );
    }
  };

  const submitQuote = async () => {
    try {
      setSubmitting(true);
      
      if (!user?.id || !request) {
        throw new Error('Missing required data');
      }

      // Import quotesApi
      const { quotesApi } = await import('@/src/features/maintenance/api/quotesApi');

      if (isEditMode && request.my_quote) {
        // Update existing quote
        await quotesApi.updateQuote(
          request.my_quote.id,
          {
            subtotal,
            vat_amount: vatAmount,
            discount_amount: discount,
            total_amount: total,
            notes: notes || undefined,
            revision_reason: 'Vendor revised quote based on owner feedback',
          },
          user.id
        );

        // Update quote lines
        const { supabase } = await import('@/src/lib/supabase');
        
        // Delete existing lines
        await supabase
          .from('quote_lines')
          .delete()
          .eq('quote_id', request.my_quote.id);
        
        // Insert new lines
        const lineItemsToInsert = lineItems
          .filter(item => item.name.trim() !== '')
          .map(item => ({
            quote_id: request.my_quote!.id,
            description: item.name,
            qty: item.quantity,
            unit_price: item.unit_price,
            unit: 'unit',
            tax_rate: 0.15,
          }));
        
        await (supabase
          .from('quote_lines') as any)
          .insert(lineItemsToInsert);

        // Show success message
        Alert.alert(
          '✅ Quote Updated!',
          'Your revised quote has been sent to the property owner.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                router.replace(`/(vendor)/maintenance/${id}`);
              },
            },
          ]
        );
      } else {
        // Submit new quote
        await quotesApi.submitQuote({
          request_id: request.id,
          vendor_id: user.id,
          owner_id: request.owner_id || user.id,
          property_id: request.property_id || request.id,
          contract_id: null,
          subtotal,
          vat_amount: vatAmount,
          discount_amount: discount,
          total_amount: total,
          notes: notes || undefined,
          estimated_duration: duration,
          warranty_period: warranty,
          line_items: lineItems.filter(item => item.name.trim() !== ''),
        });

        // Show success message
        Alert.alert(
          '🎉 Quote Submitted!',
          'Your quote has been sent to the property owner. You will be notified when they respond.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                router.replace(`/(vendor)/maintenance/${id}`);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'submit'} quote. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      // Validate at least some data is entered
      const hasData = lineItems.some(item => item.name.trim() !== '' || item.unit_price > 0);
      if (!hasData) {
        Alert.alert('Nothing to Save', 'Please add at least one item before saving draft');
        return;
      }

      setSubmitting(true);

      // For now, just show a message (AsyncStorage needs to be properly set up)
      // TODO: Implement actual draft saving once AsyncStorage is configured
      Alert.alert(
        '💾 Draft Feature Coming Soon',
        'Draft saving will be available in the next update. For now, please complete your quote or take a screenshot.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Error', 'Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Revise Quote' : 'Submit Quote'}</Text>
        <TouchableOpacity onPress={handleSaveDraft} style={styles.headerButton}>
          <Ionicons name="save-outline" size={24} color={RSA.blue} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Timeline */}
        <View style={styles.timelineContainer}>
          <View style={styles.timelineHeader}>
            <Ionicons name="location" size={20} color={RSA.blue} />
            <Text style={styles.timelineText}>Step 2 of 5: Create Quote</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '40%' }]} />
          </View>
          <View style={styles.timelineSteps}>
            <View style={styles.timelineStep}>
              <View style={[styles.stepDot, styles.stepDotComplete]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.stepLabel}>View</Text>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineStep}>
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <Text style={[styles.stepLabel, styles.stepLabelActive]}>Quote</Text>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineStep}>
              <View style={styles.stepDot} />
              <Text style={styles.stepLabel}>Wait</Text>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineStep}>
              <View style={styles.stepDot} />
              <Text style={styles.stepLabel}>Work</Text>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineStep}>
              <View style={styles.stepDot} />
              <Text style={styles.stepLabel}>💰</Text>
            </View>
          </View>
        </View>

        {/* Tip */}
        <View style={styles.tipContainer}>
          <Ionicons name="bulb" size={20} color={colors.warning[600]} />
          <Text style={styles.tipText}>Tip: Add all items needed for this job</Text>
        </View>

        {/* Work Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Items (Components)</Text>
          
          {lineItems.map((item, index) => (
            <View key={item.id} style={styles.lineItemCard}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemNumber}>{index + 1}.</Text>
                {lineItems.length > 1 && (
                  <TouchableOpacity 
                    onPress={() => removeLineItem(item.id)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error[500]} />
                  </TouchableOpacity>
                )}
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="Item name (e.g., Pipe Replacement)"
                placeholderTextColor={colors.gray[400]}
                value={item.name}
                onChangeText={(text) => updateLineItem(item.id, 'name', text)}
              />
              
              <View style={styles.lineItemRow}>
                <View style={styles.lineItemField}>
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <TextInput
                    style={styles.inputSmall}
                    placeholder="1"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="numeric"
                    value={item.quantity.toString()}
                    onChangeText={(text) => updateLineItem(item.id, 'quantity', parseInt(text) || 0)}
                  />
                </View>
                
                <View style={styles.lineItemField}>
                  <Text style={styles.fieldLabel}>Unit Price (R)</Text>
                  <TextInput
                    style={styles.inputSmall}
                    placeholder="0"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="numeric"
                    value={item.unit_price > 0 ? item.unit_price.toString() : ''}
                    onChangeText={(text) => updateLineItem(item.id, 'unit_price', parseFloat(text) || 0)}
                  />
                </View>
              </View>
              
              <View style={styles.lineItemTotal}>
                <Text style={styles.lineItemTotalLabel}>Item Total:</Text>
                <Text style={styles.lineItemTotalAmount}>
                  R {(item.quantity * item.unit_price).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addLineItem}>
            <Ionicons name="add-circle" size={24} color={RSA.blue} />
            <Text style={styles.addButtonText}>Add Item</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.templatesButton} 
            onPress={() => setShowTemplates(!showTemplates)}
          >
            <Ionicons name="list" size={20} color={RSA.blue} />
            <Text style={styles.templatesButtonText}>Use Common Templates</Text>
          </TouchableOpacity>

          {showTemplates && (
            <View style={styles.templatesContainer}>
              {COMMON_ITEMS.map((template, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.templateItem}
                  onPress={() => handleUseTemplate(template)}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templatePrice}>R {template.typical_price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Cost Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Cost Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items Total</Text>
              <Text style={styles.summaryValue}>
                R {subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>VAT (15%)</Text>
              <Text style={styles.summaryValue}>
                R {vatAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <TextInput
                style={styles.discountInput}
                placeholder="0"
                placeholderTextColor={colors.gray[400]}
                keyboardType="numeric"
                value={discount > 0 ? discount.toString() : ''}
                onChangeText={(text) => setDiscount(parseFloat(text) || 0)}
              />
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>TOTAL</Text>
              <Text style={styles.summaryTotalAmount}>
                R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.earningsContainer}>
              <Ionicons name="checkmark-circle" size={20} color={RSA.green} />
              <Text style={styles.earningsText}>
                You'll earn: ~R {estimatedEarnings.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <Text style={styles.earningsNote}>(after platform fee)</Text>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱️ How long? (Required)</Text>
          <TouchableOpacity 
            style={styles.pickerButton}
            onPress={() => setShowDurationPicker(!showDurationPicker)}
          >
            <Text style={duration ? styles.pickerButtonTextSelected : styles.pickerButtonText}>
              {duration || 'Select duration'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
          </TouchableOpacity>
          
          {showDurationPicker && (
            <View style={styles.pickerContainer}>
              {DURATION_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.pickerOption}
                  onPress={() => {
                    setDuration(option);
                    setShowDurationPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{option}</Text>
                  {duration === option && (
                    <Ionicons name="checkmark" size={20} color={RSA.blue} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Warranty */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛡️ Warranty (Optional)</Text>
          <TouchableOpacity 
            style={styles.pickerButton}
            onPress={() => setShowWarrantyPicker(!showWarrantyPicker)}
          >
            <Text style={styles.pickerButtonTextSelected}>{warranty}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
          </TouchableOpacity>
          
          {showWarrantyPicker && (
            <View style={styles.pickerContainer}>
              {WARRANTY_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.pickerOption}
                  onPress={() => {
                    setWarranty(option);
                    setShowWarrantyPicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{option}</Text>
                  {warranty === option && (
                    <Ionicons name="checkmark" size={20} color={RSA.blue} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Notes (Optional)</Text>
          <Text style={styles.exampleText}>
            Example: "Includes all materials and cleanup"
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Add any additional notes..."
            placeholderTextColor={colors.gray[400]}
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.saveDraftButton} 
          onPress={handleSaveDraft}
        >
          <Text style={styles.saveDraftButtonText}>Save Draft</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>{isEditMode ? 'Update Quote' : 'Submit Quote'}</Text>
              <Ionicons name={isEditMode ? "checkmark-circle" : "rocket"} size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  scrollView: { flex: 1 },

  timelineContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  timelineText: { fontSize: 16, fontWeight: '700', color: RSA.blue },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray[200],
    borderRadius: 2,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: RSA.blue,
    borderRadius: 2,
  },
  timelineSteps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineStep: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotComplete: { backgroundColor: RSA.green },
  stepDotActive: { backgroundColor: RSA.blue },
  stepLabel: { fontSize: 11, color: colors.gray[500], fontWeight: '600' },
  stepLabelActive: { color: RSA.blue },
  timelineLine: { flex: 1, height: 2, backgroundColor: colors.gray[200], marginHorizontal: 4 },

  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning[50],
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  tipText: { flex: 1, fontSize: 14, color: colors.warning[700], fontWeight: '600' },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },

  lineItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lineItemNumber: { fontSize: 18, fontWeight: '700', color: RSA.blue },
  removeButton: { padding: 4 },

  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  lineItemRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  lineItemField: { flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  inputSmall: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  lineItemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  lineItemTotalLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  lineItemTotalAmount: { fontSize: 16, fontWeight: '700', color: RSA.green },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.info[50],
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  addButtonText: { fontSize: 15, fontWeight: '700', color: RSA.blue },

  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  templatesButtonText: { fontSize: 14, fontWeight: '600', color: RSA.blue },

  templatesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
    overflow: 'hidden',
  },
  templateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  templateName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  templatePrice: { fontSize: 14, color: RSA.green, fontWeight: '700' },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: RSA.blue,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 15, color: '#6b7280' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  discountInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    width: 100,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  summaryTotalLabel: { fontSize: 18, fontWeight: '700', color: '#111827' },
  summaryTotalAmount: { fontSize: 24, fontWeight: '700', color: RSA.blue },
  earningsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  earningsText: { fontSize: 16, fontWeight: '700', color: RSA.green },
  earningsNote: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center' },

  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonText: { fontSize: 15, color: colors.gray[400] },
  pickerButtonTextSelected: { fontSize: 15, color: '#111827', fontWeight: '600' },

  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
    maxHeight: 200,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerOptionText: { fontSize: 15, color: '#111827' },

  exampleText: { fontSize: 13, color: '#9ca3af', marginBottom: 8, fontStyle: 'italic' },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
  },

  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveDraftButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: RSA.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDraftButtonText: { fontSize: 16, fontWeight: '700', color: RSA.blue },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RSA.blue,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
