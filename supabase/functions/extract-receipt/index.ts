const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 40000; // give the AI 40 seconds per try
const TRIES = 2;          // try once more if the first one is stuck or fails

const KINDS = ['alcohol', 'soft', 'food'];

const PROMPT = `You are reading a photo of a restaurant or bar bill.
Return ONLY JSON in this exact shape:
{"restaurant":"","bill_no":"","date":"","items":[{"name":"string","qty":1,"rate":0,"price":0,"kind":"food","about":""}],"tax":0,"service_charge":0,"discount":0,"total":0,"check":{"photo_of_paper":true,"signs":[],"verdict":"looks_real"}}

Rules:
- restaurant = the restaurant or bar name at the top. bill_no = the bill or invoice number. date = the bill date as printed. Use "" if missing.
- items = only things that were ordered. price = the line amount (qty x rate).
- Skip lines priced 0 — they are flavours, add-ons or notes belonging to the item above. Never join their text onto an item's name.
- Keep each item's name short and as printed on its own line. Do not merge two lines into one name.
- Never put taxes, GST, CGST, SGST, service charge, round off, discount or totals in items.
- kind = what the item is:
  "alcohol" for any drink that contains alcohol: beer, wine, spirits, whisky, rum, vodka, gin, tequila, cocktails, shots, pitchers, towers, buckets.
  "soft" for drinks without alcohol: water, soda, juice, soft drinks, mocktails, anything "virgin", tea, coffee, shakes, lassi.
  "food" for dishes, snacks, starters, mains, desserts and sides.
  Use the name, the size (like 330 ML or 1300 ML), the price and the kind of venue to decide. Pick the most likely kind.
- about = a plain, neutral description of what the item most likely is, at most 10 words. Use "" if you really cannot tell.
- tax = sum of all tax lines (GST, CGST, SGST, VAT).
- total = the final amount payable.
- Use 0 when a number is missing. Numbers only, no currency symbols.
- check = is this a genuine bill photo?
  photo_of_paper = true if it looks like a camera photo of a real printed bill (paper texture, lighting, slight angle or curl), false if it looks like a screenshot, a digital render or a generated image.
  signs = short plain reasons (max 4) for anything that looks edited, AI-generated or fake: mismatched or blurry fonts on some numbers, text that doesn't line up, smudged or pasted-over amounts, garbled or nonsense words, impossible prices, totals that don't add up, a missing restaurant name or GST number, too perfect / synthetic look. Empty if nothing looks wrong.
  verdict = "looks_real" (no real concerns), "suspicious" (some signs) or "likely_fake" (strong signs it is edited or AI-made). Be fair: normal crumples, blur or thermal-print fading are NOT signs of fakery.`;

// One call to Gemini, stopped after TIMEOUT_MS
async function askGemini(image: string, key: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: image } },
              { text: PROMPT },
            ],
          }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      },
    );
    const data = await res.json();
    if (data.error) throw new Error('Gemini: ' + data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } finally {
    clearTimeout(timer);
  }
}

// 🕵️ Our own maths check + the AI's look check → one simple verdict
function authenticity(bill: any, items: any[]) {
  const signs: string[] = [];
  const c = bill.check || {};
  for (const s of Array.isArray(c.signs) ? c.signs : []) if (s && signs.length < 4) signs.push(String(s).slice(0, 120));

  const sum = items.reduce((a, i) => a + i.price, 0);
  const total = Number(bill.total) || 0;
  if (total > 0 && sum > 0) {
    const expected = sum + (Number(bill.tax) || 0) + (Number(bill.service_charge) || 0) - (Number(bill.discount) || 0);
    const diff = Math.abs(expected - total);
    if (diff > Math.max(10, total * 0.05)) signs.push(`Items add up to ${Math.round(expected)}, but the total says ${Math.round(total)}`);
  }
  for (const i of items) {
    if (i.qty > 0 && i.rate > 0 && Math.abs(i.qty * i.rate - i.price) > Math.max(2, i.price * 0.02)) {
      signs.push(`"${i.name}": ${i.qty} × ${i.rate} isn't ${i.price}`);
      break;
    }
  }

  let verdict = ['looks_real', 'suspicious', 'likely_fake'].includes(c.verdict) ? c.verdict : 'looks_real';
  if (c.photo_of_paper === false && verdict === 'looks_real') {
    verdict = 'suspicious';
    signs.unshift('Looks like a screenshot or a digital image, not a photo of a paper bill');
  }
  if (verdict === 'looks_real' && signs.length) verdict = 'suspicious';
  return { verdict, signs: signs.slice(0, 4), photo_of_paper: c.photo_of_paper !== false };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { image } = await req.json();
    if (!image) throw new Error('No image received');
    const key = Deno.env.get('GEMINI_API_KEY') ?? '';

    let bill: any = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= TRIES && !bill; attempt++) {
      try {
        bill = await askGemini(image, key);
      } catch (e) {
        lastError = e;
        console.log(`extract-receipt: attempt ${attempt} failed: ${e instanceof Error ? e.name + ' ' + e.message : e}`);
      }
    }
    if (!bill) {
      const timedOut = lastError instanceof Error && lastError.name === 'AbortError';
      throw new Error(
        timedOut
          ? 'Reading the bill is taking too long right now. Please try again in a minute.'
          : "Couldn't read the bill. Please try again with a clear, straight-on photo.",
      );
    }

    const items = (bill.items ?? [])
      .map((i: any) => {
        const kind = String(i.kind ?? '').toLowerCase().trim();
        const about = String(i.about ?? '').trim().slice(0, 100);
        return {
          name: String(i.name ?? '').trim(),
          qty: Number(i.qty) || 1,
          rate: Number(i.rate) || 0,
          price: Number(i.price) || 0,
          ...(KINDS.includes(kind) ? { kind } : {}),
          ...(about ? { about } : {}),
        };
      })
      .filter((i: any) => i.name && i.price > 0);

    return json({
      restaurant: String(bill.restaurant ?? '').trim(),
      bill_no: String(bill.bill_no ?? '').trim(),
      date: String(bill.date ?? '').trim(),
      items,
      tax: Number(bill.tax) || 0,
      service_charge: Number(bill.service_charge) || 0,
      discount: Number(bill.discount) || 0,
      total: Number(bill.total) || 0,
      check: authenticity(bill, items),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) });
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
