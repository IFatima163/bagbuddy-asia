import './index.css';
import App from './App';
import QRScan from './QRscan';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Mount Service 1
const service1El = document.getElementById('bagbuddy-service1');
if (service1El) createRoot(service1El).render(<App />);

// Mount QR Scan form
const qrEl = document.getElementById('bagbuddy-scan');
if (qrEl) createRoot(qrEl).render(<QRScan />);
