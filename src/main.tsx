import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LocaleApp from './LocaleApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleApp />
  </StrictMode>,
)
