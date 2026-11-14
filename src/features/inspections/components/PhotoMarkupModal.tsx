import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

interface PhotoMarkupModalProps {
  visible: boolean;
  photoUrl: string | null;
  onCancel: () => void;
  /** Receives a local JPEG of the photo with the drawing flattened onto it. */
  onSave: (localUri: string) => void;
}

// The photo is drawn into the canvas itself (as a data URI, so the canvas is
// never cross-origin tainted) and every undo redraws photo + remaining strokes.
// Export is at the photo's own resolution, not the screen's.
const buildHtml = (photoDataUri: string) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none}
#c{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}</style></head>
<body><canvas id="c"></canvas><script>
var img=new Image(),c=document.getElementById('c'),x=c.getContext('2d'),strokes=[],cur=null,lw=6;
function fit(){var s=Math.min(innerWidth/img.width,innerHeight/img.height);c.style.width=img.width*s+'px';c.style.height=img.height*s+'px';}
function draw(){x.drawImage(img,0,0);x.strokeStyle='#E11D48';x.lineCap='round';x.lineJoin='round';x.lineWidth=lw;
strokes.forEach(function(s){x.beginPath();x.moveTo(s[0][0],s[0][1]);s.forEach(function(p){x.lineTo(p[0],p[1]);});if(s.length===1)x.lineTo(s[0][0]+0.1,s[0][1]);x.stroke();});}
function pt(e){var r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return[(t.clientX-r.left)*c.width/r.width,(t.clientY-r.top)*c.height/r.height];}
function send(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}
c.addEventListener('touchstart',function(e){e.preventDefault();cur=[pt(e)];strokes.push(cur);draw();send({type:'count',n:strokes.length});},{passive:false});
c.addEventListener('touchmove',function(e){e.preventDefault();if(!cur)return;cur.push(pt(e));draw();},{passive:false});
c.addEventListener('touchend',function(){cur=null;});
window.undo=function(){strokes.pop();draw();send({type:'count',n:strokes.length});};
window.clearAll=function(){strokes=[];draw();send({type:'count',n:0});};
window.exportImage=function(){send({type:'image',data:c.toDataURL('image/jpeg',0.85)});};
img.onload=function(){c.width=img.width;c.height=img.height;lw=Math.max(4,Math.round(img.width/150));fit();draw();send({type:'ready'});};
addEventListener('resize',fit);
img.src='${photoDataUri}';
</script></body></html>`;

export default function PhotoMarkupModal({
  visible,
  photoUrl,
  onCancel,
  onSave,
}: PhotoMarkupModalProps) {
  // SafeAreaView reports no insets inside a Modal on iOS; pad explicitly.
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !photoUrl) return;
    let cancelled = false;
    setHtml(null);
    setError(null);
    setReady(false);
    setStrokeCount(0);
    setSaving(false);
    (async () => {
      try {
        let localUri = photoUrl;
        if (/^https?:/.test(photoUrl)) {
          const dl = await FileSystem.downloadAsync(
            photoUrl,
            `${FileSystem.cacheDirectory}markup-src-${Date.now()}.jpg`
          );
          localUri = dl.uri;
        }
        const b64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!cancelled) setHtml(buildHtml(`data:image/jpeg;base64,${b64}`));
      } catch {
        if (!cancelled) setError('The photo could not be loaded.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, photoUrl]);

  const onMessage = async (e: WebViewMessageEvent) => {
    const msg = JSON.parse(e.nativeEvent.data);
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'count') setStrokeCount(msg.n);
    else if (msg.type === 'image') {
      const path = `${FileSystem.cacheDirectory}markup-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(path, msg.data.split(',')[1], {
        encoding: FileSystem.EncodingType.Base64,
      });
      onSave(path);
    }
  };

  const run = (js: string) => webRef.current?.injectJavaScript(`${js};true;`);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity
            testID="photo-markup-cancel"
            onPress={onCancel}
            style={styles.headerBtn}
          >
            <Text style={styles.headerText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mark up photo</Text>
          <TouchableOpacity
            testID="photo-markup-save"
            onPress={() => {
              setSaving(true);
              run('exportImage()');
            }}
            disabled={!ready || strokeCount === 0 || saving}
            style={styles.headerBtn}
          >
            <Text
              style={[
                styles.headerText,
                styles.saveText,
                (!ready || strokeCount === 0 || saving) && styles.disabled,
              ]}
            >
              Save
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Draw on the photo to circle or point at the issue.</Text>
        <View style={styles.canvasWrap} testID="photo-markup-canvas">
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : html ? (
            <WebView
              ref={webRef}
              originWhitelist={['*']}
              source={{ html }}
              onMessage={onMessage}
              scrollEnabled={false}
              bounces={false}
              style={styles.web}
            />
          ) : null}
          {(!ready || saving) && !error && (
            <View style={styles.overlay}>
              <ActivityIndicator color="#FFF" />
              {saving && <Text style={styles.overlayText}>Saving…</Text>}
            </View>
          )}
        </View>
        <View style={styles.toolbar}>
          <TouchableOpacity
            testID="photo-markup-undo"
            onPress={() => run('undo()')}
            disabled={strokeCount === 0}
            style={styles.toolBtn}
          >
            <Text style={[styles.toolText, strokeCount === 0 && styles.disabled]}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="photo-markup-clear"
            onPress={() => run('clearAll()')}
            disabled={strokeCount === 0}
            style={styles.toolBtn}
          >
            <Text style={[styles.toolText, strokeCount === 0 && styles.disabled]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  headerBtn: { paddingHorizontal: 12, paddingVertical: 6, minWidth: 72 },
  headerText: { color: '#FFF', fontSize: 16 },
  saveText: { fontWeight: '700', textAlign: 'right' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  hint: { color: '#D1D5DB', fontSize: 13, textAlign: 'center', paddingBottom: 8 },
  canvasWrap: { flex: 1 },
  web: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayText: { color: '#FFF', marginTop: 8 },
  error: { color: '#FCA5A5', textAlign: 'center', marginTop: 40 },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 12 },
  toolBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1F2937',
  },
  toolText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
