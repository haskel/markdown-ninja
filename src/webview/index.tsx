import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

console.log('BlockNote: index.tsx loaded');

try {
  const container = document.getElementById('root');
  if (container) {
    console.log('BlockNote: Creating React root...');
    const root = createRoot(container);
    console.log('BlockNote: Rendering App...');
    root.render(<App />);
    console.log('BlockNote: App rendered');
  } else {
    console.error('BlockNote: Root element not found');
  }
} catch (error) {
  console.error('BlockNote: Fatal error:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<pre style="color:red;padding:20px;">Fatal Error: ${error}</pre>`;
  }
}
