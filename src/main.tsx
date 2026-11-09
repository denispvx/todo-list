import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './app/App.tsx'

if (typeof FontFace !== 'undefined' && 'ascentOverride' in FontFace.prototype) {
  document.documentElement.classList.add('font-metrics-supported')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
