// components/CameraCapture.tsx
'use client'

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useState } from 'react';

interface CameraCaptureProps {
  onImageCapture: (imageUrl: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture }) => {
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
        onImageCapture(image.dataUrl);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
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
