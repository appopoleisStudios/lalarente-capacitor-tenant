import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';

interface SignatureCaptureProps {
  onSave?: (signature: string) => void;
  onEmpty?: () => void;
  onBegin?: () => void;
}

export interface SignatureCaptureRef {
  clearSignature: () => void;
  readSignature: () => void;
}

const SignatureCapture = forwardRef<SignatureCaptureRef, SignatureCaptureProps>(
  ({ onSave, onEmpty, onBegin }, ref) => {
    const signatureRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      clearSignature: () => {
        signatureRef.current?.clearSignature();
      },
      readSignature: () => {
        signatureRef.current?.readSignature();
      },
    }));

    const handleSignature = (signature: string) => {
      onSave?.(signature);
    };

    const handleEmpty = () => {
      onEmpty?.();
    };

    const handleBegin = () => {
      onBegin?.();
    };

    const webStyle = `
      .m-signature-pad {
        box-shadow: none;
        border: none;
      }
      .m-signature-pad--body {
        border: none;
      }
      .m-signature-pad--footer {
        display: none;
      }
      body,html {
        width: 100%;
        height: 100%;
      }
    `;

    return (
      <View style={styles.container}>
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleSignature}
          onEmpty={handleEmpty}
          onBegin={handleBegin}
          descriptionText=""
          clearText="Clear"
          confirmText="Save"
          webStyle={webStyle}
          autoClear={false}
          imageType="image/png"
        />
      </View>
    );
  }
);

SignatureCapture.displayName = 'SignatureCapture';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
});

export default SignatureCapture;
