import React, { useState, useEffect, useCallback } from 'react';
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
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { inspectionsApi } from '../api/inspectionsApi';
import { uploadSignature } from '../../leases/api/storageService';
import { supabase, STORAGE_BUCKETS } from '@/src/lib/supabase';
import { uploadPhoto } from '@/src/shared/utils/photoUpload';
import { exportInspectionReportPdf } from '../../owner/utils/pdfReports';
import SignatureModal from '../../leases/components/SignatureModal';
import PhotoMarkupModal from '../components/PhotoMarkupModal';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';
import { reportApiError } from '@/src/core/observability/sentry';
import {
  InspectionWithRelations,
  RoomInspection,
  RoomCondition,
  InspectionRooms,
  KeyHandover,
  TenantInspectionComment,
} from '../types';
import { parseInspectionRoomsField } from '../utils/normalizeRooms';

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
  const [tenantComments, setTenantComments] = useState<TenantInspectionComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  // Tenants review the report: they can add comments and raise issues but
  // cannot change or remove anything the owner recorded.
  const readOnly = role === 'tenant';
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [markupTarget, setMarkupTarget] = useState<{
    url: string;
    photoIndex: number;
    itemIndex?: number;
  } | null>(null);

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

      const roomsPayload = parseInspectionRoomsField(data.rooms);
      setRooms(roomsPayload.rooms);
      setKeys(
        roomsPayload.keys ?? {
          physicalKeys: 0,
          accessCards: 0,
          remoteControls: 0,
          accessCodes: [],
        }
      );
      setGeneralNotes(roomsPayload.generalNotes ?? '');
      setTenantComments(roomsPayload.tenantComments ?? []);
      setCurrentRoomIndex(0);
    } catch (err) {
      reportApiError(err, 'inspections', 'select');
      console.error('Error loading inspection:', JSON.stringify(err));
      setError(err instanceof Error ? err.message : 'Failed to load inspection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pick up comments and maintenance links added while this screen was in
  // the background, without resetting the room being viewed.
  useFocusEffect(
    useCallback(() => {
      const inspectionId = Array.isArray(id) ? id[0] : id;
      if (!inspectionId) return;
      inspectionsApi
        .getTenantComments(inspectionId)
        .then(setTenantComments)
        .catch(() => {});
    }, [id])
  );

  const addComment = async (roomName: string) => {
    if (!inspection || !commentDraft.trim()) return;
    try {
      setAddingComment(true);
      const updated = await inspectionsApi.addTenantComment(inspection.id, roomName, commentDraft);
      setTenantComments(updated);
      setCommentDraft('');
      Keyboard.dismiss();
    } catch (err) {
      reportApiError(err, 'inspections', 'update');
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const raiseIssue = (comment: TenantInspectionComment) => {
    if (!inspection) return;
    router.push({
      pathname: '/(tenant)/maintenance/report',
      params: {
        inspectionId: inspection.id,
        inspectionCommentId: comment.id,
        prefillTitle: `${comment.room}: inspection issue`,
        prefillDescription: `Raised from the ${
          inspection.type === 'move_in' ? 'move-in' : inspection.type.replace('_', '-')
        } inspection (${comment.room}).\n\n${comment.text}`,
      },
    } as any);
  };

  const updateItemCondition = (itemIndex: number, condition: RoomCondition) => {
    const room = rooms[currentRoomIndex];
    if (!room?.items?.[itemIndex]) return;
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex] = {
      ...room,
      items: room.items.map((item, i) => (i === itemIndex ? { ...item, condition } : item)),
    };
    setRooms(updatedRooms);
  };

  const updateItemNotes = (itemIndex: number, notes: string) => {
    const room = rooms[currentRoomIndex];
    if (!room?.items?.[itemIndex]) return;
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex] = {
      ...room,
      items: room.items.map((item, i) => (i === itemIndex ? { ...item, notes } : item)),
    };
    setRooms(updatedRooms);
  };

  const updateRoomCondition = (condition: RoomCondition) => {
    const room = rooms[currentRoomIndex];
    if (!room) return;
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex] = { ...room, overallCondition: condition };
    setRooms(updatedRooms);
  };

  const updateRoomNotes = (notes: string) => {
    const room = rooms[currentRoomIndex];
    if (!room) return;
    const updatedRooms = [...rooms];
    updatedRooms[currentRoomIndex] = { ...room, notes };
    setRooms(updatedRooms);
  };

  // Photos are uploaded straight away: they used to be stored as file:// paths
  // on the inspector's phone, so the other party (and the PDF) never saw them.
  const addPhoto = async (localUri: string, itemIndex?: number) => {
    if (!inspection || rooms.length === 0) return;
    const roomIdx = Math.min(Math.max(currentRoomIndex, 0), rooms.length - 1);
    try {
      setUploadingPhoto(true);
      const url = await uploadPhoto(STORAGE_BUCKETS.INSPECTION_PHOTOS, inspection.id, localUri);
      setRooms((prev) => {
        const updated = [...prev];
        const room = updated[roomIdx];
        if (!room) return prev;
        if (itemIndex !== undefined && room.items[itemIndex]) {
          const photos = [...(room.items[itemIndex].photos || []), url];
          updated[roomIdx] = {
            ...room,
            items: room.items.map((item, i) => (i === itemIndex ? { ...item, photos } : item)),
          };
        } else {
          updated[roomIdx] = { ...room, photos: [...(room.photos || []), url] };
        }
        return updated;
      });
    } catch (err) {
      reportApiError(err, 'inspections', 'update');
      Alert.alert('Upload failed', 'The photo could not be uploaded. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Like listing photos: a photo can be removed until the inspection is
  // completed. Saved with the rest of the inspection (Save / Complete).
  const removePhoto = (photoIndex: number, itemIndex?: number) => {
    const roomIdx = Math.min(Math.max(currentRoomIndex, 0), rooms.length - 1);
    setRooms((prev) => {
      const updated = [...prev];
      const room = updated[roomIdx];
      if (!room) return prev;
      if (itemIndex !== undefined && room.items[itemIndex]) {
        updated[roomIdx] = {
          ...room,
          items: room.items.map((item, i) =>
            i === itemIndex
              ? { ...item, photos: (item.photos || []).filter((_, p) => p !== photoIndex) }
              : item
          ),
        };
      } else {
        updated[roomIdx] = {
          ...room,
          photos: (room.photos || []).filter((_, p) => p !== photoIndex),
        };
      }
      return updated;
    });
  };

  // The marked-up copy is uploaded as a new file and replaces the original in
  // place; the original stays in storage until the inspection is saved.
  const saveMarkup = async (localUri: string) => {
    const target = markupTarget;
    setMarkupTarget(null);
    if (!inspection || !target) return;
    const roomIdx = Math.min(Math.max(currentRoomIndex, 0), rooms.length - 1);
    try {
      setUploadingPhoto(true);
      const url = await uploadPhoto(STORAGE_BUCKETS.INSPECTION_PHOTOS, inspection.id, localUri);
      const swap = (photos: string[] = []) =>
        photos.map((p, i) => (i === target.photoIndex ? url : p));
      setRooms((prev) => {
        const updated = [...prev];
        const room = updated[roomIdx];
        if (!room) return prev;
        if (target.itemIndex !== undefined && room.items[target.itemIndex]) {
          updated[roomIdx] = {
            ...room,
            items: room.items.map((item, i) =>
              i === target.itemIndex ? { ...item, photos: swap(item.photos) } : item
            ),
          };
        } else {
          updated[roomIdx] = { ...room, photos: swap(room.photos) };
        }
        return updated;
      });
    } catch (err) {
      reportApiError(err, 'inspections', 'update');
      Alert.alert('Upload failed', 'The marked-up photo could not be saved. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickImage = async (itemIndex?: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await addPhoto(result.assets[0].uri, itemIndex);
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
      await addPhoto(result.assets[0].uri, itemIndex);
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
      reportApiError(err, 'inspections', 'update');
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
              reportApiError(err, 'inspections', 'update');
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
      const signatureUrl = await uploadSignature(inspection.id, role, signatureBase64);

      // Update inspection with signature
      await inspectionsApi.signInspection(inspection.id, role, signatureUrl);

      Alert.alert('Success', 'Inspection signed successfully!', [
        { text: 'OK', onPress: () => loadInspection() },
      ]);
    } catch (err) {
      reportApiError(err, 'inspections', 'update');
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  const roomCount = rooms.length;
  const safeRoomIndex = roomCount > 0 ? Math.min(Math.max(currentRoomIndex, 0), roomCount - 1) : 0;
  const currentRoom = roomCount > 0 ? rooms[safeRoomIndex] : undefined;
  const isLastRoom = roomCount > 0 && safeRoomIndex === roomCount - 1;
  const isFirstRoom = safeRoomIndex === 0;
  const roomComments = tenantComments.filter((c) => c.room === currentRoom?.name);
  const canComplete =
    !readOnly && (inspection?.status === 'in_progress' || inspection?.status === 'scheduled');
  const canSign = inspection?.status === 'pending_signatures';
  const hasSigned =
    role === 'owner' ? !!inspection?.owner_signed_at : !!inspection?.tenant_signed_at;

  // Photo validation — every room must have at least 1 photo (room-level or item-level)
  const getRoomPhotoCount = (room: RoomInspection | undefined): number => {
    if (!room) return 0;
    const roomPhotos = room.photos?.length || 0;
    const itemPhotos = (room.items ?? []).reduce(
      (sum, item) => sum + (item.photos?.length || 0),
      0
    );
    return roomPhotos + itemPhotos;
  };

  const roomsWithoutPhotos = rooms
    .map((room, idx) => ({ name: room.name, index: idx, photos: getRoomPhotoCount(room) }))
    .filter((r) => r.photos === 0);

  const allRoomsHavePhotos = roomsWithoutPhotos.length === 0;

  const validatePhotosBeforeAction = (actionName: string, onValid: () => void) => {
    if (!allRoomsHavePhotos) {
      const missing = roomsWithoutPhotos.map((r) => `  • ${r.name}`).join('\n');
      Alert.alert(
        `Cannot ${actionName}`,
        `Every room requires at least one photo before you can ${actionName.toLowerCase()}.\n\nRooms missing photos:\n${missing}`,
        [
          { text: 'OK' },
          ...(roomsWithoutPhotos.length > 0
            ? [
                {
                  text: `Go to ${roomsWithoutPhotos[0].name}`,
                  onPress: () => setCurrentRoomIndex(roomsWithoutPhotos[0].index),
                },
              ]
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
          <TouchableOpacity
            testID="inspection-retry"
            style={styles.retryButton}
            onPress={loadInspection}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (roomCount === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.errorText, { color: '#666' }]}>Preparing inspection checklist…</Text>
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
            <TouchableOpacity
              testID="inspection-back"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {inspection.type === 'move_in'
                  ? 'Move-In'
                  : inspection.type === 'move_out'
                    ? 'Move-Out'
                    : 'Periodic'}{' '}
                Inspection
              </Text>
              <Text style={styles.headerSubtitle}>{inspection.property?.title}</Text>
            </View>
            {inspection?.status === 'completed' ? (
              <TouchableOpacity
                testID="inspection-export-header"
                onPress={handleExportReport}
                disabled={exporting}
                style={[styles.headerExportBtn, { backgroundColor: colors.primary }]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#FFF" />
                    <Text style={styles.headerExportText}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : readOnly ? (
              <View style={{ width: 24 }} />
            ) : (
              <TouchableOpacity testID="inspection-save" onPress={saveProgress} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="save-outline" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${((safeRoomIndex + 1) / roomCount) * 100}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              Room {safeRoomIndex + 1} of {roomCount}
            </Text>
            {/* Room photo status dots */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomDots}>
              {rooms.map((room, idx) => {
                const hasPhotos = getRoomPhotoCount(room) > 0;
                const isCurrent = idx === safeRoomIndex;
                return (
                  <TouchableOpacity
                    testID={`inspection-room-tab-${idx}`}
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

          {/* handled: with the keyboard up, the first tap on "Add Comment" used to
              only dismiss the keyboard, so comments silently weren't posted */}
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {uploadingPhoto && (
              <View style={styles.uploadBanner} testID="inspection-photo-uploading">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.uploadBannerText}>Uploading photo…</Text>
              </View>
            )}
            {/* Room Header */}
            <View style={styles.roomHeader}>
              <Text style={styles.roomName}>{currentRoom?.name}</Text>
              <View style={styles.conditionSelector}>
                {CONDITIONS.map((cond) => (
                  <TouchableOpacity
                    testID={`inspection-room-condition-${cond.value}`}
                    key={cond.value}
                    style={[
                      styles.conditionChip,
                      currentRoom?.overallCondition === cond.value && {
                        backgroundColor: cond.color,
                      },
                    ]}
                    onPress={() => updateRoomCondition(cond.value)}
                    disabled={readOnly}
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
                    {!readOnly && (
                      <View style={styles.photoButtons}>
                        <TouchableOpacity
                          testID={`inspection-item-${index}-camera`}
                          style={styles.photoButton}
                          onPress={() => takePhoto(index)}
                        >
                          <Ionicons name="camera" size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          testID={`inspection-item-${index}-gallery`}
                          style={styles.photoButton}
                          onPress={() => pickImage(index)}
                        >
                          <Ionicons name="image" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Condition Buttons */}
                  <View style={styles.conditionButtons}>
                    {CONDITIONS.map((cond) => (
                      <TouchableOpacity
                        testID={`inspection-item-${index}-condition-${cond.value}`}
                        key={cond.value}
                        style={[
                          styles.conditionButton,
                          item.condition === cond.value && {
                            backgroundColor: cond.color,
                            borderColor: cond.color,
                          },
                        ]}
                        onPress={() => updateItemCondition(index, cond.value)}
                        disabled={readOnly}
                      >
                        {/* Full word, not the initial — "E G F P D" meant nothing */}
                        <Text
                          style={[
                            styles.conditionButtonText,
                            item.condition === cond.value && { color: '#FFF' },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                        >
                          {cond.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Notes */}
                  <TextInput
                    testID={`inspection-item-${index}-notes`}
                    style={styles.notesInput}
                    placeholder={readOnly ? 'No notes' : 'Add notes...'}
                    value={item.notes}
                    onChangeText={(text) => updateItemNotes(index, text)}
                    editable={!readOnly}
                    multiline
                  />

                  {/* Photos */}
                  {item.photos && item.photos.length > 0 && (
                    <ScrollView horizontal style={styles.photoScroll}>
                      {item.photos.map((photo, photoIndex) => (
                        <View key={photoIndex} style={styles.photoThumbWrap}>
                          <Image source={{ uri: photo }} style={styles.photoThumbnail} />
                          {canComplete && (
                            <TouchableOpacity
                              testID={`inspection-item-${index}-photo-markup`}
                              style={styles.photoMarkupWrap}
                              onPress={() =>
                                setMarkupTarget({ url: photo, photoIndex, itemIndex: index })
                              }
                              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                              accessibilityRole="button"
                              accessibilityLabel="Mark up photo"
                            >
                              <Ionicons name="brush" size={13} color="#FFF" />
                            </TouchableOpacity>
                          )}
                          {canComplete && (
                            <TouchableOpacity
                              testID={`inspection-item-${index}-photo-remove`}
                              style={styles.photoRemoveWrap}
                              onPress={() => removePhoto(photoIndex, index)}
                              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                              accessibilityRole="button"
                              accessibilityLabel="Remove photo"
                            >
                              <View style={styles.photoRemove}>
                                <Text style={styles.photoRemoveText}>×</Text>
                              </View>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))}
            </View>

            {/* Room Photos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Room Photos</Text>
              <View style={[styles.roomPhotoActions, readOnly && { display: 'none' }]}>
                <TouchableOpacity
                  testID="inspection-room-take-photo"
                  style={[styles.roomPhotoButton, { borderColor: colors.primary }]}
                  onPress={() => takePhoto()}
                >
                  <Ionicons name="camera" size={22} color={colors.primary} />
                  <Text style={[styles.roomPhotoButtonText, { color: colors.primary }]}>
                    Take Photo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="inspection-room-gallery"
                  style={[styles.roomPhotoButton, { borderColor: colors.primary }]}
                  onPress={() => pickImage()}
                >
                  <Ionicons name="image" size={22} color={colors.primary} />
                  <Text style={[styles.roomPhotoButtonText, { color: colors.primary }]}>
                    Gallery
                  </Text>
                </TouchableOpacity>
              </View>
              {currentRoom?.photos && currentRoom.photos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoScroll}
                >
                  {currentRoom.photos.map((photo, photoIndex) => (
                    <View key={photoIndex} style={styles.photoThumbWrap}>
                      <Image source={{ uri: photo }} style={styles.photoThumbnail} />
                      {canComplete && (
                        <TouchableOpacity
                          testID="inspection-room-photo-markup"
                          style={styles.photoMarkupWrap}
                          onPress={() => setMarkupTarget({ url: photo, photoIndex })}
                          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Mark up photo"
                        >
                          <Ionicons name="brush" size={13} color="#FFF" />
                        </TouchableOpacity>
                      )}
                      {canComplete && (
                        <TouchableOpacity
                          testID="inspection-room-photo-remove"
                          style={styles.photoRemoveWrap}
                          onPress={() => removePhoto(photoIndex)}
                          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                          accessibilityRole="button"
                          accessibilityLabel="Remove photo"
                        >
                          <View style={styles.photoRemove}>
                            <Text style={styles.photoRemoveText}>×</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
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
                testID="inspection-room-notes"
                style={[styles.notesInput, styles.roomNotes]}
                placeholder={readOnly ? 'No notes' : 'Additional notes for this room...'}
                value={currentRoom?.notes}
                onChangeText={updateRoomNotes}
                editable={!readOnly}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Tenant Comments (append-only; visible to both parties) */}
            {currentRoom && (readOnly || roomComments.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tenant Comments</Text>
                {roomComments.map((comment) => (
                  <View
                    key={comment.id}
                    style={styles.itemCard}
                    testID={`inspection-tenant-comment-${comment.id}`}
                  >
                    <Text style={styles.itemName}>{comment.text}</Text>
                    <Text style={styles.pendingText}>
                      {new Date(comment.createdAt).toLocaleDateString('en-ZA')}
                    </Text>
                    {comment.maintenanceRequestId ? (
                      <TouchableOpacity
                        testID="inspection-comment-view-request"
                        onPress={() =>
                          router.push(
                            `/(${role})/maintenance/${comment.maintenanceRequestId}` as any
                          )
                        }
                      >
                        <Text style={[styles.navButtonText, { color: colors.primary }]}>
                          View maintenance request
                        </Text>
                      </TouchableOpacity>
                    ) : readOnly ? (
                      <TouchableOpacity
                        testID="inspection-comment-raise-issue"
                        onPress={() => raiseIssue(comment)}
                      >
                        <Text style={[styles.navButtonText, { color: colors.primary }]}>
                          Raise as maintenance issue
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
                {readOnly && inspection.status !== 'cancelled' && (
                  <>
                    <TextInput
                      testID="inspection-tenant-comment-input"
                      style={[styles.notesInput, styles.roomNotes]}
                      placeholder="Something missing or not right in this room? Describe it here..."
                      value={commentDraft}
                      onChangeText={setCommentDraft}
                      multiline
                      numberOfLines={3}
                    />
                    <TouchableOpacity
                      testID="inspection-tenant-comment-add"
                      style={[
                        styles.roomPhotoButton,
                        { borderColor: colors.primary, marginTop: 8, flex: 0 },
                        (!commentDraft.trim() || addingComment) && { opacity: 0.5 },
                      ]}
                      onPress={() => addComment(currentRoom.name)}
                      disabled={!commentDraft.trim() || addingComment}
                    >
                      {addingComment ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={[styles.roomPhotoButtonText, { color: colors.primary }]}>
                          Add Comment
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Key Handover (only on last room) */}
            {isLastRoom && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Key Handover</Text>
                <View style={styles.keyRow}>
                  <Text style={styles.keyLabel}>Physical Keys</Text>
                  <View style={styles.keyCounter}>
                    <TouchableOpacity
                      testID="inspection-keys-physical-minus"
                      style={styles.counterButton}
                      disabled={readOnly}
                      onPress={() =>
                        setKeys({ ...keys, physicalKeys: Math.max(0, keys.physicalKeys - 1) })
                      }
                    >
                      <Ionicons name="remove" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{keys.physicalKeys}</Text>
                    <TouchableOpacity
                      testID="inspection-keys-physical-plus"
                      style={styles.counterButton}
                      disabled={readOnly}
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
                      testID="inspection-keys-cards-minus"
                      style={styles.counterButton}
                      disabled={readOnly}
                      onPress={() =>
                        setKeys({ ...keys, accessCards: Math.max(0, keys.accessCards - 1) })
                      }
                    >
                      <Ionicons name="remove" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{keys.accessCards}</Text>
                    <TouchableOpacity
                      testID="inspection-keys-cards-plus"
                      style={styles.counterButton}
                      disabled={readOnly}
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
                      testID="inspection-keys-remotes-minus"
                      style={styles.counterButton}
                      disabled={readOnly}
                      onPress={() =>
                        setKeys({ ...keys, remoteControls: Math.max(0, keys.remoteControls - 1) })
                      }
                    >
                      <Ionicons name="remove" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{keys.remoteControls}</Text>
                    <TouchableOpacity
                      testID="inspection-keys-remotes-plus"
                      style={styles.counterButton}
                      disabled={readOnly}
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
                  testID="inspection-general-notes"
                  style={[styles.notesInput, styles.roomNotes]}
                  placeholder="Overall inspection notes..."
                  value={generalNotes}
                  onChangeText={setGeneralNotes}
                  editable={!readOnly}
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
              testID="inspection-previous"
              style={[styles.navButton, isFirstRoom && styles.navButtonDisabled]}
              onPress={() => setCurrentRoomIndex(safeRoomIndex - 1)}
              disabled={isFirstRoom}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={isFirstRoom ? '#CCC' : colors.primary}
              />
              <Text style={[styles.navButtonText, isFirstRoom && { color: '#CCC' }]}>Previous</Text>
            </TouchableOpacity>

            {isLastRoom ? (
              canSign ? (
                hasSigned ? (
                  <View
                    style={[
                      styles.navButton,
                      styles.navButtonPrimary,
                      { backgroundColor: '#4CAF50' },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                    <Text style={[styles.navButtonText, { color: '#FFF' }]}>Signed</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    testID="inspection-sign"
                    style={[
                      styles.navButton,
                      styles.navButtonPrimary,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handleSign}
                    disabled={saving}
                  >
                    <Ionicons name="create" size={24} color="#FFF" />
                    <Text style={[styles.navButtonText, { color: '#FFF' }]}>Sign</Text>
                  </TouchableOpacity>
                )
              ) : canComplete ? (
                <TouchableOpacity
                  testID="inspection-complete"
                  style={[
                    styles.navButton,
                    styles.navButtonPrimary,
                    { backgroundColor: colors.primary },
                  ]}
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
              ) : inspection?.status === 'completed' ? (
                <TouchableOpacity
                  testID="inspection-export"
                  style={[
                    styles.navButton,
                    styles.navButtonPrimary,
                    { backgroundColor: colors.primary },
                  ]}
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
                  <Text style={[styles.navButtonText, { color: '#CCC' }]}>
                    {readOnly &&
                    (inspection?.status === 'scheduled' || inspection?.status === 'in_progress')
                      ? 'Awaiting owner'
                      : 'Completed'}
                  </Text>
                </View>
              )
            ) : (
              <TouchableOpacity
                testID="inspection-next"
                style={[styles.navButton, { borderColor: colors.primary }]}
                onPress={() => setCurrentRoomIndex(safeRoomIndex + 1)}
              >
                <Text style={[styles.navButtonText, { color: colors.primary }]}>Next</Text>
                <Ionicons name="chevron-forward" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <PhotoMarkupModal
            visible={markupTarget !== null}
            photoUrl={markupTarget?.url ?? null}
            onCancel={() => setMarkupTarget(null)}
            onSave={saveMarkup}
          />

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
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  uploadBannerText: { fontSize: 13, color: '#1E3A8A', fontWeight: '600' },
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
  headerExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerExportText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
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
    paddingHorizontal: 2,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  conditionButtonText: {
    fontSize: 12,
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
  },
  photoThumbWrap: { marginRight: 8, paddingTop: 6, paddingRight: 6 },
  photoRemoveWrap: { position: 'absolute', top: 0, right: 0, zIndex: 2 },
  photoMarkupWrap: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  photoRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  photoRemoveText: { color: '#FFF', fontSize: 14, fontWeight: '700', lineHeight: 16 },
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
