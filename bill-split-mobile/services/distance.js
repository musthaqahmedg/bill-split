// 📍 Distance helpers (pure maths, tested)
// distance in km between two points (haversine)
export function km(a, b) {
  const R = 6371;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export const distText = (d) => (d < 1 ? `${Math.max(10, Math.round((d * 1000) / 10) * 10)} m away` : `${d.toFixed(1)} km away`);
