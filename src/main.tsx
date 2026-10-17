import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App'
import { registerServiceWorker } from './lib/pushNotifications'

// Register root service worker for PWA offline shell & Web Push
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerServiceWorker()
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
