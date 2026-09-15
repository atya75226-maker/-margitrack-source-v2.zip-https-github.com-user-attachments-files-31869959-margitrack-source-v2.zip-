import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initialiserPwa } from './lib/pwa'
import './index.css'

// Avant le rendu : beforeinstallprompt n'est émis qu'une fois, et tôt.
initialiserPwa()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
