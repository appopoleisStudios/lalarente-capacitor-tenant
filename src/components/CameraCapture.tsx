// components/CameraCapture.tsx
'use client'

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useState } from 'react';
import { validateImageFile } from '@/utils/fileValidation';

interface CameraCaptureProps {
  onImageCapture: (imageUrl: string) => void;
  onError?: (error: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture, onError }) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const captureImage = async () => {
    try {
      setIsCapturing(true);
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,  
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        // Convert data URL to File object for validation
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Validate the captured image
        const validation = validateImageFile(file);
        if (!validation.isValid) {
          onError?.(validation.error || 'Invalid image captured');
          return;
        }
        
        onImageCapture(image.dataUrl);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      onError?.('Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <button
      onClick={captureImage}
      disabled={isCapturing}
      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {isCapturing ? 'Capturing...' : '📷 Take Photo'}
    </button>
  );
};
