import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Wymuś odrejestrowanie starego Service Workera który psuł CORS dla Supabase auth
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
