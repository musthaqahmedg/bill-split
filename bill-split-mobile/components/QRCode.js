import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';

// ▦ QR code drawn with plain Views (no native module needed, so it works on every build).
// Dark squares in a row are merged into one bar to keep it light.
export default function QRCode({ value, size = 220, color = '#0E0E12', bg = '#FFFFFF' }) {
  const rows = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(String(value || ''));
    q.make();
    const n = q.getModuleCount();
    const out = [];
    for (let r = 0; r < n; r++) {
      const runs = [];
      let start = -1;
      for (let c = 0; c <= n; c++) {
        const dark = c < n && q.isDark(r, c);
        if (dark && start < 0) start = c;
        if (!dark && start >= 0) {
          runs.push([start, c - start]);
          start = -1;
        }
      }
      out.push(runs);
    }
    return { n, out };
  }, [value]);

  const quiet = 2; // white border, in modules
  const cell = size / (rows.n + quiet * 2);
  return (
    <View style={{ width: size, height: size, backgroundColor: bg }}>
      {rows.out.map((runs, r) =>
        runs.map(([c, len]) => (
          <View
            key={`${r}-${c}`}
            style={{ position: 'absolute', left: (c + quiet) * cell, top: (r + quiet) * cell, width: len * cell + 0.5, height: cell + 0.5, backgroundColor: color }}
          />
        ))
      )}
    </View>
  );
}
