'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

interface PaymentState {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PaymentGateway({
  total,
  settlements,
  peopleNames,
  onPaymentSuccess,
}: {
  total: number;
  settlements: Settlement[];
  peopleNames: string[];
  onPaymentSuccess: () => void;
}) {
  const [paymentState, setPaymentState] = useState<PaymentState>({
    status: 'idle',
    message: '',
  });

  const handlePayment = async () => {
    try {
      setPaymentState({ status: 'loading', message: 'Processing payment...' });

      const orderResponse = await fetch('/api/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(total * 100),
          receipt: `bill-split-${Date.now()}`,
          description: `Bill split for ${peopleNames.length} people`,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create payment order');
      }

      const orderData = await orderResponse.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Bill Split',
        description: `Split bill for ${peopleNames.length} people`,
        order_id: orderData.id,
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                settlements: settlements,
              }),
            });

            if (!verifyResponse.ok) {
              throw new Error('Payment verification failed');
            }

            setPaymentState({
              status: 'success',
              message: 'Payment successful! Settlement complete.',
            });

            setTimeout(onPaymentSuccess, 2000);
          } catch (error) {
            setPaymentState({
              status: 'error',
              message:
                error instanceof Error ? error.message : 'Payment verification failed',
            });
          }
        },
        prefill: {
          name: peopleNames[0],
          email: 'user@example.com',
          contact: '9999999999',
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: () => {
            setPaymentState({
              status: 'error',
              message: 'Payment cancelled',
            });
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      setPaymentState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Payment failed',
      });
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Payment</h2>
        <p className="text-gray-600">Complete the bill split with secure payment</p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Amount to pay</p>
          <p className="text-5xl font-bold text-blue-600 mb-2">₹{total.toFixed(2)}</p>
          <p className="text-sm text-gray-500">Using Razorpay secure gateway</p>
        </div>
      </div>

      {paymentState.status === 'loading' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <p className="text-blue-900 font-medium">{paymentState.message}</p>
        </div>
      )}

      {paymentState.status === 'success' && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-900 font-medium">{paymentState.message}</p>
            <p className="text-sm text-green-700 mt-1">All settlements recorded.</p>
          </div>
        </div>
      )}

      {paymentState.status === 'error' && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-900 font-medium">Error</p>
            <p className="text-sm text-red-700 mt-1">{paymentState.message}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="font-semibold mb-4">Settlements</h3>
        <div className="space-y-3">
          {settlements.map((settlement, index) => {
            const fromIdx = parseInt(settlement.from.split('-')[1]);
            const toIdx = parseInt(settlement.to.split('-')[1]);
            return (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {peopleNames[fromIdx]} → {peopleNames[toIdx]}
                </span>
                <span className="font-medium">₹{settlement.amount.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={paymentState.status === 'loading'}
        className={`w-full font-bold py-3 px-4 rounded-lg transition duration-200 text-lg ${
          paymentState.status === 'loading'
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {paymentState.status === 'loading' ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </div>
        ) : (
          'Pay with Razorpay'
        )}
      </button>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-1">ℹ️ Demo Mode</p>
        <p>In production, this will use your real Razorpay credentials.</p>
        <p className="mt-2">For testing, add your Razorpay keys to environment variables.</p>
      </div>
    </div>
  );
}