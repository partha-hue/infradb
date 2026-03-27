import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { runQuery as runQueryService, connectDB, fetchWorkspaces } from '../api/dbService';

const EditorContext = createContext();

const INITIAL_TABS = [
  { id: '1', title: 'query1.sql', sql: 'SELECT * FROM churn_data LIMIT 100;', type: 'query', dirty: false }
];

const INITIAL_INSTANCES = [
  { id: 'inst-1', name: 'InfraNative_Primary', engine: 'sqlite', status: 'RUNNING', memory: '4GB', database: 'default.db' },
  { id: 'inst-2', name: 'Production_Cluster', engine: 'infranative', status: 'RUNNING', memory: '16GB', host: 'infradb-core.onrender.com', port: 443 },
];

export const EditorProvider = ({ children }) => {
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem('infradb_tabs');
    return saved ? JSON.parse(saved) : INITIAL_TABS;
  });
  
  const [activeTabId, setActiveTabId] = useState(() => {
    return localStorage.getItem('infradb_active_tab_id') || '1';
  });

  const [instances, setInstances] = useState(() => {
    const saved = localStorage.getItem('infradb_instances');
    return saved ? JSON.parse(saved) : INITIAL_INSTANCES;
  });

  const [activeInstanceId, setActiveInstanceId] = useState(() => {
    return localStorage.getItem('infradb_active_instance_id') || INITIAL_INSTANCES[0].id;
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [metrics, setMetrics] = useState({
    memoryUsage: 4100,
    cpuThreads: 12,
    ioThroughput: 15.2,
    isVectorized: true
  });

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const activeInstance = instances.find(i => i.id === activeInstanceId) || instances[0];

  useEffect(() => {
    if (activeInstance && activeInstance.host) {
      connectDB({
        engine: activeInstance.engine,
        host: activeInstance.host,
        port: activeInstance.port,
        database: activeInstance.database
      }).catch(err => {
        console.warn("Engine warm-up initiated...");
      });
    }
  }, [activeInstanceId]);

  const updateSQL = (id, sql) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, sql, dirty: true } : t));
  };

  const executeSQL = useCallback(async (sqlOverride) => {
    const sqlToRun = sqlOverride || activeTab.sql;
    if (!sqlToRun?.trim()) return;

    setLoading(true);
    setError(null);
    
    try {
      // Pass activeInstanceId as connection_id
      const data = await runQueryService(sqlToRun, activeInstanceId);
      setResults(data);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      setResults({ results: [] });
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeInstanceId]);

  const addTab = (sql = '', title = '') => {
    const newId = String(Date.now());
    setTabs(prev => [...prev, { id: newId, title: title || `query${prev.length + 1}.sql`, sql, type: 'query' }]);
    setActiveTabId(newId);
  };

  const closeTab = (id) => {
    if (tabs.length > 1) {
      const newTabs = tabs.filter(t => t.id !== id);
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabId(newTabs[0].id);
    }
  };

  const addInstance = (instance) => {
    const newInst = { ...instance, id: `inst-${Date.now()}`, status: 'RUNNING' };
    setInstances(prev => [...prev, newInst]);
    setActiveInstanceId(newInst.id);
  };

  return (
    <EditorContext.Provider value={{
      tabs, activeTabId, setActiveTabId, activeTab,
      instances, activeInstanceId, setActiveInstanceId, activeInstance, addInstance,
      updateSQL, executeSQL, results, loading, error, addTab, closeTab, metrics
    }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
