import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MONTHS, daysIn, saveBirthday } from '../services/birthday';
import { C } from '../services/theme';

// 🎂 Pick day + month (no year)
export default function BirthdayPicker({ visible, onClose, onSaved, initial, required }) {
  const [month, setMonth] = useState(null);
  const [day, setDay] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setMonth(initial ? initial.month : null);
      setDay(initial ? initial.day : null);
    }
  }, [visible]);

  const save = async () => {
    setSaving(true);
    try {
      await saveBirthday(day, month);
      onSaved && onSaved({ day, month });
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={required ? () => {} : onClose}>
      <View style={styles.page}>
        <View style={styles.top}>
          <Text style={styles.title}>🎂 Your birthday</Text>
          {onClose ? (
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.link}>{required ? 'Not now' : 'Cancel'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.sub}>
          Your circle gets a reminder before your birthday… so you can’t escape the treat 😎{'\n'}Just day and month, no year.
        </Text>
        <ScrollView>
          <Text style={styles.label}>MONTH</Text>
          <View style={styles.grid}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.month, month === i + 1 && styles.on]}
                onPress={() => {
                  setMonth(i + 1);
                  if (day && day > daysIn(i + 1)) setDay(null);
                }}
              >
                <Text style={[styles.text, month === i + 1 && styles.textOn]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {month ? (
            <>
              <Text style={styles.label}>DAY</Text>
              <View style={styles.grid}>
                {Array.from({ length: daysIn(month) }, (_, i) => i + 1).map((d) => (
                  <TouchableOpacity key={d} style={[styles.day, day === d && styles.on]} onPress={() => setDay(d)}>
                    <Text style={[styles.text, day === d && styles.textOn]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
          <TouchableOpacity style={[styles.btn, !(day && month) && styles.dim]} onPress={save} disabled={!(day && month) || saving}>
            <Text style={styles.btnText}>{saving ? 'Saving…' : day && month ? `Save ${day} ${MONTHS[month - 1]} 🎉` : 'Pick a date'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, padding: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontSize: 24, fontWeight: '700' },
  link: { color: C.accentSoft, fontSize: 16, fontWeight: '600' },
  sub: { color: C.sub, fontSize: 14, marginTop: 8, lineHeight: 20 },
  label: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: { width: '22%', paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  day: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  on: { backgroundColor: C.pink },
  text: { color: C.sub, fontSize: 15, fontWeight: '600' },
  textOn: { color: '#fff' },
  btn: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 24, marginBottom: 30 },
  dim: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
