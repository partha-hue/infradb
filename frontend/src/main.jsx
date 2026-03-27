import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { EditorProvider, useEditor } from './context/EditorContext';
import { 
  Database, 
  Play, 
  Plus, 
  X, 
  Activity, 
  Cpu, 
  Terminal, 
  Search, 
  Settings, 
  ChevronRight,
  BarChart3,
  Cpu as CpuIcon,
  Zap
} from 'lucide-react';
import './index.css';

const Sidebar = () => {
  const { instances, activeInstanceId, setActiveInstanceId } = useEditor();
  
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <Zap className="text-emerald-400 w-6 h-6" />
        <span className="font-bold text-lg tracking-tight">InfraDB</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2 flex justify-between items-center">
          Instances
          <Plus className="w-3 h-3 cursor-pointer hover:text-white" />
        </div>
        
        <div className="space-y-1">
          {instances.map(inst => (
            <div 
              key={inst.id}
              onClick={() => setActiveInstanceId(inst.id)}
              className={`p-2 rounded-md cursor-pointer transition-colors flex items-center gap-3 ${
                activeInstanceId === inst.id ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{inst.name}</div>
                <div className="text-[10px] opacity-60 uppercase">{inst.engine}</div>
              </div>
              {activeInstanceId === inst.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
            </div>
          ))}
        </div>

        <div className="mt-8 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">
          System Metrics
        </div>
        <div className="space-y-3 px-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 flex items-center gap-1.5"><CpuIcon className="w-3 h-3"/> SIMD AVX-512</span>
            <span className="text-emerald-500 font-mono">Active</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 flex items-center gap-1.5"><Activity className="w-3 h-3"/> Latency</span>
            <span className="text-slate-300 font-mono">0.45ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, addTab, executeSQL, loading } = useEditor();

  return (
    <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between">
      <div className="flex items-center flex-1 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <div 
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`group h-12 px-4 flex items-center gap-2 border-r border-slate-800 cursor-pointer min-w-[140px] transition-all relative ${
              activeTabId === tab.id ? 'bg-slate-800/50 text-emerald-400' : 'text-slate-500 hover:bg-slate-800/30'
            }`}
          >
            <span className="text-sm truncate">{tab.title}</span>
            <X 
              className={`w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity absolute right-2`}
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
            />
            {activeTabId === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
          </div>
        ))}
        <button 
          onClick={() => addTab()}
          className="p-2 text-slate-500 hover:text-white transition-colors ml-1"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
        <button 
          onClick={() => executeSQL()}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Play className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? 'Executing...' : 'Run Query'}
        </button>
      </div>
    </div>
  );
};

const Editor = () => {
  const { activeTab, updateSQL } = useEditor();
  
  return (
    <div className="flex-1 flex flex-col bg-[#0b1221]">
      <textarea
        value={activeTab?.sql || ''}
        onChange={(e) => updateSQL(activeTab.id, e.target.value)}
        spellCheck="false"
        className="flex-1 p-6 bg-transparent text-slate-300 font-mono text-sm resize-none outline-none focus:ring-0 placeholder-slate-700 w-full"
        placeholder="-- Enter SQL Query here..."
      />
    </div>
  );
};

const Results = () => {
  const { results, loading, error } = useEditor();

  if (loading) return (
    <div className="h-64 border-t border-slate-800 bg-[#0f172a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-mono">Scanning vectorized batches...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="h-64 border-t border-slate-800 bg-[#0f172a] p-6">
      <div className="flex items-start gap-3 text-rose-400 bg-rose-500/10 p-4 rounded border border-rose-500/20 font-mono text-sm">
        <Terminal className="w-4 h-4 mt-0.5 shrink-0" />
        <pre className="whitespace-pre-wrap">{error}</pre>
      </div>
    </div>
  );

  if (!results) return (
    <div className="h-64 border-t border-slate-800 bg-[#0f172a] flex items-center justify-center text-slate-600">
      <div className="flex flex-col items-center gap-2">
        <Terminal className="w-8 h-8 opacity-20" />
        <span className="text-xs font-mono uppercase tracking-widest">No Execution History</span>
      </div>
    </div>
  );

  return (
    <div className="h-64 border-t border-slate-800 bg-[#0f172a] flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <BarChart3 className="w-3 h-3" /> Query Results
        </div>
        <div className="text-[10px] text-emerald-500/80 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
          SUCCESS: 0.45ms
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-slate-400 font-mono text-xs">
          {JSON.stringify(results, null, 2)}
        </pre>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <div className="h-screen w-screen flex bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col relative">
          <Editor />
          <Results />
        </div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </React.StrictMode>,
);
