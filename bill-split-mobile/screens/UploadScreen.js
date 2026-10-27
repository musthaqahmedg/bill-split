import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { findDuplicate } from '../services/bills';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';
import BillSteps from './BillSteps';

// Shrink the photo before sending: smaller = faster upload and faster reading
const MAX_WIDTH = 1400;
async function shrink(asset) {
  const width = Math.min(asset.width || MAX_WIDTH, MAX_WIDTH);
  const IM = ImageManipulator.ImageManipulator;
  if (IM && IM.manipulate) {
    const ctx = IM.manipulate(asset.uri);
    ctx.resize({ width });
    const img = await ctx.renderAsync();
    return img.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.6, base64: true });
  }
  // Older versions of the tool
  return ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.6, base64: true }
  );
}

// 📐 Scanner frame: four lime corners; while the AI reads, a lime line sweeps up and down
function Frame({ children, scanning }) {
  const y = useRef(new Animated.Value(0)).current;
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!scanning) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [scanning]);
  return (
    <View style={styles.frame} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {children}
      {[styles.cTL, styles.cTR, styles.cBL, styles.cBR].map((c, i) => <View key={i} style={[styles.corner, c]} pointerEvents="none" />)}
      {scanning ? (
        <>
          <View style={styles.dim} pointerEvents="none" />
          <Animated.View pointerEvents="none" style={[styles.scanLine, { transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [12, Math.max(12, h - 16)] }) }] }]} />
          <View style={styles.readingPill} pointerEvents="none">
            <Text style={styles.readingText}>✨ AI IS READING YOUR BILL…</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function UploadScreen({ title = 'Scan the bill', onBack, onNext }) {
  const [image, setImage] = useState(null);
  const [base64, setBase64] = useState(null);
  const [items, setItems] = useState([]);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState(null); // 🕵️ does the bill look genuine?

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : { granted: true } /* gallery = system photo picker, needs no permission (Google Play photo rule) */;

    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to continue');
      return;
    }

    const options = { quality: 0.8 };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      try {
        const small = await shrink(result.assets[0]);
        setImage(small.uri);
        setBase64(small.base64);
        setItems([]);
        setCheck(null);
        setBill(null);
      } catch (e) {
        Alert.alert("Couldn't prepare the photo", e.message);
      }
    }
  };

  const readReceipt = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-receipt', {
        body: { image: base64 },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const info = {
        restaurant: data.restaurant || '',
        bill_no: data.bill_no || '',
        date: data.date || '',
        tax: data.tax || 0,
        service_charge: data.service_charge || 0,
        discount: data.discount || 0,
        total: data.total || 0,
        check: data.check || null,
      };
      setItems(data.items);
      setBill(info);
      setCheck(data.check || null);

      if (data.items.length === 0) {
        Alert.alert('No items found', 'Try a clearer, straight-on photo');
        return;
      }

      // 🕵️ Edited, AI-made or a screenshot? Warn before anyone pays for it.
      const c = data.check;
      if (c && c.verdict !== 'looks_real') {
        Alert.alert(
          c.verdict === 'likely_fake' ? '🚩 This bill looks fake' : '⚠️ Check this bill',
          (c.signs && c.signs.length ? c.signs.map((x) => '• ' + x).join('\n') : 'Some parts of this bill look unusual.') +
            '\n\nYou can still continue. Friends will see this note.',
        );
      }

      const dup = await findDuplicate(info);
      if (dup) {
        const when = new Date(dup.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        Alert.alert('Seen this bill before 👀', `Looks like you already saved this bill on ${when}. You can still continue if it's a different one.`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      <BillSteps at={0} />
      <View style={styles.kickerPill}>
        <Text style={styles.kickerText}>⚡ AI BILL SPLITTER · READS ANY BILL</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {bill && bill.restaurant ? <Text style={styles.restaurant}>{bill.restaurant}</Text> : null}
      {check ? (
        <Text style={[styles.check, check.verdict === 'looks_real' ? styles.checkOk : check.verdict === 'likely_fake' ? styles.checkBad : styles.checkWarn]}>
          {check.verdict === 'looks_real' ? '✅ Looks like a genuine bill' : check.verdict === 'likely_fake' ? '🚩 Looks edited or AI-made' : '⚠️ Some parts look unusual'}
        </Text>
      ) : null}

      {items.length > 0 ? (
        <ScrollView style={styles.list}>
          {items.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.itemName}>
                {item.qty > 1 ? `${item.qty} × ` : ''}{item.name}
              </Text>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
          ))}
          {bill && bill.total > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Bill total</Text>
              <Text style={styles.totalValue}>₹{bill.total}</Text>
            </View>
          )}
        </ScrollView>
      ) : image ? (
        <Frame scanning={loading}>
          <Image source={{ uri: image }} style={styles.preview} />
        </Frame>
      ) : (
        <Frame>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🧾</Text>
            <Text style={styles.placeholderTitle}>Point at the bill</Text>
            <Text style={styles.placeholderText}>Flat, bright and straight-on. We read every item, tax and total.</Text>
          </View>
        </Frame>
      )}

      {image && items.length === 0 && (
        <TouchableOpacity style={styles.button} onPress={readReceipt} disabled={loading}>
          {loading
            ? <ActivityIndicator color={C.onLime} />
            : <Text style={styles.buttonText}>✨ READ THE BILL</Text>}
        </TouchableOpacity>
      )}
      {loading && <Text style={styles.wait}>Reading your bill… usually 5–15 seconds</Text>}

      {items.length > 0 && (
        <TouchableOpacity style={styles.button} onPress={() => onNext(items, bill)}>
          <Text style={styles.buttonText}>NEXT: CHECK THE BILL →</Text>
        </TouchableOpacity>
      )}

      <View style={styles.pickRow}>
        <TouchableOpacity style={[styles.buttonAlt, styles.pickBtn]} onPress={() => pickImage(true)}>
          <Text style={styles.buttonAltText}>📸 Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.buttonAlt, styles.pickBtn, styles.pickGap]} onPress={() => pickImage(false)}>
          <Text style={styles.buttonAltText}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  check: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  checkOk: { color: C.green },
  checkWarn: { color: C.amber },
  checkBad: { color: C.red },
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: C.lime, fontSize: 16, marginBottom: 10 },
  kickerPill: { alignSelf: 'flex-start', backgroundColor: C.lime, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginTop: 4, marginBottom: 8 },
  kickerText: { color: C.onLime, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  title: { fontFamily: F.display, fontSize: 28, marginBottom: 4, color: C.text },
  frame: { flex: 1, marginTop: 12, marginBottom: 15, borderRadius: 20, overflow: 'hidden', backgroundColor: C.card },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: C.lime },
  cTL: { top: 10, left: 10, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cTR: { top: 10, right: 10, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cBL: { bottom: 10, left: 10, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cBR: { bottom: 10, right: 10, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,14,18,0.35)' },
  scanLine: { position: 'absolute', left: 16, right: 16, top: 0, height: 4, borderRadius: 2, backgroundColor: C.lime, shadowColor: C.lime, shadowOpacity: 0.9, shadowRadius: 12, elevation: 8 },
  readingPill: { position: 'absolute', alignSelf: 'center', bottom: 24, backgroundColor: C.onLime, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12 },
  readingText: { color: C.lime, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  restaurant: { fontSize: 15, color: C.sub, marginBottom: 12 },
  preview: { flex: 1, resizeMode: 'contain' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  placeholderEmoji: { fontSize: 56 },
  placeholderTitle: { fontFamily: F.display, color: C.text, fontSize: 18, marginTop: 10 },
  placeholderText: { color: C.sub, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  pickRow: { flexDirection: 'row' },
  pickBtn: { flex: 1 },
  pickGap: { marginLeft: 10 },
  list: { flex: 1, marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  itemName: { fontSize: 16, flex: 1, marginRight: 10, color: C.text },
  itemPrice: { fontSize: 16, fontWeight: '700', color: C.sub },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: C.text },
  totalValue: { fontFamily: F.bold, fontSize: 17, color: C.lime },
  button: { backgroundColor: C.lime, padding: 16, borderRadius: 18, alignItems: 'center', marginBottom: 10 },
  buttonText: { color: C.onLime, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  wait: { color: C.faint, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  buttonAlt: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 18, alignItems: 'center', marginBottom: 10 },
  buttonAltText: { color: C.text, fontSize: 15, fontWeight: '700' },
});