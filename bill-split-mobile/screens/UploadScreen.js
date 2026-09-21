import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabaseClient';

export default function UploadScreen({ onBack }) {
  const [image, setImage] = useState(null);
  const [base64, setBase64] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to continue');
      return;
    }

    const options = { quality: 0.5, base64: true };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setBase64(result.assets[0].base64);
      setItems([]);
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

      setItems(data.items);
      if (data.items.length === 0) {
        const debug = data.rows
          ? 'ROWS:\n' + data.rows.slice(0, 20).join('\n')
          : 'OLD CODE:\n' + (data.text || '').slice(0, 300);
        Alert.alert('No items found', debug);
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

      {items.length > 0 ? (
        <ScrollView style={styles.list}>
          {items.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>Rs {item.price}</Text>
            </View>
          ))}
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
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  preview: { flex: 1, borderRadius: 8, marginBottom: 15, resizeMode: 'contain' },
  placeholder: { flex: 1, borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  placeholderText: { color: '#bbb', fontSize: 16 },
  list: { flex: 1, marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemName: { fontSize: 16, flex: 1, marginRight: 10 },
  itemPrice: { fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonAlt: { borderWidth: 1, borderColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  buttonAltText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
});