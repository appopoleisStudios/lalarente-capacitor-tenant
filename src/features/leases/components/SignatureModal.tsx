import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignatureCapture, { SignatureCaptureRef } from './SignatureCapture';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signature: string) => Promise<void>;
  title?: string;
  description?: string;
  primaryColor?: string;
}

export default function SignatureModal({
  visible,
  onClose,
  onSave,
  title = 'Sign Agreement',
  description = 'By signing below, you agree to the terms and conditions of this agreement.',
  primaryColor = '#007A4D',
}: SignatureModalProps) {
  const signatureRef = useRef<SignatureCaptureRef>(null);
  const [saving, setSaving] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
  };

  const handleSave = async (signature: string) => {
    if (!signature || signature.length === 0) {
      Alert.alert('Empty Signature', 'Please draw your signature before saving.');
      return;
    }

    setSaving(true);
    try {
      await onSave(signature);
      onClose();
    } catch (error: any) {
      console.error('Error saving signature:', error);
      
      // Provide user-friendly error messages based on error type
      let errorTitle = 'Upload Failed';
      let errorMessage = 'Failed to save signature. Please try again.';

      if (error?.name === 'ValidationError') {
        errorTitle = 'Invalid Signature';
        errorMessage = error.message || 'Please draw your signature and try again.';
      } else if (error?.name === 'NetworkError') {
        errorTitle = 'Connection Error';
        errorMessage = 'Please check your internet connection and try again.';
      } else if (error?.name === 'StorageUploadError') {
        errorTitle = 'Upload Error';
        if (error.code === 'BUCKET_NOT_FOUND') {
          errorMessage = 'Storage is not properly configured. Please contact support.';
        } else if (error.code === 'PERMISSION_DENIED') {
          errorMessage = 'You do not have permission to upload signatures. Please contact support.';
        } else if (error.code === 'FILE_TOO_LARGE') {
          errorMessage = 'Signature file is too large. Please try again.';
        } else {
          errorMessage = error.message || errorMessage;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert(errorTitle, errorMessage, [
        { text: 'OK', style: 'default' }
      ]);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => {
    if (!hasSignature) {
      Alert.alert('Empty Signature', 'Please draw your signature before saving.');
      return;
    }
    signatureRef.current?.readSignature();
  };

  const handleSignatureChange = () => {
    setHasSignature(true);
  };

  const handleEmpty = () => {
    setHasSignature(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Ionicons name="information-circle" size={20} color="#666" />
            <Text style={styles.description}>{description}</Text>
          </View>

          {/* Signature Canvas */}
          <View style={styles.canvasContainer}>
            <View style={styles.canvasBorder}>
              <SignatureCapture
                ref={signatureRef}
                onSave={handleSave}
                onEmpty={handleEmpty}
                onBegin={handleSignatureChange}
              />
            </View>
            <Text style={styles.signHereText}>Sign here</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}
              disabled={saving}
            >
              <Ionicons name="refresh" size={20} color="#666" />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: primaryColor }]}
              onPress={handleConfirm}
              disabled={saving || !hasSignature}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>Confirm Signature</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    margin: 16,
    borderRadius: 8,
  },
  description: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  canvasContainer: {
    flex: 1,
    padding: 16,
  },
  canvasBorder: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  signHereText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
