// 📸 Read a photo of a restaurant / bar menu card → items with prices.
// Body: { image: base64 jpeg } → { items: [{ name, price, kind, category }] }
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MODEL = 'gemini-3.5-flash-lite';
const KINDS = ['alcohol', 'soft', 'food'];

const PROMPT = `This is a photo of a restaurant, bar or café MENU card (not a bill).
Return ONLY JSON: {"items":[{"name":"","price":0,"kind":"food","category":""}]}
Rules:
- One entry per dish or drink with its price as printed (numbers only, no currency). If a drink has sizes (30ml/60ml, glass/bottle), use the smallest serving price and put the size in the name, e.g. "Old Monk (30 ml)".
- kind: "alcohol" for any alcoholic drink (beer, wine, spirits, cocktails), "soft" for non-alcoholic drinks (mocktails, juices, soda, tea, coffee, shakes), "food" for everything else.
- category = the section heading it is under (e.g. "Mocktails", "Starters", "Whisky"), or "".
- Skip headings, descriptions, taxes and notes. Keep names short as printed. Maximum 150 items.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const { image } = await req.json();
    if (!image) throw new Error('No image received');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY') ?? '' },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    }).finally(() => clearTimeout(timer));
    const data = await res.json();
    if (data.error) throw new Error('Gemini: ' + data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const out = JSON.parse(text.replace(/```json|```/g, '').trim());
    const items = (out.items ?? [])
      .map((i: any) => ({
        name: String(i.name ?? '').trim().slice(0, 80),
        price: Number(i.price) || null,
        kind: KINDS.includes(String(i.kind)) ? String(i.kind) : 'food',
        category: String(i.category ?? '').trim().slice(0, 40),
      }))
      .filter((i: any) => i.name)
      .slice(0, 150);
    if (!items.length) throw new Error("Couldn't find menu items. Try a clear, straight photo of one menu page.");
    return json({ items });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? 'Reading the menu took too long. Try again.' : e instanceof Error ? e.message : String(e);
    return json({ error: msg });
  }
});
