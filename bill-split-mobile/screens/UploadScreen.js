import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { findDuplicate } from '../services/bills';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

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

export default function UploadScreen({ onBack, onNext }) {
  const [image, setImage] = useState(null);
  const [base64, setBase64] = useState(null);
  const [items, setItems] = useState([]);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

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
      };
      setItems(data.items);
      setBill(info);

      if (data.items.length === 0) {
        Alert.alert('No items found', 'Try a clearer, straight-on photo');
        return;
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
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Scan Receipt</Text>
      {bill && bill.restaurant ? <Text style={styles.restaurant}>{bill.restaurant}</Text> : null}

      {items.length > 0 ? (
        <ScrollView style={styles.list}>
          {items.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.itemName}>
                {item.qty > 1 ? `${item.qty} × ` : ''}{item.name}
              </Text>
              <Text style={styles.itemPrice}>Rs {item.price}</Text>
            </View>
          ))}
          {bill && bill.total > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Bill total</Text>
              <Text style={styles.totalValue}>Rs {bill.total}</Text>
            </View>
          )}
        </ScrollView>
      ) : image ? (
        <Image source={{ uri: image }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No receipt selected</Text>
        </View>
      )}

      {image && items.length === 0 && (
        <TouchableOpacity style={styles.button} onPress={readReceipt} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Read Receipt</Text>}
        </TouchableOpacity>
      )}
      {loading && <Text style={styles.wait}>Reading your bill… usually 5–15 seconds</Text>}

      {items.length > 0 && (
        <TouchableOpacity style={styles.button} onPress={() => onNext(items, bill)}>
          <Text style={styles.buttonText}>Next: Check the bill</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.buttonAlt} onPress={() => pickImage(true)}>
        <Text style={styles.buttonAltText}>Take Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonAlt} onPress={() => pickImage(false)}>
        <Text style={styles.buttonAltText}>Choose from Gallery</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4, color: C.text },
  restaurant: { fontSize: 15, color: C.sub, marginBottom: 12 },
  preview: { flex: 1, borderRadius: 16, marginBottom: 15, marginTop: 12, resizeMode: 'contain' },
  placeholder: { flex: 1, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 15, marginTop: 12 },
  placeholderText: { color: C.faint, fontSize: 16 },
  list: { flex: 1, marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  itemName: { fontSize: 16, flex: 1, marginRight: 10, color: C.text },
  itemPrice: { fontSize: 16, fontWeight: '700', color: C.sub },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: C.text },
  totalValue: { fontSize: 16, fontWeight: '800', color: C.accentSoft },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  wait: { color: C.faint, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  buttonAlt: { borderWidth: 1, borderColor: C.accent, padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  buttonAltText: { color: C.accentSoft, fontSize: 16, fontWeight: '700' },
});