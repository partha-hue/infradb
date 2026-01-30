import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { EditorProvider } from './context/EditorContext'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <EditorProvider>
        <App />
      </EditorProvider>
    </AuthProvider>
  </React.StrictMode>
)
