import { NextRequest, NextResponse } from 'next/server';

interface ReceiptItem {
  name: string;
  price: number;
  rawText: string;
}

// Mock items for demo/testing
const MOCK_ITEMS: ReceiptItem[] = [
  { name: 'Biryani', price: 350, rawText: 'Biryani 350' },
  { name: 'Naan', price: 50, rawText: 'Naan 50' },
  { name: 'Raita', price: 80, rawText: 'Raita 80' },
  { name: 'Gulab Jamun', price: 120, rawText: 'Gulab Jamun 120' },
  { name: 'Mango Lassi', price: 60, rawText: 'Mango Lassi 60' },
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, items: [], rawText: '', error: 'No file provided' },
        { status: 400 }
      );
    }

    // Mock response - returns demo items
    const mockRawText = MOCK_ITEMS.map((item) => `${item.name} ₹${item.price}`).join(
      '\n'
    );

    return NextResponse.json({
      success: true,
      items: MOCK_ITEMS,
      rawText: mockRawText,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        items: [],
        rawText: '',
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}