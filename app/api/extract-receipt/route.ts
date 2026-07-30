import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: "TEXT_DETECTION" }],
          }],
        }),
      }
    );

    const data = await response.json();
    const annotations = data.responses?.[0]?.textAnnotations || [];
    const fullText = annotations[0]?.description || "";
    const lines = fullText.split("\n").filter((l: string) => l.trim());

    return NextResponse.json({
      success: true,
      extractedText: fullText,
      items: parseItems(lines),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to extract receipt" }, { status: 500 });
  }
}

function parseItems(lines: string[]) {
  const items = [];
  for (const line of lines) {
    const priceMatch = line.match(/(\d+\.?\d*)\s*$/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      const itemName = line.replace(priceMatch[0], "").trim();
      if (itemName && price > 0) {
        items.push({ name: itemName, price, selected: false });
      }
    }
  }
  return items;
}
