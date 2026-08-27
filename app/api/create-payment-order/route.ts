import { NextRequest, NextResponse } from 'next/server';

interface CreateOrderRequest {
  amount: number;
  receipt: string;
  description: string;
}

async function createRazorpayOrder(data: CreateOrderRequest) {
  const mockOrderId = `order_${Date.now()}`;

  return {
    id: mockOrderId,
    entity: 'order',
    amount: data.amount,
    amount_paid: 0,
    amount_due: data.amount,
    currency: 'INR',
    receipt: data.receipt,
    status: 'created',
    attempts: 0,
    notes: {
      description: data.description,
    },
    created_at: Math.floor(Date.now() / 1000),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderRequest;

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const order = await createRazorpayOrder(body);

    return NextResponse.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order',
      },
      { status: 500 }
    );
  }
}