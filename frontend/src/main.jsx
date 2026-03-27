import React from 'react';
import ReactDOM from 'react-dom/client';
import { EditorProvider } from './context/EditorContext';
import { Shell } from './components/layout/Shell';
import { EditorPanel } from './components/workbench/EditorPanel';
import './index.css';

const App = () => {
  return (
    <Shell>
      <EditorPanel />
    </Shell>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </React.StrictMode>,
);
