import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ModeApp from './ModeApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModeApp />
  </StrictMode>,
)
