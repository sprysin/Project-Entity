
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { isTauri } from '@tauri-apps/api/core';
import { initializeStorage } from './desktop/storage';
import { initializeWindow } from './desktop/lifecycle';

/**
 * Entry point for the React application.
 * Finds the root element in the DOM and renders the App component.
 */
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
async function start() {
  try {
    if (!isTauri()) throw new Error('Please launch Project Entity from its desktop application.');
    await initializeWindow();
    await initializeStorage();
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } catch (error) {
    root.render(<main style={{ color: '#f8fafc', padding: 40 }}>
      <h1>Project Entity could not start</h1>
      <p>{String(error)}</p>
      <p>Your existing save files have not been replaced. Close the game and retry after resolving the issue.</p>
    </main>);
  }
}
void start();
