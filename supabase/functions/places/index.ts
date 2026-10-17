// Place suggestions + Nearby screen.
// Uses free OpenStreetMap search (Photon), limited to an area around the user.
// Results are cached in the database so we call Photon less (it has fair-use limits).
// Body: { lat, lon, q?, category? }  ->  { places: [{ id, name, kind, area, lat, lon, km }] }
// Body: { details: ["N123", "W456"] }  ->  { details: { N123: { phone, hours, website } } }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const dbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function cacheGet(key: string, maxAgeH: number) {
  try {
    const res = await fetch(`${DB}/rest/v1/place_cache?key=eq.${encodeURIComponent(key)}&select=data,at`, { headers: dbHeaders });
    const [row] = await res.json();
    if (row && Date.now() - new Date(row.at).getTime() < maxAgeH * 3600e3) return row.data;
  } catch {}
  return null;
}
async function cacheSet(key: string, data: unknown) {
  try {
    await fetch(`${DB}/rest/v1/place_cache`, {
      method: "POST",
      headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key, data, at: new Date().toISOString() }),
    });
  } catch {}
}

const CATS: Record<string, string[]> = {
  all: ["amenity:restaurant", "amenity:fast_food", "amenity:food_court", "amenity:bar", "amenity:pub", "amenity:nightclub", "amenity:cafe", "tourism:hotel"],
  food: ["amenity:restaurant", "amenity:fast_food", "amenity:food_court"],
  bars: ["amenity:bar", "amenity:pub", "amenity:nightclub"],
  restobars: ["amenity:bar", "amenity:pub", "amenity:nightclub"],
  pubs: ["amenity:pub", "amenity:bar", "amenity:nightclub", "craft:brewery", "amenity:biergarten"],
  cafes: ["amenity:cafe"],
  hotels: ["tourism:hotel"],
  cinema: ["amenity:cinema"],
  stays: ["tourism:hotel", "tourism:guest_house", "tourism:resort", "tourism:hostel", "tourism:chalet", "tourism:apartment", "tourism:motel"],
  spots: ["tourism:attraction", "tourism:viewpoint", "tourism:museum", "natural:waterfall", "natural:beach", "natural:peak", "leisure:park", "leisure:nature_reserve", "historic:fort", "historic:castle", "waterway:dam", "amenity:place_of_worship"],
  supermarkets: ["shop:supermarket", "shop:convenience", "shop:department_store", "shop:general", "shop:grocery"],
  beverages: ["shop:alcohol", "shop:beverages", "shop:wine"],
  pan: ["shop:tobacco", "shop:kiosk", "shop:convenience", "shop:e-cigarette"],
};

// Words used to list places when nothing is typed yet (more words = more places)
const BROWSE: Record<string, string[]> = {
  all: ["restaurant", "hotel", "bar", "cafe", "bakery", "biryani", "family restaurant", "tea", "juice", "chicken", "veg", "pizza"],
  food: ["restaurant", "hotel", "biryani", "veg", "family restaurant", "chicken", "pizza", "burger", "bakery"],
  bars: ["bar", "pub", "lounge", "beer", "wine", "club"],
  restobars: ["bar", "restobar", "lounge", "beer", "hotel", "wine"],
  pubs: ["pub", "brewery", "bar", "lounge", "club", "beer"],
  cafes: ["cafe", "coffee", "tea", "juice", "bakery", "ice cream"],
  hotels: ["hotel", "residency", "inn", "resort", "lodge"],
  cinema: ["cinema", "theatre", "movies", "multiplex", "talkies"],
  stays: ["resort", "homestay", "hotel", "guest house", "villa", "cottage", "stay", "lodge"],
  spots: ["falls", "dam", "fort", "park", "view point", "temple", "beach", "hills", "museum", "lake", "garden"],
  supermarkets: ["supermarket", "hypermarket", "mart", "stores", "fresh", "bazaar"],
  beverages: ["bevco", "beverages", "liquor", "wine", "consumerfed", "outlet"],
  pan: ["pan", "paan", "tobacco", "bunk", "kiosk", "petty shop", "stores"],
};

// How far to look (degrees, ~110 km each): trips look further than dinner
const BOX: Record<string, number> = { spots: 0.6, stays: 0.6, beverages: 0.3, restobars: 0.25, pubs: 0.25 };

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "VibeOut/1.0 (maginfosystems@gmail.com)" } });
    if (!res.ok) {
      console.log("fetch failed", res.status, url.slice(0, 90));
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log("fetch error", String(e), url.slice(0, 90));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function photon(q: string, lat: number, lon: number, tags: string[], box: number) {
  const bbox = [lon - box, lat - box, lon + box, lat + box].join(",");
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}&limit=25&lang=en&bbox=${bbox}` +
    tags.map((t) => `&osm_tag=${encodeURIComponent(t)}`).join("");
  let data = await get(url);
  if (!data) {
    await sleep(700); // busy: wait a moment and try once more
    data = await get(url);
  }
  return (data && data.features) || [];
}

// A few searches at a time, so Photon doesn't turn us away
async function browse(words: string[], lat: number, lon: number, tags: string[], box: number) {
  const out: any[] = [];
  for (let i = 0; i < words.length; i += 3) {
    const lists = await Promise.all(words.slice(i, i + 3).map((w) => photon(w, lat, lon, tags, box)));
    out.push(...lists.flat());
  }
  return out;
}

// Phone + opening hours from OpenStreetMap itself (only some places have them)
const TYPE: Record<string, string> = { N: "node", W: "way", R: "relation" };
async function details(ids: string[]) {
  const out: Record<string, unknown> = {};
  const groups: Record<string, string[]> = { N: [], W: [], R: [] };
  for (const id of ids.slice(0, 40)) {
    const t = id[0], n = id.slice(1);
    if (groups[t] && /^\d+$/.test(n)) groups[t].push(n);
  }
  await Promise.all(Object.entries(groups).filter(([, v]) => v.length).map(async ([t, list]) => {
    const data = await get(`https://api.openstreetmap.org/api/0.6/${TYPE[t]}s.json?${TYPE[t]}s=${list.join(",")}`);
    for (const el of (data && data.elements) || []) {
      const tg = el.tags || {};
      out[t + el.id] = {
        phone: tg.phone || tg["contact:phone"] || tg.mobile || tg["contact:mobile"] || null,
        hours: tg.opening_hours || null,
        website: tg.website || tg["contact:website"] || null,
      };
    }
  }));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const body = await req.json();

    if (Array.isArray(body.details)) {
      const ids = [...new Set(body.details.map(String))].sort() as string[];
      const key = "d|" + ids.join(",");
      const hit = await cacheGet(key, 24 * 7);
      if (hit) return json({ details: hit });
      const d = await details(ids);
      if (Object.keys(d).length) await cacheSet(key, d);
      return json({ details: d });
    }

    const { lat, lon, q = "", category = "all" } = body;
    if (typeof lat !== "number" || typeof lon !== "number") throw new Error("lat and lon are required");
    const tags = CATS[category] || CATS.all;
    const me = { lat, lon };
    const text = String(q).trim().slice(0, 80);
    const near = BOX[category] || 0.15;

    // Same area (~1 km) + same search = reuse the saved list
    const key = `p2|${category}|${text.toLowerCase()}|${lat.toFixed(2)}|${lon.toFixed(2)}`;
    let raw: any[] | null = await cacheGet(key, text ? 24 : 72);

    if (!raw) {
      // Typing: search around you, then wider if nothing found. Not typing: browse nearby.
      let features: any[] = [];
      if (text.length >= 2) {
        features = await photon(text, lat, lon, tags, Math.max(0.3, near));
        if (!features.length) features = await photon(text, lat, lon, tags, 1.5);
      } else {
        features = await browse(BROWSE[category] || BROWSE.all, lat, lon, tags, near);
      }
      const seen = new Set<string>();
      raw = features
        .map((f: any) => {
          const p = f.properties || {};
          const [plon, plat] = f.geometry?.coordinates || [];
          if (!p.name || plat == null) return null;
          const id = `${p.osm_type}${p.osm_id}`;
          if (seen.has(id)) return null;
          seen.add(id);
          return {
            id,
            name: p.name,
            kind: p.osm_value,
            area: [p.street, p.district || p.locality, p.city || p.county].filter(Boolean).join(", "),
            lat: plat,
            lon: plon,
          };
        })
        .filter(Boolean) as any[];
      if (raw.length) await cacheSet(key, raw);
    }

    let places = raw.map((p) => ({ ...p, km: km(me, { lat: p.lat, lon: p.lon }) }));
    // Pan shops: kiosks / tobacco shops (not milk booths), or small shops named like a pan shop
    if (category === "pan") places = places.filter((p) => !/milma/i.test(p.name) && (p.kind !== "convenience" || /pan|paan|bunk|petty|tobacco/i.test(p.name)));

    places = places.sort((a, b) => a.km - b.km).slice(0, 80);
    return json({ places });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400);
  }
});
