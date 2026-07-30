import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get the base64 image from the request
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Call Google Vision API
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const googleVisionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageBase64,
              },
              features: [
                {
                  type: "TEXT_DETECTION",
                },
              ],
            },
          ],
        }),
      }
    );

    const visionData = await googleVisionResponse.json();

    if (!visionData.responses || visionData.responses.length === 0) {
      return NextResponse.json(
        { error: "No text detected in image" },
        { status: 400 }
      );
    }

    // Extract text from the response
    const annotations = visionData.responses[0].textAnnotations || [];
    const fullText =
      annotations.length > 0 ? annotations[0].description : "";

    // Simple parsing logic (you can enhance this later)
    const lines = fullText.split("\n").filter((line: string) => line.trim());

    // Return extracted data
    return NextResponse.json({
      success: true,
      extractedText: fullText,
      items: parseItems(lines),
    });
  } catch (error) {
    console.error("Error extracting receipt:", error);
    return NextResponse.json(
      { error: "Failed to extract receipt" },
      { status: 500 }
    );
  }
}

// Simple item parser - extracts items and prices
function parseItems(lines: string[]) {
  const items = [];

  for (const line of lines) {
    // Look for patterns like "Item $10.00" or "Item 10"
    const priceMatch = line.match(/(\d+\.?\d*)\s*$/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      const itemName = line
        .replace(priceMatch[0], "")
        .trim();

      if (itemName && price > 0) {
        items.push({
          name: itemName,
          price: price,
          selected: false,
        });
      }
    }
  }

  return items;
}
