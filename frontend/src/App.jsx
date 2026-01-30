import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VscDatabase, VscHistory, VscSearch, VscSettingsGear, VscPlay, 
  VscAdd, VscClose, VscChevronRight, VscChevronDown, 
  VscSymbolMethod, VscTerminal, VscLayoutSidebarRightOff, VscLayoutSidebarRight,
  VscAccount, VscDebugConsole, VscCode, VscFeedback, VscBeaker,
  VscFolderOpened, VscRemoteExplorer, VscSourceControl, VscLink,
  VscSymbolField
} from "react-icons/vsc";
import { connectDB, getSchema, suggestQuery, runQuery as runQueryService, loadSampleDB } from './api/dbService';
import { useAuth } from './hooks/useAuth';
import { useDatabase } from './hooks/useDatabase';
import axiosInstance from './api/axios';
import './styles.css';

// Connection Dialog
function ConnectionDialog({ isOpen, onClose, onConnect }) {
  const [dbType, setDbType] = useState('sqlite');
  const [config, setConfig] = useState({
    database: 'default.db',
    host: 'localhost',
    port: '',
    user: 'root',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = { ...config, db_type: dbType };
      const result = await connectDB(payload);
      onConnect(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth: '400px'}}>
        <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', padding: '0 0 15px 0'}}>
          <span>CONNECT TO DATABASE</span>
          <VscClose style={{cursor: 'pointer'}} onClick={onClose} />
        </div>
        
        <div className="form-group">
          <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>DATABASE TYPE</label>
          <select className="form-input" value={dbType} onChange={(e) => setDbType(e.target.value)}>
            <option value="sqlite">SQLite (Local)</option>
            <option value="mysql">MySQL (Remote)</option>
            <option value="postgresql">PostgreSQL (Remote)</option>
          </select>
        </div>

        {dbType === 'sqlite' ? (
          <div className="form-group">
            <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>DATABASE FILE</label>
            <input className="form-input" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} />
          </div>
        ) : (
          <>
            <div className="flex-row gap-10">
              <input className="form-input" placeholder="Host" value={config.host} onChange={e => setConfig({...config, host: e.target.value})} />
              <input className="form-input" style={{width: '80px'}} placeholder="Port" value={config.port} onChange={e => setConfig({...config, port: e.target.value})} />
            </div>
            <div className="flex-row gap-10">
              <input className="form-input" placeholder="User" value={config.user} onChange={e => setConfig({...config, user: e.target.value})} />
              <input className="form-input" type="password" placeholder="Password" value={config.password} onChange={e => setConfig({...config, password: e.target.value})} />
            </div>
            <input className="form-input" placeholder="Database Name" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} />
          </>
        )}

        {error && <div style={{color: '#f48771', fontSize: '12px', marginTop: '10px'}}>{error}</div>}
        <button className="btn-primary full-width" style={{marginTop: '20px'}} onClick={handleConnect} disabled={loading}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

// Login View
function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="modal-overlay" style={{backgroundColor: '#1e1e1e'}}>
      <div className="modal-content" style={{maxWidth: '320px', textAlign: 'center'}}>
        <VscAccount size={48} style={{color: '#007acc', marginBottom: '15px'}} />
        <h2 className="dialog-title" style={{color: '#fff', fontSize: '18px', marginBottom: '20px'}}>InfraDB Login</h2>
        <input className="form-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="form-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div style={{color: '#f48771', fontSize: '12px', marginTop: '10px'}}>{error}</div>}
        <button className="btn-primary full-width" style={{marginTop: '20px'}} onClick={async () => {
          try { await login({ username, password }); } catch (err) { setError(err.message); }
        }}>Sign In</button>
      </div>
    </div>
  );
}

// Schema Tree Components
const TableNode = ({ table, onTableClick }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className="explorer-db-item" onClick={() => setExpanded(!expanded)} onDoubleClick={() => onTableClick(table.name)}>
        {expanded ? <VscChevronDown size={12}/> : <VscChevronRight size={12}/>}
        <VscSymbolMethod size={14} color="#4fb6cc"/>
        <span style={{fontSize: '13px'}}>{table.name}</span>
      </div>
      {expanded && (
        <div style={{paddingLeft: '25px'}}>
          {table.columns.map((col, i) => (
            <div key={i} className="explorer-db-item" style={{cursor: 'default'}}>
              <VscSymbolField size={12} color="#858585"/>
              <span style={{fontSize: '12px', color: '#858585'}}>{col}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const { user, logout, loading: authLoading } = useAuth();
  const { executeQuery, results, history, loading: dbLoading, error: dbError, fetchHistory } = useDatabase();
  
  const [tabs, setTabs] = useState([{ id: '1', title: 'query1.sql', sql: 'SELECT * FROM users;', dirty: false }]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [activeSidebar, setActiveSidebar] = useState('db');
  const [showAI, setShowAI] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [schema, setSchema] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');

  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(280);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const fetchSchemaData = useCallback(async () => {
    try {
      const result = await getSchema();
      setSchema(result.tables || []);
    } catch (err) { console.error('Schema error:', err); }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
      if (connected) fetchSchemaData();
    }
  }, [user, connected, fetchHistory, fetchSchemaData]);

  const updateSQL = (id, value) => {
    setTabs(tabs.map(t => t.id === id ? { ...t, sql: value, dirty: true } : t));
  };

  const handleRun = async (sqlOverride = null) => {
    const queryToRun = sqlOverride || activeTab?.sql;
    if (!queryToRun?.trim()) return;
    try {
      await executeQuery(queryToRun);
      setConnected(true);
      fetchSchemaData();
    } catch (err) {
      if (err.message?.toLowerCase().includes('no active connection')) setConnected(false);
    }
  };

  const handleTableClick = (tableName) => {
    const query = `SELECT * FROM ${tableName} LIMIT 100;`;
    updateSQL(activeTabId, query);
    handleRun(query);
  };

  const handleAISuggest = async () => {
    if (!aiPrompt) return;
    try {
      const res = await suggestQuery(aiPrompt);
      setAiResult(res.sql);
    } catch (err) { alert(err.message); }
  };

  const startResizingSidebar = (e) => {
    e.preventDefault();
    const onMouseMove = (m) => setSidebarWidth(Math.max(150, Math.min(600, m.pageX - 48)));
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingBottom = (e) => {
    e.preventDefault();
    const onMouseMove = (m) => setBottomPanelHeight(Math.max(100, Math.min(600, window.innerHeight - m.pageY - 22)));
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (authLoading) return <div className="app-container flex-center">Initializing...</div>;
  if (!user) return <LoginView />;

  return (
    <div className="app-container">
      {/* Title Bar */}
      <div className="title-bar">
        <div className="title-bar-content">
          <div className="menu-item">File</div><div className="menu-item">Edit</div><div className="menu-item">View</div><div className="menu-item">Help</div>
          <div style={{ flex: 1, textAlign: 'center', color: '#969696', fontSize: '11px' }}>{activeTab?.title} - InfraDB</div>
          <div className={`dot ${connected ? 'dot-green' : 'dot-red'}`} style={{marginRight: '10px'}} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="toolbar-btn" onClick={() => setIsConnectModalOpen(true)}><VscLink /> Connect</button>
        <button className="toolbar-btn btn-run" onClick={() => handleRun()} disabled={dbLoading}><VscPlay /> Run</button>
        <button className="toolbar-btn" onClick={async () => { await loadSampleDB(); setConnected(true); fetchSchemaData(); }}><VscBeaker /> Sample DB</button>
        <button className="toolbar-btn" style={{color: '#e2b342'}} onClick={() => setShowAI(!showAI)}><VscLayoutSidebarRight /> AI Copilot</button>
        <button className="toolbar-btn" style={{marginLeft: 'auto'}} onClick={logout}><VscAccount /> Logout</button>
      </div>

      <div className="workbench">
        <div className="activity-bar">
          <div className={`activity-icon ${activeSidebar === 'db' ? 'active' : ''}`} onClick={() => setActiveSidebar('db')}><VscDatabase /></div>
          <div className={`activity-icon ${activeSidebar === 'history' ? 'active' : ''}`} onClick={() => setActiveSidebar('history')}><VscHistory /></div>
          <div className="activity-icon" style={{marginTop: 'auto'}}><VscSettingsGear /></div>
        </div>

        <div className="sidebar" style={{ width: sidebarWidth }}>
          <div className="sidebar-header">{activeSidebar === 'db' ? 'Explorer' : 'History'}</div>
          <div className="sidebar-content scrollbar">
            {activeSidebar === 'db' ? (
              <div>
                <div className="explorer-db-item" style={{fontWeight: 'bold', color: '#fff'}}>
                  <VscChevronDown /> <VscDatabase color="#007acc" size={14} /> CURRENT DATABASE
                </div>
                <div style={{paddingTop: '5px'}}>
                  {schema.map((t, i) => (
                    <TableNode key={i} table={t} onTableClick={handleTableClick} />
                  ))}
                </div>
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="explorer-db-item" onClick={() => updateSQL(activeTabId, h.query)}>
                  <VscCode size={12}/> <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{h.query}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="resizer-x" onMouseDown={startResizingSidebar} />

        <div className="main-area">
          <div className="editor-container">
            <div className="tab-bar">
              {tabs.map(t => (
                <div key={t.id} className={`tab ${t.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(t.id)}>
                  <VscCode color="#4fb6cc" size={14}/> {t.title}
                  <VscClose size={14} style={{marginLeft: '10px'}} onClick={(e) => { e.stopPropagation(); if (tabs.length > 1) setTabs(tabs.filter(tab => tab.id !== t.id)); }} />
                </div>
              ))}
              <div className="tab-plus" onClick={() => setTabs([...tabs, { id: String(Date.now()), title: 'new.sql', sql: '', dirty: false }])}><VscAdd /></div>
            </div>
            <textarea className="sql-editor" value={activeTab?.sql} onChange={(e) => updateSQL(activeTabId, e.target.value)} spellCheck="false" placeholder="-- SQL Editor" />
          </div>

          <div className="bottom-panel" style={{ height: bottomPanelHeight }}>
            <div className="resizer-y" onMouseDown={startResizingBottom} />
            <div className="panel-tabs"><div className="panel-tab active">RESULTS</div></div>
            <div className="panel-content scrollbar">
               <div className="results-container">
                 {results?.results?.map((res, i) => (
                   <div key={i} className="result-block">
                     <div style={{fontSize: '11px', color: '#89d185', marginBottom: '8px'}}><VscSymbolMethod /> {res.message}</div>
                     <div className="data-table-wrapper">
                       <table className="data-table">
                         <thead><tr>{res.columns?.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
                         <tbody>{res.rows?.map((r, j) => <tr key={j}>{r.map((cell, k) => <td key={k}>{cell === null ? 'NULL' : String(cell)}</td>)}</tr>)}</tbody>
                       </table>
                     </div>
                   </div>
                 )) || <div style={{padding: '20px', color: '#666'}}>Ready.</div>}
               </div>
            </div>
          </div>
        </div>

        {showAI && (
          <div className="ai-panel" style={{ width: 300 }}>
            <div className="sidebar-header">AI Assistant</div>
            <div className="panel-content scrollbar" style={{padding: '15px'}}>
               <textarea className="form-input" style={{height: '100px', resize: 'none'}} placeholder="Describe your query..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
               <button className="btn-primary full-width" style={{marginTop: '10px'}} onClick={handleAISuggest}>Generate</button>
               {aiResult && <div style={{marginTop: '15px', padding: '10px', background: '#1e1e1e', border: '1px solid #454545'}}>{aiResult}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="status-bar">
        <div className="status-item"><VscRemoteExplorer /> <span>Render Cloud</span></div>
        <div className="status-item"><span>UTF-8</span><span>SQL</span></div>
      </div>

      <ConnectionDialog isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} onConnect={() => setConnected(true)} />
    </div>
  );
}
