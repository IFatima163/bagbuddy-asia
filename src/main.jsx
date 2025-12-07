import './index.css';
import App from './App';
import Service2 from './Service2';
import Service3 from './Service3';
import QRScan from './QRscan';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Mount Service 1
const service1El = document.getElementById('bagbuddy-service1');
if (service1El) createRoot(service1El).render(<App />);

// Mount Service 2
const service2El = document.getElementById('bagbuddy-service2');
if (service2El) createRoot(service2El).render(<Service2 />);

// Mount Service 3
const service3El = document.getElementById('bagbuddy-service3');
if (service3El) createRoot(service3El).render(<Service3 />);

// Mount QR Scan form
const qrEl = document.getElementById('bagbuddy-scan');
if (qrEl) createRoot(qrEl).render(<QRScan />);