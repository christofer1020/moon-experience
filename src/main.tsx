import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/instrument-sans'
import '@fontsource/jetbrains-mono/400.css'
import './styles/app.css'
import App from './App'

// StrictMode is intentionally not used: the WebGL engine owns persistent GPU resources.
void StrictMode
createRoot(document.getElementById('root')!).render(<App />)
