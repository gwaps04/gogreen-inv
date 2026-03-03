import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// 1. Importing Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
// 2. NEW: Importing Bootstrap JS (Necessary for the Navbar Toggler to work!)
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
// 3. Importing Bootstrap Icons
import 'bootstrap-icons/font/bootstrap-icons.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

