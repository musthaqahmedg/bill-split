'use client';

import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';

interface PersonSelection {
  [personId: string]: Set<string>;
}

interface Item {
  id: string;
  name: string;
  price: number;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export default function SettlementSummary({
  items,
  selections,
  peopleNames,
  onReadyToPay,
}: {
  items: Item[];
  selections: PersonSelection;
  peopleNames: string[];
  onReadyToPay: (settlements: Settlement[], total: number) => void;
}) {
  const settlements = useMemo(() => {
    const personTotals: { [key: string]: number } = {};
    
    peopleNames.forEach((_, index) => {
      personTotals[`person-${index}`] = 0;
    });

    Object.entries(selections).forEach(([personId, itemIds]) => {
      const total = items
        .filter((item) => itemIds.has(item.id))
        .reduce((sum, item) => sum + item.price, 0);
      personTotals[personId] = total;
    });

    const totalBill = items.reduce((sum, item) => sum + item.price, 0);
    const peopleCount = peopleNames.length;
    const perPersonShare = totalBill / peopleCount;

    const settlements: Settlement[] = [];
    const personIds = Object.keys(personTotals);

    const balances = { ...personTotals };
    Object.keys(balances).forEach((personId) => {
      balances[personId] -= perPersonShare;
    });

    const debtors = Object.entries(balances)
      .filter(([_, balance]) => balance < 0)
      .sort((a, b) => a[1] - b[1]);

    const creditors = Object.entries(balances)
      .filter(([_, balance]) => balance > 0)
      .sort((a, b) => b[1] - a[1]);

    let debtorIdx = 0;
    let creditorIdx = 0;

    while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
      const [debtorId, debtorBalance] = debtors[debtorIdx];
      const [creditorId, creditorBalance] = creditors[creditorIdx];

      const settlement = Math.min(-debtorBalance, creditorBalance);

      settlements.push({
        from: debtorId,
        to: creditorId,
        amount: settlement,
      });

      debtors[debtorIdx][1] += settlement;
      creditors[creditorIdx][1] -= settlement;

      if (Math.abs(debtors[debtorIdx][1]) < 0.01) debtorIdx++;
      if (Math.abs(creditors[creditorIdx][1]) < 0.01) creditorIdx++;
    }

    return settlements;
  }, [items, selections, peopleNames]);

  const totalBill = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Settlement Summary</h2>
        <p className="text-gray-600">Here's who needs to pay whom</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Total Bill</p>
          <p className="text-4xl font-bold text-blue-600">₹{totalBill.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-2">
            {peopleNames.length} people → ₹{(totalBill / peopleNames.length).toFixed(2)} each
          </p>
        </div>
      </div>

      {settlements.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Transactions needed:</h3>
          {settlements.map((settlement, index) => {
            const fromPersonIdx = parseInt(settlement.from.split('-')[1]);
            const toPersonIdx = parseInt(settlement.to.split('-')[1]);
            const fromName = peopleNames[fromPersonIdx];
            const toName = peopleNames[toPersonIdx];

            return (
              <div
                key={index}
                className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{fromName}</p>
                  <p className="text-sm text-gray-500">pays</p>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                  <p className="font-bold text-blue-600">₹{settlement.amount.toFixed(2)}</p>
                </div>

                <div className="flex-1 text-right">
                  <p className="font-medium text-gray-900">{toName}</p>
                  <p className="text-sm text-gray-500">receives</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-700 font-medium">Everyone paid equally! 🎉</p>
        </div>
      )}

      <button
        onClick={() => onReadyToPay(settlements, totalBill)}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 text-lg"
      >
        Proceed to Payment
      </button>
    </div>
  );
}