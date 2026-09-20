import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function UploadScreen({ onBack }) {
  const [image, setImage] = useState(null);

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to continue');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Scan Receipt</Text>

      {image ? (
        <Image source={{ uri: image }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No receipt selected</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={() => pickImage(true)}>
        <Text style={styles.buttonText}>Take Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonAlt} onPress={() => pickImage(false)}>
        <Text style={styles.buttonAltText}>Choose from Gallery</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  preview: { flex: 1, borderRadius: 8, marginBottom: 20, resizeMode: 'contain' },
  placeholder: { flex: 1, borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  placeholderText: { color: '#bbb', fontSize: 16 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonAlt: { borderWidth: 1, borderColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 30 },
  buttonAltText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
});