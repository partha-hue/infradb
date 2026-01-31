import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { runQuery as runQueryService } from '../api/dbService';

const EditorContext = createContext();

const DEFAULT_SETTINGS = {
  editor: {
    fontSize: 14,
    fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
    theme: 'vs-dark',
    lineNumbers: true,
    wordWrap: 'off',
  },
  dbms: {
    defaultLimit: 100,
    autoCommit: true,
    showSystemTables: false,
  },
  keyboard: {
    runQuery: 'Ctrl+Enter',
    newTab: 'Ctrl+T',
    closeTab: 'Ctrl+W',
    openSettings: 'Ctrl+,',
  }
};

export const EditorProvider = ({ children }) => {
  const [tabs, setTabs] = useState([{ id: '1', title: 'query1.sql', sql: 'SELECT * FROM users;', type: 'query', dirty: false }]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Load settings from localStorage or use defaults
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('infradb_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('infradb_settings', JSON.stringify(settings));
  }, [settings]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateSQL = (id, sql) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, sql, dirty: true } : t));
  };

  const executeSQL = useCallback(async (sqlOverride) => {
    const sqlToRun = sqlOverride || activeTab.sql;
    if (!sqlToRun || !sqlToRun.trim()) return;

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

  const addTab = (sql = '', title = '', type = 'query') => {
    const existingSettingsTab = tabs.find(t => t.type === 'settings');
    if (type === 'settings' && existingSettingsTab) {
      setActiveTabId(existingSettingsTab.id);
      return;
    }

    const newId = String(Date.now());
    setTabs(prev => [...prev, { 
      id: newId, 
      title: title || (type === 'settings' ? 'Settings' : `query${prev.length + 1}.sql`), 
      sql, 
      type,
      dirty: false 
    }]);
    setActiveTabId(newId);
  };

  const closeTab = (id) => {
    if (tabs.length > 1) {
      const newTabs = tabs.filter(t => t.id !== id);
      setTabs(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
    }
  };

  const updateSettings = (path, value) => {
    setSettings(prev => {
      const keys = path.split('.');
      const newSettings = { ...prev };
      let current = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  return (
    <EditorContext.Provider value={{ 
      tabs, setTabs, activeTabId, setActiveTabId, activeTab, 
      updateSQL, executeSQL, results, loading, error, addTab, closeTab,
      settings, updateSettings
    }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
