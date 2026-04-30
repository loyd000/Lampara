import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import App from './App.jsx';
import './index.css';
import AOS from 'aos';
import 'aos/dist/aos.css';

AOS.init({
    duration: 800,
    offset: 100,
    once: true,
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
            <Analytics />
        </BrowserRouter>
    </React.StrictMode>
);
