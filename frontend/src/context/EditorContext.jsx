import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  runQuery as runQueryService,
  fetchWorkspaces,
  fetchSchema as fetchSchemaService,
  fetchQueryHistory,
  optimizeQuery as optimizeQueryService,
  explainQuery as explainQueryService,
  fixSyntax as fixSyntaxService,
} from '../api/dbService';

const EditorContext = createContext();

const INITIAL_TABS = [
  { id: '1', title: 'query1.sql', sql: 'SELECT name FROM users LIMIT 25;', type: 'query', dirty: false },
];

const INITIAL_METRICS = {
  executionMs: null,
  nativeAcceleration: false,
  scanEstimate: null,
  engineMode: 'detached',
};

const mapConnectionToInstance = (connection) => ({
  id: connection.id,
  name: connection.name,
  engine: connection.engine,
  status: connection.is_active ? 'RUNNING' : 'OFFLINE',
  memory: connection.engine === 'SQLITE' ? 'LOCAL' : 'MANAGED',
  database: connection.database_name,
  filePath: connection.file_path,
});

const formatHistoryItem = (item) => ({
  ...item,
  duration: `${Number(item.duration_ms || 0).toFixed(3)}ms`,
  timestampLabel: new Date(item.timestamp).toLocaleString(),
});

export const EditorProvider = ({ children }) => {
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem('infradb_tabs');
    return saved ? JSON.parse(saved) : INITIAL_TABS;
  });
  const [activeTabId, setActiveTabId] = useState(() => localStorage.getItem('infradb_active_tab_id') || '1');
  const [instances, setInstances] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeInstanceId, setActiveInstanceId] = useState(() => localStorage.getItem('infradb_active_instance_id') || null);
  const [activeView, setActiveView] = useState('editor');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [schema, setSchema] = useState([]);
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(INITIAL_METRICS);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const activeInstance = instances.find((instance) => instance.id === activeInstanceId) || instances[0] || null;

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchQueryHistory(50);
      setHistory((data.items || []).map(formatHistoryItem));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    setBootstrapping(true);
    try {
      const data = await fetchWorkspaces();
      const workspaceItems = Array.isArray(data) ? data : [];
      const nextInstances = workspaceItems.flatMap((workspace) =>
        (workspace.connections || []).map(mapConnectionToInstance),
      );

      setWorkspaces(workspaceItems);
      setInstances(nextInstances);

      if (!nextInstances.length) {
        setActiveInstanceId(null);
        return;
      }

      setActiveInstanceId((current) => {
        const persisted = current || localStorage.getItem('infradb_active_instance_id');
        return nextInstances.some((instance) => instance.id === persisted)
          ? persisted
          : nextInstances[0].id;
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBootstrapping(false);
    }
  }, []);

  const refreshSchema = useCallback(async (connectionId) => {
    if (!connectionId) {
      setSchema([]);
      return;
    }

    setSchemaLoading(true);
    try {
      const data = await fetchSchemaService(connectionId);
      setSchema(data.tables || []);
    } catch (err) {
      setSchema([]);
      setError(err.response?.data?.error || err.message);
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspaces();
    refreshHistory();
  }, [refreshHistory, refreshWorkspaces]);

  useEffect(() => {
    localStorage.setItem('infradb_tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('infradb_active_tab_id', activeTabId);
    }
  }, [activeTabId]);

  useEffect(() => {
    if (activeInstanceId) {
      localStorage.setItem('infradb_active_instance_id', activeInstanceId);
      refreshSchema(activeInstanceId);
    }
  }, [activeInstanceId, refreshSchema]);

  const updateSQL = (id, sql) => {
    setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, sql, dirty: true } : tab)));
  };

  const executeSQL = useCallback(async (sqlOverride) => {
    const sqlToRun = sqlOverride || activeTab?.sql;
    if (!sqlToRun?.trim() || !activeInstanceId) {
      return null;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await runQueryService(sqlToRun, activeInstanceId);
      setResults(data);
      setMetrics({
        executionMs: data.execution_time_ms ?? null,
        nativeAcceleration: Boolean(data.engine?.native_acceleration),
        scanEstimate: data.engine?.native?.scan_row_estimate ?? null,
        engineMode: data.engine?.execution_mode || 'detached',
      });
      setTabs((prev) => prev.map((tab) => (tab.id === activeTab?.id ? { ...tab, dirty: false } : tab)));
      refreshHistory();
      return data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      setResults({ results: [] });
      return null;
    } finally {
      setLoading(false);
    }
  }, [activeInstanceId, activeTab, refreshHistory]);

  const optimizeSQL = async () => {
    if (!activeTab?.sql?.trim() || !activeInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await optimizeQueryService(activeTab.sql, activeInstanceId);
      setAiResponse({ type: 'optimize', ...data });
      return data;
    } catch (err) {
      setError(`AI optimization failed: ${err.response?.data?.error || err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const explainSQL = async () => {
    if (!activeTab?.sql?.trim() || !activeInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await explainQueryService(activeTab.sql, activeInstanceId);
      setAiResponse({ type: 'explain', ...data });
      return data;
    } catch (err) {
      setError(`AI explain failed: ${err.response?.data?.error || err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fixSyntax = async () => {
    if (!activeTab?.sql?.trim() || !activeInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fixSyntaxService(activeTab.sql, activeInstanceId);
      setAiResponse({ type: 'fix', ...data });
      if (data.fixed_sql && activeTab?.id) {
        updateSQL(activeTab.id, data.fixed_sql);
      }
      return data;
    } catch (err) {
      setError(`Syntax fix failed: ${err.response?.data?.error || err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addTab = (sql = '', title = '') => {
    const newId = String(Date.now());
    setTabs((prev) => [
      ...prev,
      { id: newId, title: title || `query${prev.length + 1}.sql`, sql, type: 'query', dirty: false },
    ]);
    setActiveTabId(newId);
    setActiveView('editor');
  };

  const closeTab = (id) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const restoreHistoryQuery = (sql) => {
    if (!sql) return;
    if (activeTab?.id) {
      updateSQL(activeTab.id, sql);
    } else {
      addTab(sql);
    }
    setActiveView('editor');
  };

  return (
    <EditorContext.Provider
      value={{
        tabs,
        activeTabId,
        setActiveTabId,
        activeTab,
        workspaces,
        instances,
        activeInstanceId,
        setActiveInstanceId,
        activeInstance,
        activeView,
        setActiveView,
        schema,
        schemaLoading,
        history,
        historyLoading,
        updateSQL,
        executeSQL,
        optimizeSQL,
        explainSQL,
        fixSyntax,
        restoreHistoryQuery,
        refreshWorkspaces,
        refreshSchema,
        refreshHistory,
        results,
        loading,
        bootstrapping,
        error,
        aiResponse,
        setAiResponse,
        addTab,
        closeTab,
        metrics,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
