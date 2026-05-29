import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ProfileProvider } from './profile/ProfileContext.jsx';
import './index.css';

// basename matches Vite's base so the app works under a GitHub Pages project path (/<repo>/).
// On Pages, a 404.html copy of index.html (added by the deploy workflow) makes deep links survive
// a refresh, since Pages has no SPA rewrite.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <ProfileProvider>
        <App />
      </ProfileProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
