import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import NightRecap from './NightRecap';
import { addPhotos, deletePhoto, listPhotos } from '../services/photos';
import { C } from '../services/theme';

const W = Dimensions.get('window').width;

// 📸 Party photos: everyone adds pictures, swipe through them, and watch the 🎬 night recap
export default function PartyPhotos({ party }) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState('');
  const [viewer, setViewer] = useState(null); // index of the open photo
  const [recap, setRecap] = useState(false);

  const load = useCallback(() => listPhotos(party.id).then(setPhotos).catch(() => {}), [party.id]);
  useEffect(() => {
    load();
  }, [load]);

  const add = () =>
    Alert.alert('Add photos 📸', undefined, [
      { text: '📷 Take a photo', onPress: () => upload(true) },
      { text: '🖼️ Choose from gallery', onPress: () => upload(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const upload = async (camera) => {
    try {
      const n = await addPhotos(party.id, camera, (i, total) => setBusy(`Uploading ${i} of ${total}…`));
      if (n) load();
    } catch (e) {
      Alert.alert("Couldn't add photos", e.message);
    } finally {
      setBusy('');
    }
  };

  const remove = (p) =>
    Alert.alert('Delete this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhoto(p);
            setViewer(null);
            load();
          } catch (e) {
            Alert.alert("Couldn't delete", e.message);
          }
        },
      },
    ]);

  const size = (W - 32 - 28 - 8) / 3;

  return (
    <View style={styles.box}>
      <View style={styles.top}>
        <Text style={styles.title}>📸 Photos{photos.length ? ` · ${photos.length}` : ''}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={add} disabled={!!busy}>
          <Text style={styles.addText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={C.accentSoft} />
          <Text style={styles.busyText}>{busy}</Text>
        </View>
      ) : null}

      {photos.length === 0 ? (
        <TouchableOpacity style={styles.empty} onPress={add}>
          <Text style={styles.emptyEmoji}>📷</Text>
          <Text style={styles.emptyText}>Add the first photo of the night</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.grid}>
          {photos.slice(0, 6).map((p, i) => (
            <TouchableOpacity key={p.id} onPress={() => setViewer(i)}>
              <Image source={{ uri: p.url }} style={[styles.thumb, { width: size, height: size }]} />
              {i === 5 && photos.length > 6 ? (
                <View style={[styles.more, { width: size, height: size }]}>
                  <Text style={styles.moreText}>+{photos.length - 6}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.recapBtn} onPress={() => setRecap(true)}>
        <Text style={styles.recapText}>🎬 Watch the night recap</Text>
      </TouchableOpacity>

      {/* Full-screen photo viewer: swipe left / right */}
      <Modal visible={viewer !== null} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            initialScrollIndex={viewer || 0}
            getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: p }) => (
              <View style={{ width: W, flex: 1, justifyContent: 'center' }}>
                <Image source={{ uri: p.url }} style={{ width: W, height: '75%' }} resizeMode="contain" />
                <View style={styles.caption}>
                  <Text style={styles.captionText}>📸 {p.uploader_name}</Text>
                  <TouchableOpacity onPress={() => remove(p)}>
                    <Text style={styles.delete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <TouchableOpacity style={styles.close} onPress={() => setViewer(null)}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <NightRecap visible={recap} onClose={() => setRecap(false)} party={party} photos={photos} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  addText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  busy: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  busyText: { color: C.sub, fontSize: 13, marginLeft: 8 },
  empty: { alignItems: 'center', paddingVertical: 18, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)' },
  emptyEmoji: { fontSize: 30 },
  emptyText: { color: C.sub, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  thumb: { borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  more: { position: 'absolute', borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  recapBtn: { marginTop: 12, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: 'rgba(236,72,153,0.15)' },
  recapText: { color: C.pink, fontSize: 15, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: '#000' },
  caption: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 14 },
  captionText: { color: '#fff', fontSize: 14 },
  delete: { color: C.red, fontSize: 14 },
  close: { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 16 },
});
