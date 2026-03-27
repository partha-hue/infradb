import React from 'react';
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
    instances, 
    activeInstanceId, 
    setActiveInstanceId, 
    activeView, 
    setActiveView 
  } = useEditor();

  return (
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
            <Plus className="w-3 h-3 hover:text-foreground cursor-pointer transition-colors" />
          </div>
          <div className="space-y-0.5">
            {instances.map(inst => (
              <NavItem 
                key={inst.id}
                icon={Database}
                label={inst.name}
                active={activeInstanceId === inst.id}
                onClick={() => setActiveInstanceId(inst.id)}
                color={inst.id === 'inst-2' ? 'text-production' : 'text-development'}
              />
            ))}
          </div>
        </div>

        {/* Infrastructure */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">Infrastructure</div>
          <div className="space-y-0.5">
            <NavItem icon={Activity} label="Performance" />
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
  );
};
