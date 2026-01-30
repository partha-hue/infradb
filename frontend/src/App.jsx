import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VscDatabase, VscHistory, VscSearch, VscSettingsGear, VscPlay, 
  VscAdd, VscClose, VscChevronRight, VscChevronDown, 
  VscSymbolMethod, VscTerminal, VscLayoutSidebarRightOff, VscLayoutSidebarRight,
  VscAccount, VscDebugConsole, VscCode, VscFeedback, VscBeaker,
  VscFolderOpened, VscRemoteExplorer, VscSourceControl, VscLink
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
      if (dbType === 'mysql' && !payload.port) payload.port = 3306;
      if (dbType === 'postgresql' && !payload.port) payload.port = 5432;
      
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
        <div className="ai-header" style={{marginBottom: '20px'}}>
          <span>CONNECT TO DATABASE</span>
          <VscClose style={{cursor: 'pointer'}} onClick={onClose} />
        </div>
        
        <div className="form-group">
          <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>DATABASE TYPE</label>
          <select 
            className="form-input" 
            style={{background: '#3c3c3c'}}
            value={dbType} 
            onChange={(e) => setDbType(e.target.value)}
          >
            <option value="sqlite">SQLite (Local)</option>
            <option value="mysql">MySQL (Cloud/Remote)</option>
            <option value="postgresql">PostgreSQL (Cloud/Remote)</option>
          </select>
        </div>

        {dbType === 'sqlite' ? (
          <div className="form-group">
            <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>DATABASE FILE</label>
            <input 
              className="form-input" 
              value={config.database} 
              onChange={e => setConfig({...config, database: e.target.value})} 
            />
          </div>
        ) : (
          <>
            <div className="flex-row gap-10">
              <div className="form-group" style={{flex: 2}}>
                <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>HOST</label>
                <input className="form-input" value={config.host} onChange={e => setConfig({...config, host: e.target.value})} />
              </div>
              <div className="form-group" style={{flex: 1}}>
                <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>PORT</label>
                <input className="form-input" placeholder={dbType === 'mysql' ? '3306' : '5432'} value={config.port} onChange={e => setConfig({...config, port: e.target.value})} />
              </div>
            </div>
            <div className="flex-row gap-10">
              <div className="form-group" style={{flex: 1}}>
                <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>USER</label>
                <input className="form-input" value={config.user} onChange={e => setConfig({...config, user: e.target.value})} />
              </div>
              <div className="form-group" style={{flex: 1}}>
                <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>PASSWORD</label>
                <input className="form-input" type="password" value={config.password} onChange={e => setConfig({...config, password: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{color: '#969696', fontSize: '11px'}}>DATABASE NAME</label>
              <input className="form-input" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} />
            </div>
          </>
        )}

        {error && <div style={{color: '#f48771', fontSize: '12px', marginBottom: '15px'}}>{error}</div>}
        
        <div className="flex-row justify-between mt-10">
          <button className="btn-vscode" style={{background: '#3a3d41'}} onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConnect} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
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
        <div className="form-group">
          <input className="form-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="form-group">
          <input className="form-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="error-message" style={{color: '#f48771', fontSize: '12px', marginTop: '10px'}}>{error}</div>}
        <button className="btn-primary full-width" style={{marginTop: '20px', padding: '8px'}} onClick={async () => {
          try { await login({ username, password }); } catch (err) { setError(err.message); }
        }}>Sign In</button>
      </div>
    </div>
  );
}

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

  // Resizable States
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(280);
  const [aiPanelWidth, setAiPanelWidth] = useState(320);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const fetchSchemaData = useCallback(async () => {
    try {
      const result = await getSchema();
      setSchema(result.tables || []);
    } catch (err) {
      console.error('Schema error:', err);
    }
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

  const handleRun = async () => {
    if (!activeTab?.sql.trim()) return;
    try {
      await executeQuery(activeTab.sql);
      setConnected(true);
      if (activeTab.sql.toLowerCase().includes('create') || activeTab.sql.toLowerCase().includes('drop') || activeTab.sql.toLowerCase().includes('alter')) {
        fetchSchemaData();
      }
    } catch (err) {
      if (err.message.toLowerCase().includes('no active connection')) setConnected(false);
    }
  };

  const handleAISuggest = async () => {
    if (!aiPrompt) return;
    try {
      const res = await suggestQuery(aiPrompt);
      setAiResult(res.sql);
    } catch (err) { alert(err.message); }
  };

  const handleSampleDB = async () => {
    try {
      await loadSampleDB();
      setConnected(true);
      await fetchSchemaData();
      await fetchHistory();
    } catch (err) { alert(err.message); }
  };

  const onConnectSuccess = () => {
    setConnected(true);
    fetchSchemaData();
    fetchHistory();
  };

  const addTab = (sql = '', title = '') => {
    const newId = String(Date.now());
    setTabs([...tabs, { id: newId, title: title || `query${tabs.length + 1}.sql`, sql, dirty: false }]);
    setActiveTabId(newId);
  };

  // RESIZING LOGIC
  const startResizingSidebar = (e) => {
    e.preventDefault();
    const onMouseMove = (moveEvent) => {
      setSidebarWidth(Math.max(150, Math.min(600, moveEvent.pageX - 48)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingBottom = (e) => {
    e.preventDefault();
    const onMouseMove = (moveEvent) => {
      const newHeight = window.innerHeight - moveEvent.pageY - 22;
      setBottomPanelHeight(Math.max(100, Math.min(600, newHeight)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingAI = (e) => {
    e.preventDefault();
    const onMouseMove = (moveEvent) => {
      const newWidth = window.innerWidth - moveEvent.pageX;
      setAiPanelWidth(Math.max(200, Math.min(600, newWidth)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (authLoading) return <div className="app-container flex-center" style={{color: '#969696'}}>Initializing InfraDB...</div>;
  if (!user) return <LoginView />;

  return (
    <div className="app-container">
      {/* VS Code Unified Title Bar */}
      <div className="title-bar">
        <div className="title-bar-content">
          <div className="menu-item">File</div>
          <div className="menu-item">Edit</div>
          <div className="menu-item">Selection</div>
          <div className="menu-item">View</div>
          <div className="menu-item">Go</div>
          <div className="menu-item">Run</div>
          <div className="menu-item">Terminal</div>
          <div className="menu-item">Help</div>
          <div style={{ flex: 1, textAlign: 'center', pointerEvents: 'none', color: '#969696', fontSize: '11px' }}>
            {activeTab?.title} - InfraDB Desktop
          </div>
          <div className="status-item" style={{marginRight: '110px'}}>
             <div className={`dot ${connected ? 'dot-green' : 'dot-red'}`} />
             <span style={{fontSize: '11px', color: connected ? '#89d185' : '#f48771'}}>
               {connected ? 'Connected' : 'Disconnected'}
             </span>
          </div>
        </div>
      </div>

      {/* Main Toolbar */}
      <div className="toolbar">
        <button className="toolbar-btn" onClick={() => setIsConnectModalOpen(true)} title="Connect to Database">
          <VscLink /> Connect
        </button>
        <button className="toolbar-btn btn-run" onClick={handleRun} disabled={dbLoading} title="Execute Query (Ctrl+Enter)">
          <VscPlay /> Run
        </button>
        <button className="toolbar-btn btn-sample" onClick={handleSampleDB} title="Load Demo Data">
          <VscBeaker /> Sample DB
        </button>
        <button className="toolbar-btn btn-ai" onClick={() => setShowAI(!showAI)}>
          {showAI ? <VscLayoutSidebarRight /> : <VscLayoutSidebarRightOff />} AI Copilot
        </button>
        <div style={{marginLeft: 'auto', display: 'flex', gap: '10px', paddingRight: '10px'}}>
           <button className="toolbar-btn" onClick={logout} title="Sign Out"><VscAccount /> Logout</button>
        </div>
      </div>

      <div className="workbench">
        {/* Activity Bar */}
        <div className="activity-bar">
          <div className={`activity-icon ${activeSidebar === 'db' ? 'active' : ''}`} onClick={() => setActiveSidebar('db')} title="Explorer">
            <VscDatabase />
          </div>
          <div className={`activity-icon ${activeSidebar === 'history' ? 'active' : ''}`} onClick={() => setActiveSidebar('history')} title="History">
            <VscHistory />
          </div>
          <div className={`activity-icon ${activeSidebar === 'search' ? 'active' : ''}`} onClick={() => setActiveSidebar('search')} title="Search">
            <VscSearch />
          </div>
          <div className="activity-icon" title="Source Control"><VscSourceControl /></div>
          <div className="activity-icon" title="Remote Explorer"><VscRemoteExplorer /></div>
          <div style={{marginTop: 'auto'}}>
            <div className="activity-icon" title="Settings"><VscSettingsGear /></div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar" style={{ width: sidebarWidth }}>
          <div className="sidebar-header">
            {activeSidebar === 'db' ? 'EXPLORER: DATABASE' : 'TIMELINE: HISTORY'}
          </div>
          <div className="sidebar-content scrollbar">
            {activeSidebar === 'db' ? (
              <div className="explorer-db-section">
                <div className="explorer-db-item" style={{fontWeight: 'bold', color: '#fff'}}>
                  <VscChevronDown /> <VscFolderOpened color="#007acc" /> CURRENT DATABASE
                </div>
                <div className="explorer-table-list">
                  {schema.length > 0 ? schema.map((t, i) => (
                    <div key={i} className="explorer-db-item" title={t.name}>
                      <VscChevronRight size={12}/> <VscSymbolMethod size={14} color="#4fb6cc"/> {t.name}
                    </div>
                  )) : (
                    <div style={{padding: '10px 25px', fontSize: '11px', color: '#666', fontStyle: 'italic'}}>
                      No tables found. Click 'Connect' or 'Sample DB'.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="explorer-db-item" onClick={() => addTab(h.query, 'history.sql')} title={h.query}>
                  <VscCode size={12} style={{minWidth: '12px'}}/> 
                  <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px'}}>
                    {h.query}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Resizer */}
        <div className="resizer-x" onMouseDown={startResizingSidebar} />

        {/* Main Editor Area */}
        <div className="main-area">
          <div className="editor-container">
            <div className="tab-bar">
              {tabs.map(t => (
                <div key={t.id} className={`tab ${t.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(t.id)}>
                  <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <VscCode color="#4fb6cc" size={14}/> {t.title}
                  </span>
                  {t.dirty && <span style={{color: '#f48771', fontSize: '10px', marginLeft: '5px'}}>●</span>}
                  <div className="tab-close" onClick={(e) => { 
                    e.stopPropagation(); 
                    if (tabs.length > 1) setTabs(tabs.filter(tab => tab.id !== t.id)); 
                  }}>
                    <VscClose size={14}/>
                  </div>
                </div>
              ))}
              <div className="tab-plus" onClick={() => addTab()}><VscAdd /></div>
            </div>
            <div className="sql-viewport">
              <textarea 
                className="sql-editor" 
                value={activeTab?.sql || ''} 
                onChange={(e) => updateSQL(activeTabId, e.target.value)}
                spellCheck="false"
                placeholder="-- Write your SQL query here..."
              />
            </div>
          </div>

          {/* Bottom Panel */}
          <div className="bottom-panel" style={{ height: bottomPanelHeight }}>
            <div className="resizer-y" onMouseDown={startResizingBottom} />
            <div className="panel-tabs">
              <div className="panel-tab active">RESULTS</div>
              <div className="panel-tab">OUTPUT</div>
              <div className="panel-tab">DEBUG CONSOLE <VscDebugConsole style={{marginLeft: '4px', verticalAlign: 'middle'}}/></div>
              <div className="panel-tab">TERMINAL <VscTerminal style={{marginLeft: '4px', verticalAlign: 'middle'}}/></div>
            </div>
            <div className="panel-content scrollbar">
               <div className="results-container">
                 {dbError ? (
                   <div style={{color: '#f48771', fontSize: '13px', padding: '10px', border: '1px solid #454545', background: '#252526'}}>
                     Error: {dbError}
                   </div>
                 ) : (
                   results?.results?.map((res, i) => (
                     <div key={i} style={{marginBottom: '20px'}}>
                       <div style={{fontSize: '11px', color: '#89d185', marginBottom: '8px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px'}}>
                         <VscSymbolMethod size={12}/> {res.message} 
                         {res.rows && <span style={{color: '#969696'}}>• {res.rows.length} rows returned</span>}
                       </div>
                       {res.columns && res.columns.length > 0 && (
                         <div style={{overflowX: 'auto'}}>
                           <table className="data-table">
                             <thead>
                               <tr>{res.columns.map((c, j) => <th key={j}>{c}</th>)}</tr>
                             </thead>
                             <tbody>
                               {res.rows.slice(0, 500).map((r, j) => (
                                 <tr key={j}>{r.map((cell, k) => <td key={k}>{cell === null ? 'NULL' : String(cell)}</td>)}</tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                       )}
                     </div>
                   )) || <div style={{color: '#666', fontSize: '12px', padding: '10px'}}>No active query results. Execute a query to see data.</div>
                 )}
               </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        {showAI && (
          <>
            <div className="resizer-x" onMouseDown={startResizingAI} />
            <div className="ai-panel" style={{ width: aiPanelWidth }}>
              <div className="ai-header">
                AI ASSISTANT <VscClose style={{cursor: 'pointer'}} onClick={() => setShowAI(false)} />
              </div>
              <div className="ai-content scrollbar">
                 <div style={{fontSize: '12px', color: '#858585', marginBottom: '15px', lineHeight: '1.5'}}>
                   <VscFeedback color="#e2b342"/> Describe the database operation. The AI will generate the SQL query for you.
                 </div>
                 
                 <div className="ai-chat-bubble">
                   <div style={{fontSize: '11px', color: '#969696', marginBottom: '10px'}}>How can I help you today?</div>
                   <textarea 
                     className="ai-textarea" 
                     placeholder="e.g. Find all users who live in New York..."
                     value={aiPrompt}
                     onChange={e => setAiPrompt(e.target.value)}
                   />
                   <button className="btn-primary full-width mt-10" onClick={handleAISuggest}>
                     Generate SQL
                   </button>
                 </div>

                 {aiResult && (
                   <div style={{marginTop: '20px', borderTop: '1px solid #454545', paddingTop: '15px'}}>
                      <div style={{fontSize: '10px', color: '#e2b342', marginBottom: '10px', fontWeight: 'bold'}}>SUGGESTED SQL:</div>
                      <div style={{background: '#1e1e1e', padding: '10px', border: '1px solid #454545', fontFamily: 'Consolas, monospace', fontSize: '12px', wordBreak: 'break-all', color: '#d4d4d4'}}>
                        {aiResult}
                      </div>
                      <button 
                        className="btn-primary full-width" 
                        style={{marginTop: '10px', background: '#37373d'}}
                        onClick={() => updateSQL(activeTabId, aiResult)}
                      >
                        Insert into Editor
                      </button>
                   </div>
                 )}
              </div>
            </div>
          </>
        )}
      </div>

      <ConnectionDialog 
        isOpen={isConnectModalOpen} 
        onClose={() => setIsConnectModalOpen(false)} 
        onConnect={onConnectSuccess} 
      />

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <VscRemoteExplorer /> <span>Render Cloud</span>
        </div>
        <div className="status-item">
          <span>UTF-8</span>
          <span>SQL</span>
          <VscFeedback />
        </div>
      </div>
    </div>
  );
}
