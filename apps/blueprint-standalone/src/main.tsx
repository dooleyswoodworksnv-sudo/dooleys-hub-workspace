import React from 'react';
import ReactDOM from 'react-dom/client';
import { ProjectProvider } from '@dooleys/core';
import '@dooleys/ui/src/styles/globals.css';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </React.StrictMode>
);
