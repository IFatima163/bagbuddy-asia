import './index.css';
import App from './App';
import React from 'react';
import { createRoot } from 'react-dom/client';
const rootEl = document.getElementById('bagbuddy-service1');
if(rootEl) createRoot(rootEl).render(<App />);
