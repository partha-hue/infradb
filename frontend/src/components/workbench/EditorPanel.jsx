import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { 
  Terminal, 
  Clock, 
  BarChart3, 
  ChevronDown, 
  Filter, 
  Download, 
  Zap, 
  Layers, 
  History, 
  Sparkles,
  Search,
  Table as TableIcon,
  ChevronRight,
  Database
} from 'lucide-react';

const SchemaExplorer = () => {
  const { schema } = useEditor();
  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="p-4 border-b border-border bg-sidebar/30">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search tables, views, columns..." 
            className="w-full bg-background border border-border rounded px-9 py-2 text-xs focus:outline-none focus:border-brand/50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {schema.map((table, idx) => (
          <div key={idx} className="mb-2">
            <div className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer group">
              <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-transform" />
              <TableIcon className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs font-bold uppercase tracking-tight">{table.table}</span>
            </div>
            <div className="ml-6 space-y-1 mt-1">
              {table.columns.map((col, cIdx) => (
                <div key={cIdx} className="flex items-center justify-between p-1.5 hover:bg-muted/30 rounded text-[11px] text-muted-foreground group">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-brand/70">#</span>
                    <span>{col.name}</span>
                  </div>
                  <span className="text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity bg-muted px-1 rounded">{col.type}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QueryHistory = () => {
  const { history, updateSQL, setActiveView } = useEditor();
  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-sidebar border-b border-border z-10">
            <tr>
              <th className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Query</th>
              <th className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Duration</th>
              <th className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody className="text-[11px] font-mono">
            {history.map((item) => (
              <tr 
                key={item.id} 
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer group"
                onClick={() => {
                  updateSQL('1', item.sql); // Restore to current tab for simplicity
                  setActiveView('editor');
                }}
              >
                <td className="px-4 py-3">
                  <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold ${
                    item.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300 truncate max-w-[400px]">{item.sql}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.duration}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ResultTable = ({ data }) => {
  if (!data?.results || data.results.length === 0) return null;
  const columns = Object.keys(data.results[0]);

  return (
    <div className="flex-1 overflow-auto border-t border-border bg-background">
      <table className="w-full text-left border-collapse min-w-max">
        <thead className="sticky top-0 bg-sidebar border-b border-border z-10 shadow-sm">
          <tr>
            {columns.map(col => (
              <th key={col} className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r border-border">
                <div className="flex items-center gap-2 group">
                  {col}
                  <Filter className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono text-[11px]">
          {data.results.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              {columns.map(col => (
                <td key={col} className="px-4 py-1.5 border-r border-border/50 text-slate-300">
                  {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const EditorPanel = () => {
  const { activeTab, updateSQL, results, loading, error, activeView, activeInstance } = useEditor();

  const renderMainContent = () => {
    switch (activeView) {
      case 'schema':
        return <SchemaExplorer />;
      case 'history':
        return <QueryHistory />;
      case 'insights':
        return (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <Sparkles className="w-12 h-12 text-brand animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em]">AI Performance Insights</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Our Infra-Native Engine is analyzing your workload pattern across <span className="text-brand font-bold">{activeInstance.name}</span>. 
                Optimization recommendations will appear here automatically.
              </p>
              <div className="mt-4 p-4 border border-brand/20 bg-brand/5 rounded-lg w-full text-left font-mono text-[10px] space-y-2">
                <div className="flex items-center gap-2 text-brand">
                  <Zap className="w-3 h-3" /> [STRATEGY] INDEX RECOMMENDATION
                </div>
                <div className="text-muted-foreground">Detected frequent scans on 'advertising.campaign_name'.</div>
                <div className="text-foreground">CREATE INDEX idx_campaign ON advertising(campaign_name);</div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex-1 flex flex-col bg-[#09090b]">
            <div className="flex-1 relative min-h-[100px] flex flex-col group">
              <div className="absolute right-6 top-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="bg-muted border border-border rounded flex items-center gap-2 px-3 py-1.5 shadow-2xl">
                    <Zap className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Optimizer Ready</span>
                 </div>
              </div>
              <textarea
                value={activeTab?.sql || ''}
                onChange={(e) => updateSQL(activeTab.id, e.target.value)}
                spellCheck="false"
                className="flex-1 p-8 bg-transparent text-slate-200 font-mono text-[13px] leading-relaxed resize-none outline-none focus:ring-0 placeholder-muted-foreground/30 w-full"
                placeholder="-- Execute high-performance queries on Infra-Kernel v3.0..."
              />
            </div>

            {/* Results / Panel Area */}
            <div className="h-[40%] border-t border-border flex flex-col bg-sidebar shadow-2xl">
              <div className="h-9 px-4 flex items-center justify-between border-b border-border bg-sidebar/50">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-foreground uppercase tracking-widest">
                    <BarChart3 className="w-3.5 h-3.5 text-accent" /> Results
                  </div>
                  {results && !loading && (
                    <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground uppercase">
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3"/> 0.45ms</span>
                      <span className="flex items-center gap-1.5 text-emerald-500"><Zap className="w-3 h-3 fill-current"/> Vectorized</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] animate-pulse">
                      Parallel Scan in Progress
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex-1 p-6 overflow-auto">
                   <div className="bg-rose-500/5 border border-rose-500/20 rounded p-4 font-mono text-xs text-rose-400 leading-relaxed shadow-lg">
                     <div className="flex items-center gap-2 mb-2 font-bold uppercase tracking-widest">
                        <Terminal className="w-3.5 h-3.5" /> Runtime Error
                     </div>
                     {error}
                   </div>
                </div>
              ) : results ? (
                <ResultTable data={results} />
              ) : (
                <div className="flex-1 flex items-center justify-center opacity-30 select-none grayscale">
                  <div className="flex flex-col items-center gap-3">
                    <Terminal className="w-12 h-12 text-muted-foreground" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Execution Context</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b]">
      {/* Dynamic View Header (Breadcrumb style) */}
      <div className="h-10 px-6 border-b border-border bg-sidebar/20 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="w-3 h-3" /> {activeInstance.name}
        </div>
        <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
        <div className="flex items-center gap-2 text-brand">
          {activeView === 'editor' && <Terminal className="w-3 h-3" />}
          {activeView === 'schema' && <Layers className="w-3 h-3" />}
          {activeView === 'history' && <History className="w-3 h-3" />}
          {activeView === 'insights' && <Zap className="w-3 h-3" />}
          {activeView}
        </div>
      </div>
      
      {renderMainContent()}
    </div>
  );
};
