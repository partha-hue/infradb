import React, { createContext, useContext, useState, useCallback } from 'react';
import { runQuery as runQueryService } from '../api/dbService';

const EditorContext = createContext();

export const EditorProvider = ({ children }) => {
  const [tabs, setTabs] = useState([{ id: '1', title: 'query1.sql', sql: 'SELECT * FROM users;', dirty: false }]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateSQL = (id, sql) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, sql, dirty: true } : t));
  };

  const executeSQL = useCallback(async (sqlOverride) => {
    const sqlToRun = sqlOverride || activeTab.sql;
    if (!sqlToRun.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await runQueryService(sqlToRun);
      setResults(data);
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, dirty: false } : t));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeTabId]);

  const addTab = (sql = '', title = '') => {
    const newId = String(Date.now());
    setTabs(prev => [...prev, { id: newId, title: title || `query${prev.length + 1}.sql`, sql, dirty: false }]);
    setActiveTabId(newId);
  };

  return (
    <EditorContext.Provider value={{ 
      tabs, setTabs, activeTabId, setActiveTabId, activeTab, 
      updateSQL, executeSQL, results, loading, error, addTab 
    }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
