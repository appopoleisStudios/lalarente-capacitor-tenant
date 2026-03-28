import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { inspectionsApi } from '../api/inspectionsApi';
import { uploadSignature } from '../../leases/api/storageService';
import { supabase } from '@/src/lib/supabase';
import { exportInspectionReportPdf } from '../../owner/utils/pdfReports';
import SignatureModal from '../../leases/components/SignatureModal';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';
import {
  InspectionWithRelations,
  RoomInspection,
  RoomCondition,
  InspectionRooms,
  DEFAULT_ROOMS,
  ROOM_ITEMS,
  KeyHandover,
} from '../types';

const COLORS = {
  owner: { primary: '#002395', secondary: '#FFB81C' }, // RSA Blue
  tenant: { primary: '#007A4D', secondary: '#FFB81C' }, // RSA Green
};

const CONDITIONS: { value: RoomCondition; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: '#4CAF50' },
  { value: 'good', label: 'Good', color: '#8BC34A' },
  { value: 'fair', label: 'Fair', color: '#FFC107' },
  { value: 'poor', label: 'Poor', color: '#FF9800' },
  { value: 'damaged', label: 'Damaged', color: '#F44336' },
];

interface Props {
  role: 'owner' | 'tenant';
}

export default function InspectionScreen({ role = 'owner' }: Props) {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const colors = COLORS[role];

  const [inspection, setInspection] = useState<InspectionWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [rooms, setRooms] = useState<RoomInspection[]>([]);
  const [keys, setKeys] = useState<KeyHandover>({
    physicalKeys: 0,
    accessCards: 0,
    remoteControls: 0,
    accessCodes: [],
  });
  const [generalNotes, setGeneralNotes] = useState('');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) {
      loadInspection();
    }
  }, [id]);

  const loadInspection = async () => {
    try {
      setError(null);
      const inspectionId = Array.isArray(id) ? id[0] : id;
      const data = await inspectionsApi.getInspection(inspectionId);
      setInspection(data);

      // Initialize rooms from existing data or defaults
      const existingRooms = (data.rooms as InspectionRooms)?.rooms || [];
      if (existingRooms.length > 0) {
        setRooms(existingRooms);
      } else {
        // Initialize with default rooms
        const initialRooms: RoomInspection[] = DEFAULT_ROOMS.map(roomName => ({
          name: roomName,
          items: (ROOM_ITEMS[roomName] || []).map(item => ({
            name: item,
            condition: 'good' as RoomCondition,
            notes: '',
            photos: [],
          })),
          overallCondition: 'good' as RoomCondition,
          notes: '',
          photos: [],
        }));
        setRooms(initialRooms);
      }

      // Initialize keys
      const existingKeys = (data.rooms as InspectionRooms)?.keys;
      if (existingKeys) {
        setKeys(existingKeys);
      }

      // Initialize general notes
      setGeneralNotes((data.rooms as InspectionRooms)?.generalNotes || '');
    } catch (err) {
      console.error('Error loading inspection:', JSON.stringify(err));
      setError(err instanceof Error ? err.message : 'Failed to load inspection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateItemCondition = (itemIndex: number, condition: RoomCondition) => {
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex].items[itemIndex].condition = condition;
    setRooms(updatedRooms);
  };

  const updateItemNotes = (itemIndex: number, notes: string) => {
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex].items[itemIndex].notes = notes;
    setRooms(updatedRooms);
  };

  const updateRoomCondition = (condition: RoomCondition) => {
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex].overallCondition = condition;
    setRooms(updatedRooms);
  };

  const updateRoomNotes = (notes: string) => {
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex].notes = notes;
    setRooms(updatedRooms);
  };

  const pickImage = async (itemIndex?: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const updatedRooms = [...rooms];
      if (itemIndex !== undefined) {
        // Add to item photos
        const photos = updatedRooms[currentRoomIndex].items[itemIndex].photos || [];
        photos.push(result.assets[0].uri);
        updatedRooms[currentRoomIndex].items[itemIndex].photos = photos;
      } else {
        // Add to room photos
        const photos = updatedRooms[currentRoomIndex].photos || [];
        photos.push(result.assets[0].uri);
        updatedRooms[currentRoomIndex].photos = photos;
      }
      setRooms(updatedRooms);
    }
  };

  const takePhoto = async (itemIndex?: number) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const updatedRooms = [...rooms];
      if (itemIndex !== undefined) {
        const photos = updatedRooms[currentRoomIndex].items[itemIndex].photos || [];
        photos.push(result.assets[0].uri);
        updatedRooms[currentRoomIndex].items[itemIndex].photos = photos;
      } else {
        const photos = updatedRooms[currentRoomIndex].photos || [];
        photos.push(result.assets[0].uri);
        updatedRooms[currentRoomIndex].photos = photos;
      }
      setRooms(updatedRooms);
    }
  };

  const saveProgress = async () => {
    if (!inspection) return;

    try {
      setSaving(true);
      const roomsData: InspectionRooms = {
        rooms,
        generalNotes,
        keys,
      };
      await inspectionsApi.updateInspectionRooms(inspection.id, roomsData);
      Alert.alert('Saved', 'Inspection progress saved successfully');
    } catch (err) {
      console.error('Error saving inspection:', err);
      Alert.alert('Error', 'Failed to save inspection progress');
    } finally {
      setSaving(false);
    }
  };

  const completeInspection = async () => {
    if (!inspection) return;

    // Enforce photo requirement for every room
    if (!allRoomsHavePhotos) {
      validatePhotosBeforeAction('Complete', () => {});
      return;
    }

    Alert.alert(
      'Complete Inspection',
      'Are you sure you want to complete this inspection? You can still sign after completion.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              setSaving(true);
              // Save final data
              const roomsData: InspectionRooms = {
                rooms,
                generalNotes,
                keys,
              };
              await inspectionsApi.updateInspectionRooms(inspection.id, roomsData);
              await inspectionsApi.completeInspection(inspection.id);
              Alert.alert('Success', 'Inspection completed. Waiting for signatures.', [
                { text: 'OK', onPress: () => loadInspection() },
              ]);
            } catch (err) {
              console.error('Error completing inspection:', err);
              Alert.alert('Error', 'Failed to complete inspection');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleSign = () => {
    validatePhotosBeforeAction('Sign', () => {
      setShowSignatureModal(true);
    });
  };

  const handleSignatureSave = async (signatureBase64: string) => {
    if (!inspection) return;

    try {
      setSaving(true);

      // Upload signature
      const signatureUrl = await uploadSignature(
        inspection.id,
        role,
        signatureBase64
      );

      // Update inspection with signature
      await inspectionsApi.signInspection(inspection.id, role, signatureUrl);

      Alert.alert('Success', 'Inspection signed successfully!', [
        { text: 'OK', onPress: () => loadInspection() },
      ]);
    } catch (err) {
      console.error('Error signing inspection:', err);
      Alert.alert('Error', 'Failed to sign inspection');
    } finally {
      setSaving(false);
      setShowSignatureModal(false);
    }
  };

  const handleExportReport = async () => {
    if (!inspection) return;
    try {
      setExporting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await exportInspectionReportPdf(inspection.id, user.id);
      const docsPath = role === 'owner' ? '/(owner)/documents' : '/(tenant)/documents';
      Alert.alert('Report Saved', 'Inspection report saved to your documents.', [
        { text: 'View Documents', onPress: () => router.push(docsPath as any) },
        { text: 'Done', style: 'cancel' },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to generate inspection report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const currentRoom = rooms[currentRoomIndex];
  const isLastRoom = currentRoomIndex === rooms.length - 1;
  const isFirstRoom = currentRoomIndex === 0;
  const canComplete = inspection?.status === 'in_progress' || inspection?.status === 'scheduled';
  const canSign = inspection?.status === 'pending_signatures';
  const hasSigned = role === 'owner'
    ? !!inspection?.owner_signed_at
    : !!inspection?.tenant_signed_at;

  // Photo validation — every room must have at least 1 photo (room-level or item-level)
  const getRoomPhotoCount = (room: RoomInspection): number => {
    const roomPhotos = room.photos?.length || 0;
    const itemPhotos = room.items.reduce((sum, item) => sum + (item.photos?.length || 0), 0);
    return roomPhotos + itemPhotos;
  };

  const roomsWithoutPhotos = rooms
    .map((room, idx) => ({ name: room.name, index: idx, photos: getRoomPhotoCount(room) }))
    .filter(r => r.photos === 0);

  const allRoomsHavePhotos = roomsWithoutPhotos.length === 0;

  const validatePhotosBeforeAction = (actionName: string, onValid: () => void) => {
    if (!allRoomsHavePhotos) {
      const missing = roomsWithoutPhotos.map(r => `  • ${r.name}`).join('\n');
      Alert.alert(
        `Cannot ${actionName}`,
        `Every room requires at least one photo before you can ${actionName.toLowerCase()}.\n\nRooms missing photos:\n${missing}`,
        [
          { text: 'OK' },
          ...(roomsWithoutPhotos.length > 0
            ? [{
                text: `Go to ${roomsWithoutPhotos[0].name}`,
                onPress: () => setCurrentRoomIndex(roomsWithoutPhotos[0].index),
              }]
            : []),
        ]
      );
      return;
    }
    onValid();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !inspection) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>{error || 'Inspection not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadInspection}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {inspection.type === 'move_in' ? 'Move-In' : 'Move-Out'} Inspection
              </Text>
              <Text style={styles.headerSubtitle}>{inspection.property?.title}</Text>
            </View>
            <TouchableOpacity onPress={saveProgress} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="save-outline" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((currentRoomIndex + 1) / rooms.length) * 100}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Room {currentRoomIndex + 1} of {rooms.length}
          </Text>
          {/* Room photo status dots */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomDots}>
            {rooms.map((room, idx) => {
              const hasPhotos = getRoomPhotoCount(room) > 0;
              const isCurrent = idx === currentRoomIndex;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.roomDot,
                    isCurrent && { borderColor: colors.primary, borderWidth: 2 },
                    hasPhotos ? styles.roomDotGreen : styles.roomDotRed,
                  ]}
                  onPress={() => setCurrentRoomIndex(idx)}
                >
                  <Text style={styles.roomDotText} numberOfLines={1}>
                    {room.name.length > 8 ? room.name.slice(0, 7) + '…' : room.name}
                  </Text>
                  {hasPhotos ? (
                    <Ionicons name="camera" size={10} color="#4CAF50" />
                  ) : (
                    <Ionicons name="camera-outline" size={10} color="#F44336" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Room Header */}
          <View style={styles.roomHeader}>
            <Text style={styles.roomName}>{currentRoom?.name}</Text>
            <View style={styles.conditionSelector}>
              {CONDITIONS.map(cond => (
                <TouchableOpacity
                  key={cond.value}
                  style={[
                    styles.conditionChip,
                    currentRoom?.overallCondition === cond.value && {
                      backgroundColor: cond.color,
                    },
                  ]}
                  onPress={() => updateRoomCondition(cond.value)}
                >
                  <Text
                    style={[
                      styles.conditionChipText,
                      currentRoom?.overallCondition === cond.value && { color: '#FFF' },
                    ]}
                  >
                    {cond.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Items to Inspect</Text>
              {currentRoom && getRoomPhotoCount(currentRoom) === 0 && (
                <View style={styles.photoWarningBadge}>
                  <Ionicons name="warning" size={14} color="#F44336" />
                  <Text style={styles.photoWarningText}>Photos required</Text>
                </View>
              )}
              {currentRoom && getRoomPhotoCount(currentRoom) > 0 && (
                <View style={styles.photoCountBadge}>
                  <Ionicons name="camera" size={14} color="#4CAF50" />
                  <Text style={styles.photoCountText}>{getRoomPhotoCount(currentRoom)}</Text>
                </View>
              )}
            </View>
            {currentRoom?.items?.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {(item.photos?.length || 0) > 0 && (
                      <View style={styles.itemPhotoBadge}>
                        <Ionicons name="camera" size={12} color="#4CAF50" />
                        <Text style={styles.itemPhotoCount}>{item.photos!.length}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.photoButtons}>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePhoto(index)}
                    >
                      <Ionicons name="camera" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => pickImage(index)}
                    >
                      <Ionicons name="image" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Condition Buttons */}
                <View style={styles.conditionButtons}>
                  {CONDITIONS.map(cond => (
                    <TouchableOpacity
                      key={cond.value}
                      style={[
                        styles.conditionButton,
                        item.condition === cond.value && {
                          backgroundColor: cond.color,
                          borderColor: cond.color,
                        },
                      ]}
                      onPress={() => updateItemCondition(index, cond.value)}
                    >
                      <Text
                        style={[
                          styles.conditionButtonText,
                          item.condition === cond.value && { color: '#FFF' },
                        ]}
                      >
                        {cond.label[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notes */}
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add notes..."
                  value={item.notes}
                  onChangeText={text => updateItemNotes(index, text)}
                  multiline
                />

                {/* Photos */}
                {item.photos && item.photos.length > 0 && (
                  <ScrollView horizontal style={styles.photoScroll}>
                    {item.photos.map((photo, photoIndex) => (
                      <Image
                        key={photoIndex}
                        source={{ uri: photo }}
                        style={styles.photoThumbnail}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            ))}
          </View>

          {/* Room Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Room Photos</Text>
            <View style={styles.roomPhotoActions}>
              <TouchableOpacity style={[styles.roomPhotoButton, { borderColor: colors.primary }]} onPress={() => takePhoto()}>
                <Ionicons name="camera" size={22} color={colors.primary} />
                <Text style={[styles.roomPhotoButtonText, { color: colors.primary }]}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roomPhotoButton, { borderColor: colors.primary }]} onPress={() => pickImage()}>
                <Ionicons name="image" size={22} color={colors.primary} />
                <Text style={[styles.roomPhotoButtonText, { color: colors.primary }]}>Gallery</Text>
              </TouchableOpacity>
            </View>
            {currentRoom?.photos && currentRoom.photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {currentRoom.photos.map((photo, photoIndex) => (
                  <Image key={photoIndex} source={{ uri: photo }} style={styles.photoThumbnail} />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noPhotosHint}>
                <Ionicons name="alert-circle-outline" size={18} color="#F44336" />
                <Text style={styles.noPhotosHintText}>
                  At least one photo of this room is required before sign-off
                </Text>
              </View>
            )}
          </View>

          {/* Room Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Room Notes</Text>
            <TextInput
              style={[styles.notesInput, styles.roomNotes]}
              placeholder="Additional notes for this room..."
              value={currentRoom?.notes}
              onChangeText={updateRoomNotes}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Key Handover (only on last room) */}
          {isLastRoom && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Handover</Text>
              <View style={styles.keyRow}>
                <Text style={styles.keyLabel}>Physical Keys</Text>
                <View style={styles.keyCounter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setKeys({ ...keys, physicalKeys: Math.max(0, keys.physicalKeys - 1) })}
                  >
                    <Ionicons name="remove" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{keys.physicalKeys}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setKeys({ ...keys, physicalKeys: keys.physicalKeys + 1 })}
                  >
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.keyRow}>
                <Text style={styles.keyLabel}>Access Cards</Text>
                <View style={styles.keyCounter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setKeys({ ...keys, accessCards: Math.max(0, keys.accessCards - 1) })}
                  >
                    <Ionicons name="remove" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{keys.accessCards}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setKeys({ ...keys, accessCards: keys.accessCards + 1 })}
                  >
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.keyRow}>
                <Text style={styles.keyLabel}>Remote Controls</Text>
                <View style={styles.keyCounter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setKeys({ ...keys, remoteControls: Math.max(0, keys.remoteControls - 1) })}
                  >
                    <Ionicons name="remove" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{keys.remoteControls}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setKeys({ ...keys, remoteControls: keys.remoteControls + 1 })}
                  >
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* General Notes (on last room) */}
          {isLastRoom && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>General Notes</Text>
              <TextInput
                style={[styles.notesInput, styles.roomNotes]}
                placeholder="Overall inspection notes..."
                value={generalNotes}
                onChangeText={setGeneralNotes}
                multiline
                numberOfLines={4}
              />
            </View>
          )}

          {/* Signatures Section (when pending) */}
          {canSign && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Signatures</Text>
              <View style={styles.signatureCard}>
                <View style={styles.signatureRow}>
                  <Text style={styles.signatureLabel}>Owner</Text>
                  {inspection.owner_signed_at ? (
                    <View style={styles.signedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={styles.signedText}>Signed</Text>
                    </View>
                  ) : (
                    <Text style={styles.pendingText}>Pending</Text>
                  )}
                </View>
                <View style={styles.signatureRow}>
                  <Text style={styles.signatureLabel}>Tenant</Text>
                  {inspection.tenant_signed_at ? (
                    <View style={styles.signedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={styles.signedText}>Signed</Text>
                    </View>
                  ) : (
                    <Text style={styles.pendingText}>Pending</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={[styles.navButton, isFirstRoom && styles.navButtonDisabled]}
            onPress={() => setCurrentRoomIndex(currentRoomIndex - 1)}
            disabled={isFirstRoom}
          >
            <Ionicons name="chevron-back" size={24} color={isFirstRoom ? '#CCC' : colors.primary} />
            <Text style={[styles.navButtonText, isFirstRoom && { color: '#CCC' }]}>Previous</Text>
          </TouchableOpacity>

          {isLastRoom ? (
            canSign ? (
              hasSigned ? (
                <View style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: '#4CAF50' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <Text style={[styles.navButtonText, { color: '#FFF' }]}>Signed</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: colors.primary }]}
                  onPress={handleSign}
                  disabled={saving}
                >
                  <Ionicons name="create" size={24} color="#FFF" />
                  <Text style={[styles.navButtonText, { color: '#FFF' }]}>Sign</Text>
                </TouchableOpacity>
              )
            ) : canComplete ? (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={completeInspection}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={24} color="#FFF" />
                    <Text style={[styles.navButtonText, { color: '#FFF' }]}>Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              inspection?.status === 'completed' ? (
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: colors.primary }]}
                  onPress={handleExportReport}
                  disabled={exporting}
                >
                  {exporting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={24} color="#FFF" />
                      <Text style={[styles.navButtonText, { color: '#FFF' }]}>Export Report</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.navButton, styles.navButtonDisabled]}>
                  <Ionicons name="checkmark-done" size={24} color="#CCC" />
                  <Text style={[styles.navButtonText, { color: '#CCC' }]}>Completed</Text>
                </View>
              )
            )
          ) : (
            <TouchableOpacity
              style={[styles.navButton, { borderColor: colors.primary }]}
              onPress={() => setCurrentRoomIndex(currentRoomIndex + 1)}
            >
              <Text style={[styles.navButtonText, { color: colors.primary }]}>Next</Text>
              <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Signature Modal */}
        <SignatureModal
          visible={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSave={handleSignatureSave}
          title="Sign Inspection Report"
          description="By signing below, you confirm that you have reviewed and agree with this inspection report."
          primaryColor={colors.primary}
        />
      </View>
      </KeyboardAvoidingView>
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
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  roomHeader: {
    padding: 16,
    backgroundColor: '#FFF',
  },
  roomName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  conditionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  conditionChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    padding: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  conditionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  conditionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 40,
  },
  roomNotes: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  photoScroll: {
    marginTop: 12,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  keyLabel: {
    fontSize: 16,
    color: '#333',
  },
  keyCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  signatureCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  signatureLabel: {
    fontSize: 16,
    color: '#333',
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  pendingText: {
    fontSize: 14,
    color: '#FFA500',
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    gap: 4,
  },
  navButtonPrimary: {
    borderWidth: 0,
  },
  navButtonDisabled: {
    borderColor: '#E0E0E0',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#002395',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  roomDots: {
    marginTop: 10,
    flexDirection: 'row',
  },
  roomDot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 4,
  },
  roomDotGreen: {
    backgroundColor: '#E8F5E9',
  },
  roomDotRed: {
    backgroundColor: '#FFEBEE',
  },
  roomDotText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    maxWidth: 60,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoWarningText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F44336',
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  itemPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemPhotoCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
  },
  roomPhotoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  roomPhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#FFF',
  },
  roomPhotoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noPhotosHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3F0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  noPhotosHintText: {
    flex: 1,
    fontSize: 13,
    color: '#D32F2F',
    lineHeight: 18,
  },
});
