import React, { useState, useEffect } from 'react';
import { FaDatabase, FaPlay, FaHistory, FaTable, FaProjectDiagram, FaFileImport, FaSave, FaRobot, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { connectDB, getSchema, suggestQuery, importData } from './api/dbService';
import { useAuth } from './hooks/useAuth';
import { useDatabase } from './hooks/useDatabase';
import axiosInstance from './api/axios';
import './styles.css';

// Connection Dialog
function ConnectionDialog({ isOpen, onClose, onConnect }) {
  const [dbType, setDbType] = useState('sqlite');
  const [database, setDatabase] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = { db_type: dbType };
      if (dbType === 'sqlite') {
        payload.database = database || 'default.db';
      } else {
        payload.host = host;
        payload.port = port;
        payload.user = user;
        payload.password = password;
        payload.database = database;
      }
      const result = await connectDB(payload);
      onConnect(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h2 className="dialog-title">🔗 Connect to Database</h2>
        <div className="form-group">
          <label className="form-label">Database Type</label>
          <select className="form-select" value={dbType} onChange={(e) => setDbType(e.target.value)}>
            <option value="sqlite">SQLite (Local File)</option>
            <option value="mysql">MySQL (Remote)</option>
            <option value="postgresql">PostgreSQL (Remote)</option>
          </select>
        </div>
        {dbType === 'sqlite' ? (
          <div className="form-group">
            <label className="form-label">Database File</label>
            <input
              type="text"
              className="form-input"
              placeholder="default.db"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Host</label>
              <input type="text" className="form-input" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Port</label>
              <input type="text" className="form-input" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-input" value={user} onChange={(e) => setUser(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Database Name</label>
              <input type="text" className="form-input" value={database} onChange={(e) => setDatabase(e.target.value)} />
            </div>
          </>
        )}
        {error && <div className="error-message">{error}</div>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={loading}>
            {loading ? <span className="spinner"></span> : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Schema Panel
function SchemaPanel({ schema, loading }) {
  if (loading) return <div className="sidebar-content"><span className="spinner"></span></div>;
  if (!schema || schema.length === 0) {
    return (
      <div className="sidebar-content">
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">No tables found</div>
        </div>
      </div>
    );
  }
  return (
    <div className="sidebar-content scrollbar">
      {schema.map((table, idx) => (
        <div key={idx} className="schema-table">
          <div className="table-name">📊 {table.name}</div>
          <ul className="column-list">
            {table.columns.map((col, colIdx) => (
              <li key={colIdx}>• {col}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// History Panel
function HistoryPanel({ history, onLoad }) {
  if (!history || history.length === 0) {
    return (
      <div className="sidebar-content">
        <div className="empty-state">
          <div className="empty-state-icon">📜</div>
          <div className="empty-state-text">No query history</div>
        </div>
      </div>
    );
  }
  return (
    <div className="sidebar-content scrollbar">
      {history.map((item, idx) => (
        <div key={idx} className="history-item" onClick={() => onLoad(item.query)} title={item.query}>
          <div style={{ fontSize: '11px', color: '#d4d4d4', marginBottom: '4px' }}>
            {item.query.slice(0, 45)}...
          </div>
          <div style={{ fontSize: '10px', color: '#858585' }}>
            ⏱️ {Math.round(item.execution_time || 0)}ms
          </div>
        </div>
      ))}
    </div>
  );
}

// Results Panel
function ResultsPanel({ results, error }) {
  if (error) return <div className="bottom-content"><div className="error-message">{error}</div></div>;
  if (!results || results.length === 0) {
    return <div className="bottom-content"><div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-text">Run a query to see results</div></div></div>;
  }

  // Handle case where results might be a direct list or wrapped
  const displayResults = Array.isArray(results) ? results : (results.results || []);

  return (
    <div className="bottom-content scrollbar">
      {displayResults.map((result, idx) => (
        <div key={idx} className="result-block">
          <div className="result-header">
            <span>{result.message || 'Success'}</span>
            {result.columns?.length && <span>{result.rows?.length || 0} rows</span>}
          </div>
          {result.columns && result.columns.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="result-table">
                <thead>
                  <tr>
                    {result.columns.map((col, cIdx) => (
                      <th key={cIdx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows && result.rows.slice(0, 100).map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx}>{cell === null ? 'NULL' : String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows && result.rows.length > 100 && (
                <div style={{ fontSize: '11px', color: '#858585', marginTop: '8px' }}>
                  Showing 100 of {result.rows.length} rows
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Login View
function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login({ username, password });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-box" style={{ maxWidth: '400px' }}>
        <h2 className="dialog-title">🔑 InfraDB Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%' }} type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const { user, logout, loading: authLoading } = useAuth();
  const { executeQuery, results, history, loading: dbLoading, error: dbError, fetchHistory } = useDatabase();
  
  const [tabs, setTabs] = useState([{ id: '1', title: 'query1.sql', sql: 'SELECT 1;', dirty: false }]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [connected, setConnected] = useState(false);
  const [schema, setSchema] = useState([]);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('schema');
  const [bottomTab, setBottomTab] = useState('results');
  const [consoleText, setConsoleText] = useState('');

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, fetchHistory]);

  const fetchSchemaData = async () => {
    try {
      const result = await getSchema();
      setSchema(result.tables || []);
    } catch (err) {
      console.error('Schema error:', err);
    }
  };

  const handleRun = async () => {
    if (!activeTab?.sql.trim()) return;
    try {
      await executeQuery(activeTab.sql);
      setBottomTab('results');
      setTabs(tabs.map(t => t.id === activeTabId ? { ...t, dirty: false } : t));
    } catch (err) {
      if (err.message.toLowerCase().includes('no active connection')) {
        setConnected(false);
        setConnectionDialogOpen(true);
      }
    }
  };

  const handleAI = async () => {
    const prompt = window.prompt("What query would you like to generate?");
    if (!prompt) return;
    try {
      const result = await suggestQuery(prompt);
      if (result.sql) {
        updateSQL(activeTabId, result.sql);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConnect = () => {
    setConnected(true);
    fetchSchemaData();
    fetchHistory();
  };

  const updateSQL = (id, value) => {
    setTabs(tabs.map(t => t.id === id ? { ...t, sql: value, dirty: true } : t));
  };

  const addTab = (sql = '', title = '') => {
    const newId = String(Date.now());
    setTabs([...tabs, {
      id: newId,
      title: title || `query${tabs.length + 1}.sql`,
      sql: sql,
      dirty: false
    }]);
    setActiveTabId(newId);
  };

  if (authLoading) return <div className="app-root" style={{ justifyContent: 'center', alignItems: 'center' }}><span className="spinner"></span></div>;
  if (!user) return <LoginView />;

  return (
    <div className="app-root">
      <div className="toolbar">
        <span className="app-title">🗄️ InfraDB</span>
        <div className="toolbar-section">
          <button className="toolbar-btn" onClick={() => setConnectionDialogOpen(true)}><FaDatabase /> Connect</button>
          <button className="toolbar-btn" onClick={handleRun} disabled={dbLoading || !connected}><FaPlay /> Run</button>
          <button className="toolbar-btn" onClick={handleAI}><FaRobot /> AI Suggest</button>
        </div>
        <div className="toolbar-section" style={{ marginLeft: 'auto' }}>
          <div className="connection-status">
            <div className={`status-dot ${connected ? 'status-ok' : 'status-bad'}`}></div>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button className="toolbar-btn" onClick={logout} title="Logout"><FaSignOutAlt /></button>
        </div>
      </div>

      <div className="workbench">
        <div className="sidebar">
          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${sidebarTab === 'schema' ? 'active' : ''}`} onClick={() => setSidebarTab('schema')}>📊 Schema</button>
            <button className={`sidebar-tab ${sidebarTab === 'history' ? 'active' : ''}`} onClick={() => setSidebarTab('history')}>📜 History</button>
          </div>
          {sidebarTab === 'schema' ? <SchemaPanel schema={schema} loading={dbLoading} /> : <HistoryPanel history={history} onLoad={(q) => addTab(q, 'history.sql')} />}
        </div>

        <div className="main-pane">
          <div className="tab-strip">
            {tabs.map(tab => (
              <button key={tab.id} className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(tab.id)}>
                {tab.title} {tab.dirty && <span style={{ color: '#f48771' }}>●</span>}
              </button>
            ))}
            <button className="tab-add" onClick={() => addTab()}>+</button>
          </div>
          <div className="editor-pane">
            <textarea className="sql-editor" value={activeTab?.sql || ''} onChange={(e) => updateSQL(activeTabId, e.target.value)} spellCheck="false" />
          </div>
          <div className="bottom-pane">
            <div className="bottom-tabs">
              <button className={`bottom-tab ${bottomTab === 'results' ? 'active' : ''}`} onClick={() => setBottomTab('results')}>Results</button>
            </div>
            {bottomTab === 'results' && <ResultsPanel results={results} error={dbError} />}
          </div>
        </div>
      </div>

      <ConnectionDialog isOpen={connectionDialogOpen} onClose={() => setConnectionDialogOpen(false)} onConnect={handleConnect} />
    </div>
  );
}
