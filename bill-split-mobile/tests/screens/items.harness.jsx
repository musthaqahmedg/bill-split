import React from 'react';
import { createRoot } from 'react-dom/client';
import ItemsScreen from '../../screens/ItemsScreen.js';

const items = [
  { name: 'French Fries Parmesan Garlic', price: 350, qty: 1, kind: 'food' },
  { name: 'Rei Cotta Pizza - Large', price: 620, qty: 1, kind: 'food' },
  { name: 'Kingfisher Ultra', price: 600, qty: 3, kind: 'alcohol' },
  { name: 'Coke', price: 90, qty: 1, kind: 'soft' },
];
const people = ['Me', 'Alina', 'Anuraj', 'Kanchan', 'Ram'];
window.__result = null;
function App() {
  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <ItemsScreen items={items} people={people} onBack={() => {}} onNext={(claims, dry) => { window.__result = { claims, dry }; }} />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
