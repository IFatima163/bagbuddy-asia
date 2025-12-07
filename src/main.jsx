import './index.css';
import QRScan from './QRscan';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Mount QR Scan form
const qrEl = document.getElementById('bagbuddy-scan');
if (qrEl) createRoot(qrEl).render(<QRScan />);