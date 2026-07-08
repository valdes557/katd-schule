import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import PushOptIn from './components/PushOptIn'
import { registerServiceWorker } from './lib/push'
import './index.css'

// Enregistre le service worker (notifications push) au démarrage — best-effort.
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <PushOptIn />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
