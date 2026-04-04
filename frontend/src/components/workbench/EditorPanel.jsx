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
  Database,
  Loader2,
} from 'lucide-react';

const EmptyState = ({ icon: Icon, label, detail }) => (
  <div className="flex-1 flex items-center justify-center opacity-70 select-none">
    <div className="flex flex-col items-center gap-3 max-w-sm text-center">
      <Icon className="w-10 h-10 text-muted-foreground" />
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      {detail && <p className="text-[11px] text-muted-foreground leading-relaxed">{detail}</p>}
    </div>
  </div>
);

const SchemaExplorer = () => {
  const { schema, schemaLoading } = useEditor();

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
        {schemaLoading ? (
          <EmptyState icon={Loader2} label="Loading Schema" detail="Reading catalog metadata from the active database." />
        ) : schema.length ? (
          schema.map((table) => (
            <div key={table.table} className="mb-2">
              <div className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer group">
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-transform" />
                <TableIcon className="w-3.5 h-3.5 text-brand" />
                <span className="text-xs font-bold uppercase tracking-tight">{table.table}</span>
              </div>
              <div className="ml-6 space-y-1 mt-1">
                {(table.columns || []).map((column) => (
                  <div key={`${table.table}-${column.name}`} className="flex items-center justify-between p-1.5 hover:bg-muted/30 rounded text-[11px] text-muted-foreground group">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-brand/70">#</span>
                      <span>{column.name}</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity bg-muted px-1 rounded">
                      {column.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={Layers} label="No Schema Loaded" detail="The current connection did not return any table metadata." />
        )}
      </div>
    </div>
  );
};

const QueryHistory = () => {
  const { history, historyLoading, restoreHistoryQuery } = useEditor();

  if (historyLoading) {
    return <EmptyState icon={Loader2} label="Loading History" detail="Fetching recent query executions." />;
  }

  if (!history.length) {
    return <EmptyState icon={History} label="No Query History" detail="Execute a statement to build the workload timeline." />;
  }

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
                onClick={() => restoreHistoryQuery(item.sql)}
              >
                <td className="px-4 py-3">
                  <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold ${
                    item.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300 truncate max-w-[420px]">{item.sql}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.duration}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.timestampLabel}</td>
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
            {columns.map((column) => (
              <th key={column} className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r border-border">
                <div className="flex items-center gap-2 group">
                  {column}
                  <Filter className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono text-[11px]">
          {data.results.map((row, index) => (
            <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              {columns.map((column) => (
                <td key={column} className="px-4 py-1.5 border-r border-border/50 text-slate-300">
                  {typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column])}
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
  const { activeTab, updateSQL, executeSQL, results, loading, error, activeView, activeInstance, metrics } = useEditor();

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
                Interactive telemetry is now backed by the live control plane on{' '}
                <span className="text-brand font-bold">{activeInstance?.name || 'no active connection'}</span>.
              </p>
              <div className="mt-4 p-4 border border-brand/20 bg-brand/5 rounded-lg w-full text-left font-mono text-[10px] space-y-2">
                <div className="flex items-center gap-2 text-brand">
                  <Zap className="w-3 h-3" /> [ENGINE] EXECUTION PATH
                </div>
                <div className="text-muted-foreground">Mode: {metrics.engineMode}</div>
                <div className="text-foreground">
                  Native acceleration: {metrics.nativeAcceleration ? 'detected' : 'not attached'}
                </div>
                {metrics.scanEstimate && (
                  <div className="text-foreground">Vector scan estimate: {metrics.scanEstimate.toLocaleString()} rows</div>
                )}
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
                onChange={(event) => updateSQL(activeTab.id, event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    executeSQL();
                  }
                }}
                spellCheck="false"
                className="flex-1 p-8 bg-transparent text-slate-200 font-mono text-[13px] leading-relaxed resize-none outline-none focus:ring-0 placeholder-muted-foreground/30 w-full"
                placeholder="-- Execute high-performance queries on Infra-Kernel v3.0..."
              />
            </div>

            <div className="h-[40%] border-t border-border flex flex-col bg-sidebar shadow-2xl">
              <div className="h-9 px-4 flex items-center justify-between border-b border-border bg-sidebar/50">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-foreground uppercase tracking-widest">
                    <BarChart3 className="w-3.5 h-3.5 text-accent" /> Results
                  </div>
                  {results && !loading && (
                    <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground uppercase">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {Number(results.execution_time_ms || 0).toFixed(3)}ms
                      </span>
                      <span className={`flex items-center gap-1.5 ${results.engine?.native_acceleration ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        <Zap className="w-3 h-3 fill-current" /> {results.engine?.native_acceleration ? 'Native attached' : 'SQLite execution'}
                      </span>
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
              ) : results?.results?.length ? (
                <ResultTable data={results} />
              ) : results ? (
                <EmptyState
                  icon={BarChart3}
                  label="Statement Completed"
                  detail={`Rows affected: ${results.rows_affected ?? 0}. Query type: ${results.query_type || 'unknown'}.`}
                />
              ) : (
                <EmptyState
                  icon={Terminal}
                  label="No Execution Context"
                  detail="Run a query from the active editor tab to stream results into the console."
                />
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b]">
      <div className="h-10 px-6 border-b border-border bg-sidebar/20 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="w-3 h-3" /> {activeInstance?.name || 'No connection'}
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
