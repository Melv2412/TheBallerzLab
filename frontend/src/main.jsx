import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { AuthProvider } from './AuthContext'

// La molette ne change jamais un champ numérique (numéro de maillot, scores) : elle fait défiler la page
document.addEventListener('wheel', (e) => {
  const champ = e.target
  if (champ instanceof HTMLInputElement && champ.type === 'number' && document.activeElement === champ) champ.blur()
}, { passive: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)


