import React from 'react';
import { createRoot } from 'react-dom/client';
import BillQR from '../../components/BillQR.js';

// The host paid and hasn't set a UPI ID yet → the QR sheet must ask for it first
window.__profile = { upi_id: '' };
window.__savedUpi = [];
createRoot(document.getElementById('root')).render(
  <div style={{ height: '100vh', display: 'flex' }}>
    <BillQR visible token="tok-1" title="Brik Oven" byItems mePaid onClose={() => {}} />
  </div>
);
