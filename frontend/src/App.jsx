import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VscDatabase, VscHistory, VscSearch, VscSettingsGear, VscPlay, 
  VscAdd, VscClose, VscChevronRight, VscChevronDown, 
  VscSymbolMethod, VscTerminal, VscLayoutSidebarRightOff, VscLayoutSidebarRight,
  VscAccount, VscDebugConsole, VscCode, VscFeedback, VscBeaker,
  VscFolderOpened, VscRemoteExplorer, VscSourceControl, VscLink,
  VscKey, VscTable, VscLayers, VscRefresh, VscSymbolField, VscInfo, VscServer, VscShield,
  VscEdit, VscJson, VscCheck, VscQuestion, VscSave, VscFolder, VscExport, VscFileMedia,
  VscArrowRight, VscGoToFile, VscLock, VscUnlock
} from "react-icons/vsc";
import Editor, { loader } from "@monaco-editor/react";
import { connectDB, getSchema, suggestQuery, loadSampleDB, getSystemInfo, importFile, exportData } from './api/dbService';
import { useAuth } from './hooks/useAuth';
import { useEditor } from './context/EditorContext';
import './styles.css';

// Pre-configure Monaco to load faster
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs' } });

// --- COMPONENTS ---

const FolderNode = ({ label, icon, children }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="tree-node">
      <div className="tree-item" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <VscChevronDown size={14}/> : <VscChevronRight size={14}/>}
        {icon} <span className="tree-label">{label}</span>
      </div>
      {isOpen && <div className="tree-children">{children}</div>}
    </div>
  );
};

const TreeItem = ({ item, type, onContextMenu, onAction }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div key={item.name} className="tree-node">
      <div 
        className="tree-item" 
        onClick={() => setExpanded(!expanded)} 
        onContextMenu={(e) => onContextMenu(e, type, item)}
        onDoubleClick={() => type === 'table' && onAction(item.name)}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: '6px', flex: 1}}>
          {expanded ? <VscChevronDown size={14}/> : <VscChevronRight size={14}/>}
          {type === 'table' ? <VscTable color="#4fb6cc" size={14}/> : <VscLayers color="#cca700" size={14}/>}
          <span className="tree-label">{item.name}</span>
        </div>
      </div>
      {expanded && (
        <div className="tree-children">
          {(item.columns || []).map((col, i) => (
            <div key={i} className="tree-item leaf">
              <div style={{width: '16px'}}/>
              {col.pk ? <VscKey size={12} color="#cca700"/> : <VscSymbolField size={12} color="#858585"/>}
              <span className="tree-label-sub">{col.name} <span className="type-tag">{col.type}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ContextMenu = ({ x, y, options, onClose }) => {
  useEffect(() => {
    const handleOutsideClick = () => onClose();
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [onClose]);

  return (
    <div className="context-menu" style={{ top: y, left: x }}>
      {options.map((opt, i) => (
        <div key={i} className="context-menu-item" onClick={opt.action}>
          {opt.icon} <span>{opt.label}</span>
        </div>
      ))}
    </div>
  );
};

function ImportModal({ isOpen, onClose, onImported, addTab, executeSQL }) {
  const [file, setFile] = useState(null);
  const [tableName, setTableName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!file || !tableName) return;
    setLoading(true);
    setError('');
    try {
      await importFile(file, tableName);
      // Refresh tree
      await onImported();
      
      // Auto show in tab and execute
      const sql = `SELECT * FROM \`${tableName}\` LIMIT 100;`;
      addTab(sql, `${tableName}.sql`);
      setTimeout(() => executeSQL(sql), 500);
      
      onClose();
    } catch (err) { 
      setError(err.response?.data?.error || err.message || 'Import failed'); 
    }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', padding: '0 0 15px 0'}}>
          <span>IMPORT DATA (CSV/Excel/JSON)</span>
          <VscClose style={{cursor: 'pointer'}} onClick={onClose} />
        </div>
        <div className="form-group">
          <label className="form-label">Table Name</label>
          <input className="form-input" value={tableName} onChange={e => setTableName(e.target.value)} placeholder="e.g. churn_data" />
        </div>
        <div className="form-group">
          <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={e => {
            const f = e.target.files[0];
            setFile(f);
            if (f && !tableName) {
              const name = f.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
              setTableName(name);
            }
          }} />
        </div>
        {error && <div className="error-text" style={{maxHeight: '100px', overflow: 'auto'}}>{error}</div>}
        <button className="btn-primary full-width" style={{marginTop: '10px'}} onClick={handleImport} disabled={loading || !file || !tableName}>
          {loading ? 'Importing...' : 'Import & Open'}
        </button>
      </div>
    </div>
  );
}

function ConnectionDialog({ isOpen, onClose, onConnect }) {
  const [dbType, setDbType] = useState('sqlite');
  const [config, setConfig] = useState({ database: 'default.db', host: 'localhost', port: '', user: 'root', password: '' });
  const [isProduction, setIsProduction] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      await connectDB({ ...config, db_type: dbType, is_production: isProduction });
      onConnect(isProduction);
      onClose();
    } catch (err) { setError(err.message || 'Connection failed'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', padding: '0 0 15px 0'}}>
          <span>CONNECT TO DATABASE</span>
          <VscClose style={{cursor: 'pointer'}} onClick={onClose} />
        </div>
        <div className="form-group">
          <label className="form-label">DATABASE TYPE</label>
          <select className="form-input" value={dbType} onChange={(e) => setDbType(e.target.value)}>
            <option value="sqlite">SQLite (Local)</option>
            <option value="mysql">MySQL (Remote)</option>
            <option value="postgresql">PostgreSQL (Remote)</option>
          </select>
        </div>
        <div className="flex-col gap-10">
          {dbType === 'sqlite' ? (
            <input className="form-input" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} placeholder="Database File"/>
          ) : (
            <>
              <div style={{display: 'flex', gap: '10px'}}>
                <input className="form-input" style={{flex: 3}} placeholder="Host" value={config.host} onChange={e => setConfig({...config, host: e.target.value})} />
                <input className="form-input" style={{flex: 1}} placeholder="Port" value={config.port} onChange={e => setConfig({...config, port: e.target.value})} />
              </div>
              <input className="form-input" placeholder="Database Name" value={config.database} onChange={e => setConfig({...config, database: e.target.value})} />
              <input className="form-input" placeholder="Username" value={config.user} onChange={e => setConfig({...config, user: e.target.value})} />
              <input className="form-input" type="password" placeholder="Password" value={config.password} onChange={e => setConfig({...config, password: e.target.value})} />
            </>
          )}
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px'}}>
            <input type="checkbox" id="is_prod" checked={isProduction} onChange={e => setIsProduction(e.target.checked)} />
            <label htmlFor="is_prod" style={{fontSize: '12px', color: '#f48771', fontWeight: 'bold'}}>Production Mode (Enable Guardian)</label>
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn-primary full-width" style={{marginTop: '20px'}} onClick={handleConnect} disabled={loading}>{loading ? 'Connecting...' : 'Connect'}</button>
      </div>
    </div>
  );
}

function AIPanel() {
  const { activeTab, updateSQL, activeTabId } = useEditor();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [history]);

  const handleAction = async (action, customPrompt = null) => {
    const finalPrompt = customPrompt || prompt;
    const messageToSend = finalPrompt.trim() || (action === 'fix' ? 'Fix this query' : action === 'explain' ? 'Explain this query' : 'Generate query');
    
    setLoading(true);
    setHistory(prev => [...prev, { role: 'user', content: messageToSend, action }]);
    try {
      const result = await suggestQuery(messageToSend, action, activeTab?.sql);
      setHistory(prev => [...prev, { 
        role: 'ai', 
        content: result.text, 
        sql: result.sql,
        action 
      }]);
      setPrompt('');
    } catch (err) {
      setHistory(prev => [...prev, { role: 'ai', content: 'Error: ' + err.message, isError: true }]);
    } finally { setLoading(false); }
  };

  const renderContent = (content, msgSql) => {
    // If we have msgSql specifically, use it
    if (msgSql) {
      return (
        <>
          <div style={{whiteSpace: 'pre-wrap'}}>{content}</div>
          <div className="ai-code-block">
            <div className="code-header">
              <span>SQL</span>
              <button onClick={() => updateSQL(activeTabId, msgSql)}><VscGoToFile /> Apply</button>
            </div>
            <pre><code>{msgSql}</code></pre>
          </div>
        </>
      );
    }

    // Otherwise, parse content for markdown code blocks
    const parts = content.split(/```sql|```/g);
    return parts.map((part, i) => {
      // Every odd index is content inside ```sql ... ```
      if (i % 2 === 1) {
        const sqlCode = part.trim();
        return (
          <div key={i} className="ai-code-block">
            <div className="code-header">
              <span>SQL</span>
              <button onClick={() => updateSQL(activeTabId, sqlCode)}><VscGoToFile /> Apply</button>
            </div>
            <pre><code>{sqlCode}</code></pre>
          </div>
        );
      }
      return <div key={i} style={{whiteSpace: 'pre-wrap'}}>{part}</div>;
    });
  };

  return (
    <div className="ai-agent-panel">
      <div className="sidebar-header" style={{borderBottom: '1px solid var(--border)', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '8px'}}>
        <VscBeaker color="var(--accent)" size={18}/> AI ASSISTANT
      </div>
      <div className="ai-chat-history scrollbar">
        {history.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            <div className="chat-role">{msg.role === 'user' ? 'YOU' : 'AI AGENT'}</div>
            <div className="chat-content">
               {msg.role === 'ai' ? renderContent(msg.content, msg.sql) : <div style={{whiteSpace: 'pre-wrap'}}>{msg.content}</div>}
            </div>
          </div>
        ))}
        {loading && <div className="chat-bubble ai"><div className="typing-indicator"><span></span><span></span><span></span></div></div>}
        <div ref={chatEndRef} />
      </div>
      <div className="ai-input-area">
        <div className="ai-actions-row">
          <button className="ai-action-btn" onClick={() => handleAction('fix')} disabled={loading} title="Fix Query"><VscCheck /> Fix</button>
          <button className="ai-action-btn" onClick={() => handleAction('explain')} disabled={loading} title="Explain Query"><VscQuestion /> Explain</button>
        </div>
        <div style={{position: 'relative'}}>
          <textarea className="ai-textarea" placeholder="Type a message..." value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAction('generate'))} />
          <button className="ai-send-btn" onClick={() => handleAction('generate')} disabled={loading || !prompt.trim()}><VscArrowRight size={18} /></button>
        </div>
      </div>
    </div>
  );
}

function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="modal-overlay" style={{backgroundColor: '#1e1e1e'}}>
      <div className="modal-content" style={{maxWidth: '320px', textAlign: 'center'}}>
        <VscAccount size={48} style={{color: '#007acc', marginBottom: '15px'}} />
        <h2 style={{color: '#fff', fontSize: '18px', marginBottom: '20px'}}>InfraDB Login</h2>
        <input className="form-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="form-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{marginTop: '10px'}} />
        {error && <div className="error-text">{error}</div>}
        <button className="btn-primary full-width" style={{marginTop: '20px'}} onClick={async () => {
          try { await login({ username, password }); } catch (err) { setError(err.message); }
        }}>Sign In</button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, logout, loading: authLoading } = useAuth();
  const { tabs, activeTabId, setActiveTabId, activeTab, updateSQL, executeSQL, results, loading: dbLoading, error: dbError, addTab, closeTab, settings } = useEditor();
  
  const [activeSidebar, setActiveSidebar] = useState('db');
  const [showAI, setShowAI] = useState(true);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  const [schemaData, setSchemaData] = useState({ tables: [], database_name: 'Disconnected' });
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [menu, setMenu] = useState(null);
  const [filterText, setFilterText] = useState('');

  const fetchSchemaData = useCallback(async () => {
    try {
      const result = await getSchema();
      setSchemaData(result || { tables: [] });
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { if (user && connected) fetchSchemaData(); }, [user, connected, fetchSchemaData]);

  const handleExport = (format) => {
    if (activeTab?.sql) exportData(activeTab.sql, format);
  };

  const handleTableAction = (tableName) => {
    const limit = settings?.dbms?.defaultLimit || 100;
    const sql = `SELECT * FROM \`${tableName}\` LIMIT ${limit};`;
    updateSQL(activeTabId, sql);
    executeSQL(sql);
  };

  const handleLocalFile = async (action) => {
    try {
      if (action === 'open') {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{ description: 'SQL Files', accept: { 'text/plain': ['.sql'] } }],
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        addTab(content, file.name);
      } else if (action === 'save' && activeTab) {
        const handle = await window.showSaveFilePicker({
          suggestedName: activeTab.title.endsWith('.sql') ? activeTab.title : `${activeTab.title}.sql`,
          types: [{ description: 'SQL File', accept: { 'text/plain': ['.sql'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(activeTab.sql);
        await writable.close();
      }
    } catch (err) { console.error("File access error:", err); }
  };

  const onContextMenu = (e, type, data) => {
    e.preventDefault();
    const options = [];
    if (type === 'table') {
      options.push({ label: 'Select Top 100', icon: <VscPlay color="#89d185"/>, action: () => handleTableAction(data.name) });
    } else if (type === 'db') {
      options.push({ label: 'New Query', icon: <VscAdd />, action: () => addTab() });
    }
    setMenu({ x: e.pageX, y: e.pageY, options });
  };

  const filteredTables = schemaData.tables.filter(t => t.name.toLowerCase().includes(filterText.toLowerCase()));

  if (authLoading) return <div className="app-container flex-center">Initializing...</div>;
  if (!user) return <LoginView />;

  return (
    <div className={`app-container ${isResizing ? 'resizing' : ''}`}>
      {isResizing && <div className="resize-overlay" />}
      
      <div className="title-bar">
        <div className="title-bar-content">
          <div className="menu-dropdown">
            <div className="menu-item">File</div>
            <div className="dropdown-content">
              <button onClick={() => addTab()}>New SQL File</button>
              <button onClick={() => handleLocalFile('open')}>Open Local File...</button>
              <button onClick={() => handleLocalFile('save')}>Save As...</button>
              <hr style={{border: '0.5px solid var(--border)', margin: '4px 0'}} />
              <button onClick={() => setIsImportModalOpen(true)}>Import Data...</button>
              <button onClick={() => setIsConnectModalOpen(true)}>Connect to DB...</button>
            </div>
          </div>
          <div className="menu-item">Edit</div>
          <div className="menu-item">View</div>
          
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
            <span style={{ color: '#969696', fontSize: '11px' }}>{activeTab?.title} - InfraDB</span>
            {connected && (
              <div className={`prod-badge ${isProduction ? 'active' : ''}`}>
                {isProduction ? <VscLock size={12} /> : <VscUnlock size={12} />}
                {isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
              </div>
            )}
          </div>
          
          <div className={`dot ${connected ? 'dot-green' : 'dot-red'}`} />
        </div>
      </div>

      <div className="toolbar">
        <button className="toolbar-btn" onClick={() => setIsConnectModalOpen(true)}><VscLink /> Connect</button>
        <button className="toolbar-btn btn-run" onClick={() => executeSQL()} disabled={dbLoading}><VscPlay /> Run</button>
        <button className="toolbar-btn" onClick={() => setIsImportModalOpen(true)}><VscFileMedia /> Import</button>
        <div className="toolbar-dropdown">
           <button className="toolbar-btn"><VscExport /> Export</button>
           <div className="dropdown-content">
              <button onClick={() => handleExport('csv')}>CSV</button>
              <button onClick={() => handleExport('excel')}>Excel</button>
              <button onClick={() => handleExport('json')}>JSON</button>
           </div>
        </div>
        <button className="toolbar-btn" style={{color: showAI ? 'var(--accent)' : '#e2b342'}} onClick={() => setShowAI(!showAI)}><VscBeaker /> AI Assistant</button>
        <button className="toolbar-btn" style={{marginLeft: 'auto'}} onClick={logout}><VscAccount /> Logout</button>
      </div>

      <div className="workbench">
        <div className="activity-bar">
          <div className={`activity-icon ${activeSidebar === 'db' ? 'active' : ''}`} onClick={() => setActiveSidebar('db')}><VscDatabase size={24}/></div>
          <div className={`activity-icon ${activeSidebar === 'history' ? 'active' : ''}`} onClick={() => setActiveSidebar('history')}><VscHistory size={24}/></div>
          <div className="activity-icon" style={{marginTop: 'auto'}}><VscSettingsGear size={24}/></div>
        </div>

        <div className="sidebar" style={{ width: sidebarWidth }}>
          <div className="sidebar-header">{activeSidebar === 'db' ? 'Explorer' : 'History'}</div>
          {activeSidebar === 'db' && (
            <div className="sidebar-search">
              <input 
                className="search-input" 
                placeholder="Filter..." 
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
              />
            </div>
          )}
          <div className="sidebar-content scrollbar">
            {activeSidebar === 'db' && (
              <div className="tree-root">
                <div className="tree-item" style={{fontWeight: 'bold', color: '#fff'}} onContextMenu={(e) => onContextMenu(e, 'db')}>
                   <VscChevronDown /> <VscDatabase color="var(--accent)" size={14} /> {schemaData.database_name}
                </div>
                <div className="tree-indent">
                  <FolderNode label="Tables" icon={<VscFolderOpened color="#cca700"/>}>
                    {filteredTables.map(t => (
                      <TreeItem key={t.name} item={t} type="table" onContextMenu={onContextMenu} onAction={handleTableAction} />
                    ))}
                  </FolderNode>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="resizer-x" onMouseDown={(e) => {
          setIsResizing(true);
          const startX = e.pageX; const startWidth = sidebarWidth;
          const onMove = (m) => setSidebarWidth(Math.max(150, Math.min(600, startWidth + (m.pageX - startWidth))));
          const onUp = () => { setIsResizing(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        }} />

        <div className="main-area">
          <div className="editor-container">
            <div className="tab-bar">
              {tabs.map(t => (
                <div key={t.id} className={`tab ${t.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(t.id)}>
                  <VscCode color="#4fb6cc" size={14}/><span className="tab-label">{t.title}</span>
                  <VscClose size={14} className="tab-close-icon" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }} />
                </div>
              ))}
              <div className="tab-plus" onClick={() => addTab()}><VscAdd /></div>
            </div>
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme="vs-dark"
                value={activeTab?.sql || ''}
                loading={<div className="editor-placeholder">Loading Editor Engine...</div>}
                onChange={(val) => updateSQL(activeTabId, val)}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  lineNumbers: "on",
                  padding: { top: 10 }
                }}
              />
            </div>
          </div>

          <div className="resizer-y" onMouseDown={(e) => {
            setIsResizing(true);
            const startY = e.pageY; const startHeight = bottomPanelHeight;
            const onMove = (m) => setBottomPanelHeight(Math.max(100, Math.min(600, startHeight + (startY - m.pageY))));
            const onUp = () => { setIsResizing(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
            window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
          }} />

          <div className="bottom-panel" style={{ height: bottomPanelHeight, overflow: 'hidden' }}>
            <div className="panel-tabs"><div className="panel-tab">RESULTS</div></div>
            <div className="panel-content scrollbar" style={{flex: 1, overflow: 'auto'}}>
               <div className="results-container">
                 {dbError && <div className="error-banner">{dbError}</div>}
                 {results?.results?.map((res, i) => (
                   <div key={i} className="result-block">
                     <div className="result-message">
                       <VscCheck size={14} color="var(--success)"/> Returned {res.rows?.length || 0} rows
                     </div>
                     <div className="data-table-wrapper scrollbar">
                       <table className="data-table">
                         <thead><tr>{res.columns?.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
                         <tbody>{res.rows?.map((r, j) => <tr key={j}>{r.map((cell, k) => <td key={k}>{String(cell)}</td>)}</tr>)}</tbody>
                       </table>
                     </div>
                   </div>
                 )) || <div style={{padding: '20px', color: '#666'}}>Ready.</div>}
               </div>
            </div>
          </div>
        </div>

        {showAI && (
          <>
            <div className="resizer-x ai-resizer" onMouseDown={(e) => {
              setIsResizing(true);
              const startX = e.pageX; const startWidth = aiSidebarWidth;
              const onMove = (m) => setAiSidebarWidth(Math.max(250, Math.min(600, startWidth - (m.pageX - startX))));
              const onUp = () => { setIsResizing(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
              window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
            }} />
            <div className="ai-sidebar-container" style={{ width: aiSidebarWidth }}>
              <AIPanel />
            </div>
          </>
        )}
      </div>

      <div className="status-bar">
        <div className="status-item"><VscRemoteExplorer /> <span>{connected ? 'Connected' : 'Disconnected'}</span></div>
        <div className="status-item"><span>UTF-8</span><span>SQL</span></div>
      </div>

      <ConnectionDialog isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} onConnect={(prod) => { setConnected(true); setIsProduction(prod); fetchSchemaData(); }} />
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImported={fetchSchemaData}
        addTab={addTab}
        executeSQL={executeSQL}
      />
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
