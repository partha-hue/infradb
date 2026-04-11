import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { X, Plus, Play, Save, Share2, ChevronRight, Terminal } from 'lucide-react';

const Tab = ({ tab, active, onSelect, onClose }) => (
  <div 
    onClick={onSelect}
    className={`group h-9 px-3 flex items-center gap-2 border-r border-border cursor-pointer transition-all select-none relative ${
      active ? 'bg-background text-foreground' : 'bg-sidebar text-muted-foreground hover:bg-muted/30'
    }`}
  >
    <Terminal className={`w-3.5 h-3.5 ${active ? 'text-accent' : 'text-muted-foreground'}`} />
    <span className="text-xs font-medium truncate max-w-[120px]">{tab.title}</span>
    {tab.dirty && <div className="w-1.5 h-1.5 rounded-full bg-accent/50" />}
    <X 
      className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity ml-1" 
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    />
    {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent shadow-[0_0_8px_rgba(16,185,129,0.4)]" />}
  </div>
);

export const Header = () => {
  const { tabs, activeTabId, setActiveTabId, addTab, closeTab, executeSQL, loading, activeTab } = useEditor();

  const downloadCurrentSQL = () => {
    const sql = activeTab?.sql || '';
    const fileName = activeTab?.title || 'query.sql';
    const blob = new Blob([sql], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const shareCurrentSQL = async () => {
    const sql = activeTab?.sql || '';
    try {
      await navigator.clipboard.writeText(sql);
    } catch {
      // Clipboard API may be unavailable in non-secure contexts.
    }
  };

  return (
    <header className="h-12 bg-sidebar border-b border-border flex flex-col justify-end">
      <div className="flex items-center justify-between px-2 pr-4 h-9">
        <div className="flex items-center overflow-x-auto no-scrollbar flex-1">
          {tabs.map(tab => (
            <Tab 
              key={tab.id}
              tab={tab}
              active={activeTabId === tab.id}
              onSelect={() => setActiveTabId(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
          <button 
            onClick={() => addTab()}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pl-4">
          <button onClick={downloadCurrentSQL} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <Save className="w-4 h-4" />
          </button>
          <button onClick={shareCurrentSQL} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button 
            onClick={() => executeSQL()}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-1 rounded bg-accent text-accent-foreground text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50`}
          >
            <Play className={`w-3.5 h-3.5 fill-current ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'RUNNING...' : 'EXECUTE'}
          </button>
        </div>
      </div>
    </header>
  );
};
