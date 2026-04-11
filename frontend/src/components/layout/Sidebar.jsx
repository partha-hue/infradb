import React, { useMemo, useState } from 'react';
import { 
  Database, 
  Layers, 
  Activity, 
  Settings, 
  Plus, 
  Box,
  History,
  Shield,
  Terminal,
  Zap,
  Globe,
  Users,
  HardDrive,
  CloudLightning,
  ChevronDown
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';

const NavItem = ({ icon: Icon, label, active, badge, onClick, color }) => (
  <div 
    onClick={onClick}
    className={`group flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-all ${
      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
    }`}
  >
    <div className="flex items-center gap-2.5">
      <Icon className={`w-3.5 h-3.5 ${active ? (color || 'text-brand') : 'text-muted-foreground group-hover:text-foreground'}`} />
      <span className="text-xs font-medium">{label}</span>
    </div>
    {badge && (
      <span className="bg-brand/10 text-brand text-[9px] px-1.5 py-0.5 rounded font-bold border border-brand/20 uppercase tracking-tighter">
        {badge}
      </span>
    )}
  </div>
);

export const Sidebar = () => {
  const { 
    workspaces,
    instances, 
    activeInstanceId, 
    setActiveInstanceId, 
    activeView, 
    setActiveView,
    bootstrapping,
    createWorkspace,
    createConnection,
    loading,
  } = useEditor();
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [form, setForm] = useState({
    workspaceId: '',
    workspaceName: '',
    connectionName: '',
    databaseName: '',
    filePath: '',
  });

  const workspaceOptions = useMemo(
    () => (Array.isArray(workspaces) ? workspaces : []),
    [workspaces],
  );

  const openCreateConnection = () => {
    const firstWorkspace = workspaceOptions[0];
    setForm((prev) => ({
      ...prev,
      workspaceId: firstWorkspace?.id || '',
      workspaceName: '',
      connectionName: '',
      databaseName: '',
      filePath: '',
    }));
    setShowConnectionModal(true);
  };

  const submitCreateConnection = async (event) => {
    event.preventDefault();

    let workspaceId = form.workspaceId;
    if (!workspaceId && form.workspaceName.trim()) {
      const createdWorkspace = await createWorkspace(form.workspaceName.trim());
      workspaceId = createdWorkspace?.id || '';
    }

    if (!workspaceId) return;

    const created = await createConnection({
      workspaceId,
      name: form.connectionName.trim(),
      databaseName: form.databaseName.trim(),
      filePath: form.filePath.trim(),
      engine: 'SQLITE',
    });

    if (created) {
      setShowConnectionModal(false);
    }
  };

  return (
    <>
      <aside className="w-60 bg-sidebar flex flex-col h-full select-none">
        {/* Organization Header */}
        <div className="h-12 flex items-center px-4 border-b border-border group cursor-pointer hover:bg-muted/20 transition-colors">
          <div className="w-6 h-6 bg-brand rounded flex items-center justify-center shadow-lg shadow-brand/20">
            <Box className="w-3.5 h-3.5 text-background font-bold" />
          </div>
          <div className="ml-2 flex-1">
            <p className="text-xs font-bold tracking-tight">InfraDB <span className="text-muted-foreground font-normal">SaaS</span></p>
            <p className="text-[9px] text-muted-foreground flex items-center gap-1 font-mono uppercase tracking-tighter">
              Acme_Production <ChevronDown className="w-2 h-2" />
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-7 scrollbar-hide">
          {/* Workspace */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">Workspace</div>
            <div className="space-y-0.5">
              <NavItem 
                icon={Terminal} 
                label="SQL Editor" 
                active={activeView === 'editor'} 
                onClick={() => setActiveView('editor')} 
              />
              <NavItem 
                icon={Layers} 
                label="Schema Explorer" 
                active={activeView === 'schema'} 
                onClick={() => setActiveView('schema')} 
              />
              <NavItem 
                icon={History} 
                label="Query History" 
                active={activeView === 'history'} 
                onClick={() => setActiveView('history')} 
              />
              <NavItem 
                icon={Zap} 
                label="AI Insights" 
                badge="NEW" 
                active={activeView === 'insights'} 
                onClick={() => setActiveView('insights')} 
              />
            </div>
          </div>

          {/* Connections */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
              Databases
              <button type="button" onClick={openCreateConnection} className="hover:text-foreground cursor-pointer transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {bootstrapping ? (
                <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Loading...</div>
              ) : instances.length ? (
                instances.map(inst => (
                  <NavItem 
                    key={inst.id}
                    icon={Database}
                    label={inst.name}
                    active={activeInstanceId === inst.id}
                    onClick={() => setActiveInstanceId(inst.id)}
                    color={inst.engine === 'SQLITE' ? 'text-brand' : 'text-development'}
                  />
                ))
              ) : (
                <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">No connections</div>
              )}
            </div>
          </div>

          {/* Infrastructure */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">Infrastructure</div>
            <div className="space-y-0.5">
              <NavItem icon={Activity} label="Performance" onClick={() => setActiveView('insights')} />
              <NavItem icon={CloudLightning} label="Migrations" badge="4" />
              <NavItem icon={HardDrive} label="Backups" />
              <NavItem icon={Globe} label="Replication" />
            </div>
          </div>

          {/* Team */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">Governance</div>
            <div className="space-y-0.5">
              <NavItem icon={Users} label="Teams" />
              <NavItem icon={Shield} label="Access Control" />
              <NavItem icon={Settings} label="Settings" />
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer transition-all border border-transparent hover:border-border">
            <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-brand to-emerald-400 flex items-center justify-center text-[10px] font-bold text-background">
              PA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate tracking-tight">Partha Chakraborty</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-tighter">Pro Developer</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {showConnectionModal && (
        <div className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm flex items-center justify-center px-4">
          <form onSubmit={submitCreateConnection} className="w-full max-w-lg rounded-xl border border-border bg-sidebar shadow-2xl">
            <div className="px-5 py-4 border-b border-border text-sm font-bold uppercase tracking-widest">Create Connection</div>
            <div className="p-5 space-y-4">
              <label className="block">
                <div className="text-[11px] mb-1 text-muted-foreground">Workspace</div>
                <select
                  value={form.workspaceId}
                  onChange={(event) => setForm((prev) => ({ ...prev, workspaceId: event.target.value }))}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs"
                >
                  <option value="">Create new workspace below</option>
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>

              {!form.workspaceId && (
                <label className="block">
                  <div className="text-[11px] mb-1 text-muted-foreground">New Workspace Name</div>
                  <input
                    value={form.workspaceName}
                    onChange={(event) => setForm((prev) => ({ ...prev, workspaceName: event.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs"
                    placeholder="Analytics Team"
                  />
                </label>
              )}

              <label className="block">
                <div className="text-[11px] mb-1 text-muted-foreground">Connection Name</div>
                <input
                  required
                  value={form.connectionName}
                  onChange={(event) => setForm((prev) => ({ ...prev, connectionName: event.target.value }))}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs"
                  placeholder="Local SQLite"
                />
              </label>

              <label className="block">
                <div className="text-[11px] mb-1 text-muted-foreground">Database Name</div>
                <input
                  required
                  value={form.databaseName}
                  onChange={(event) => setForm((prev) => ({ ...prev, databaseName: event.target.value }))}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs"
                  placeholder="analytics"
                />
              </label>

              <label className="block">
                <div className="text-[11px] mb-1 text-muted-foreground">SQLite File Path</div>
                <input
                  required
                  value={form.filePath}
                  onChange={(event) => setForm((prev) => ({ ...prev, filePath: event.target.value }))}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs"
                  placeholder="backend/user_databases/test_db.sqlite3"
                />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button type="button" onClick={() => setShowConnectionModal(false)} className="px-3 py-2 text-xs rounded border border-border">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="px-3 py-2 text-xs rounded bg-accent text-accent-foreground font-bold disabled:opacity-60">
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
