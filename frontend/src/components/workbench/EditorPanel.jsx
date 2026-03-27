import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { Terminal, Clock, BarChart3, ChevronDown, Filter, Download, Zap } from 'lucide-react';

const ResultTable = ({ data }) => {
  if (!data?.results || data.results.length === 0) return null;
  
  // Dummy data columns for presentation if results are empty
  const columns = Object.keys(data.results[0] || { id: 1, name: 'Sample', status: 'Active' });

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
  const { activeTab, updateSQL, results, loading, error } = useEditor();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b]">
      {/* Code Editor Area */}
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
};
