'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  price: number;
  rawText: string;
}

interface PersonSelection {
  [personId: string]: Set<string>;
}

export default function ItemSelection({
  items,
  onCalculate,
}: {
  items: Item[];
  onCalculate: (selections: PersonSelection, names: string[]) => void;
}) {
  const [numPeople, setNumPeople] = useState(2);
  const [selections, setSelections] = useState<PersonSelection>({});
  const [peopleNames, setPeopleNames] = useState<string[]>(['Person 1', 'Person 2']);

  useEffect(() => {
    const newSelections: PersonSelection = {};
    for (let i = 0; i < numPeople; i++) {
      newSelections[`person-${i}`] = new Set();
    }
    setSelections(newSelections);

    const newNames = Array.from({ length: numPeople }, (_, i) => `Person ${i + 1}`);
    setPeopleNames(newNames);
  }, [numPeople]);

  const toggleItemForPerson = (personId: string, itemId: string) => {
    setSelections((prev) => {
      const newSelections = { ...prev };
      const personSet = new Set(newSelections[personId]);

      if (personSet.has(itemId)) {
        personSet.delete(itemId);
      } else {
        personSet.add(itemId);
      }

      newSelections[personId] = personSet;
      return newSelections;
    });
  };

  const getPersonSubtotal = (personId: string): number => {
    const personItems = selections[personId] || new Set();
    return items
      .filter((item) => personItems.has(item.id))
      .reduce((sum, item) => sum + item.price, 0);
  };

  const getTotalBill = (): number => {
    return items.reduce((sum, item) => sum + item.price, 0);
  };

  const handleCalculate = () => {
    const selectedCount = Object.values(selections).reduce(
      (sum, set) => sum + set.size,
      0
    );

    if (selectedCount === 0) {
      alert('Please select at least one item');
      return;
    }

    onCalculate(selections, peopleNames);
  };

  const updatePersonName = (index: number, name: string) => {
    const newNames = [...peopleNames];
    newNames[index] = name || `Person ${index + 1}`;
    setPeopleNames(newNames);
  };

  return (
    <div className="w-full space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Who ate what?</h2>
        <p className="text-gray-600">Check the items each person ordered</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <label className="block text-sm font-medium mb-2">Number of people</label>
        <div className="flex gap-2">
          {[2, 3, 4, 5].map((num) => (
            <button
              key={num}
              onClick={() => setNumPeople(num)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                numPeople === num
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 hover:border-gray-400'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Person names (optional)</label>
        <div className="grid grid-cols-2 gap-2">
          {peopleNames.map((name, index) => (
            <input
              key={index}
              type="text"
              value={name}
              onChange={(e) => updatePersonName(index, e.target.value)}
              placeholder={`Person ${index + 1}`}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-medium">Item</th>
                <th className="text-right py-3 px-3 font-medium">Price</th>
                {peopleNames.map((name, index) => (
                  <th key={index} className="text-center py-3 px-3 font-medium">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3">{item.name}</td>
                  <td className="text-right py-3 px-3 font-medium">₹{item.price.toFixed(2)}</td>
                  {Array.from({ length: numPeople }).map((_, index) => {
                    const personId = `person-${index}`;
                    const isSelected = selections[personId]?.has(item.id) || false;

                    return (
                      <td key={personId} className="text-center py-3 px-3">
                        <button
                          onClick={() => toggleItemForPerson(personId, item.id)}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 transition ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300 hover:border-blue-500'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h3 className="font-semibold mb-3">Subtotals</h3>
        <div className="grid grid-cols-2 gap-4">
          {peopleNames.map((name, index) => {
            const personId = `person-${index}`;
            const subtotal = getPersonSubtotal(personId);

            return (
              <div key={index} className="flex justify-between">
                <span className="text-gray-700">{name}:</span>
                <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold">Total Bill:</span>
          <span className="text-2xl font-bold text-blue-600">₹{getTotalBill().toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={handleCalculate}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 text-lg"
      >
        Calculate Settlement
      </button>
    </div>
  );
}