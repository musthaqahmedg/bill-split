'use client';

import { useState } from 'react';
import ReceiptUpload from '@/components/ReceiptUpload';
import ItemSelection from '@/components/ItemSelection';
import SettlementSummary from '@/components/SettlementSummary';
import PaymentGateway from '@/components/PaymentGateway';
import { ChevronLeft, CheckCircle } from 'lucide-react';

interface ExtractedItem {
  id: string;
  name: string;
  price: number;
  rawText: string;
}

interface PersonSelection {
  [personId: string]: Set<string>;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

type PageState = 'upload' | 'select' | 'settlement' | 'payment' | 'complete';

export default function Home() {
  const [pageState, setPageState] = useState<PageState>('upload');
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [selections, setSelections] = useState<PersonSelection>({});
  const [peopleNames, setPeopleNames] = useState<string[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [totalBill, setTotalBill] = useState(0);

  const handleReceiptUploaded = (items: any[]) => {
    const formattedItems: ExtractedItem[] = items.map((item, index) => ({
      id: `item-${index}`,
      name: item.name,
      price: item.price,
      rawText: item.rawText,
    }));

    setExtractedItems(formattedItems);
    setPageState('select');
  };

  const handleCalculate = (personSelections: PersonSelection, names: string[]) => {
    setSelections(personSelections);
    setPeopleNames(names);
    setPageState('settlement');
  };

  const handleReadyToPay = (calculatedSettlements: Settlement[], total: number) => {
    setSettlements(calculatedSettlements);
    setTotalBill(total);
    setPageState('payment');
  };

  const handlePaymentSuccess = () => {
    setPageState('complete');
  };

  const handleStartOver = () => {
    setPageState('upload');
    setExtractedItems([]);
    setSelections({});
    setPeopleNames([]);
    setSettlements([]);
    setTotalBill(0);
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="w-full max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Bill Split</h1>
          <p className="text-gray-600">Upload receipt → Select items → Split bill → Pay securely</p>
        </header>

        <main className="bg-white rounded-lg shadow-sm p-8">
          {/* Upload State */}
          {pageState === 'upload' && (
            <ReceiptUpload onUploaded={handleReceiptUploaded} />
          )}

          {/* Select State */}
          {pageState === 'select' && (
            <div className="space-y-6">
              <button
                onClick={() => setPageState('upload')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to upload
              </button>

              <ItemSelection
                items={extractedItems}
                onCalculate={handleCalculate}
              />
            </div>
          )}

          {/* Settlement State */}
          {pageState === 'settlement' && (
            <div className="space-y-6">
              <button
                onClick={() => setPageState('select')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to items
              </button>

              <SettlementSummary
                items={extractedItems}
                selections={selections}
                peopleNames={peopleNames}
                onReadyToPay={handleReadyToPay}
              />
            </div>
          )}

          {/* Payment State */}
          {pageState === 'payment' && (
            <div className="space-y-6">
              <button
                onClick={() => setPageState('settlement')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to settlement
              </button>

              <PaymentGateway
                total={totalBill}
                settlements={settlements}
                peopleNames={peopleNames}
                onPaymentSuccess={handlePaymentSuccess}
              />
            </div>
          )}

          {/* Complete State */}
          {pageState === 'complete' && (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-100 rounded-full blur-lg"></div>
                  <CheckCircle className="w-24 h-24 text-green-600 relative" />
                </div>
              </div>

              <div>
                <h2 className="text-4xl font-bold text-green-900 mb-2">
                  Payment Successful! 🎉
                </h2>
                <p className="text-lg text-green-700 mb-4">
                  Bill split complete. All settlements recorded.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-left max-w-md mx-auto">
                <h3 className="font-semibold mb-3 text-green-900">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Bill:</span>
                    <span className="font-semibold">₹{totalBill.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">People:</span>
                    <span className="font-semibold">{peopleNames.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Per Person:</span>
                    <span className="font-semibold">
                      ₹{(totalBill / peopleNames.length).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartOver}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition"
              >
                Split Another Bill
              </button>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>Bill Split • Made with ❤️ for fair bill splitting</p>
          <p className="mt-1">Phase 1-3 Complete: Ready for Production ✨</p>
        </footer>
      </div>
    </div>
  );
}