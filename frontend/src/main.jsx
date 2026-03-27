import React from 'react'
import ReactDOM from 'react-dom/client'
import { EditorProvider } from './context/EditorContext'
import './index.css'

// Placeholder App component
const App = () => (
  <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">InfraDB Console</h1>
      <p className="text-slate-400">High-performance data infrastructure engine</p>
      <div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-emerald-400 font-mono">Engine Status: Online (SIMD AVX-512)</p>
      </div>
    </div>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </React.StrictMode>,
)
