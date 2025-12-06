import './index.css';
import App from './App';
import QRScan from './QRscan';
import Service2 from './Service2';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Mount Service 1
const service1El = document.getElementById('bagbuddy-service1');
if (service1El) createRoot(service1El).render(<App />);

// Mount QR Scan form
const qrEl = document.getElementById('bagbuddy-scan');
if (qrEl) createRoot(qrEl).render(<QRScan />);

// Mount Service 2
const service2El = document.getElementById('bagbuddy-service2');
if (service2El) createRoot(service2El).render(<Service2 />);

