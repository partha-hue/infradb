import React from 'react';
import { 
  Database, 
  Layers, 
  Activity, 
  Settings, 
  ChevronDown, 
  Plus, 
  Command,
  Search,
  Code2,
  Box,
  Cpu,
  History
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';

const NavItem = ({ icon: Icon, label, active, badge, onClick }) => (
  <div 
    onClick={onClick}
    className={`group flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-all ${
      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
    }`}
  >
    <div className="flex items-center gap-2.5">
      <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'}`} />
      <span className="text-sm font-medium">{label}</span>
    </div>
    {badge && (
      <span className="bg-accent/10 text-accent text-[10px] px-1.5 py-0.5 rounded font-mono">
        {badge}
      </span>
    )}
  </div>
);

export const Sidebar = () => {
  const { instances, activeInstanceId, setActiveInstanceId } = useEditor();

  return (
    <aside className="w-64 bg-sidebar flex flex-col h-full border-r border-border select-none">
      <div className="h-12 flex items-center px-4 gap-2 border-b border-border">
        <div className="w-6 h-6 bg-accent rounded flex items-center justify-center">
          <Box className="w-4 h-4 text-accent-foreground" />
        </div>
        <span className="font-bold tracking-tight text-sm">InfraDB <span className="text-muted-foreground font-normal">v3.0</span></span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        {/* Connection Selector */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Workspace
            <Plus className="w-3 h-3 hover:text-foreground cursor-pointer" />
          </div>
          <div className="space-y-0.5">
            {instances.map(inst => (
              <NavItem 
                key={inst.id}
                icon={Database}
                label={inst.name}
                active={activeInstanceId === inst.id}
                onClick={() => setActiveInstanceId(inst.id)}
              />
            ))}
          </div>
        </div>

        {/* Navigation Groups */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Engineering
          </div>
          <div className="space-y-0.5">
            <NavItem icon={Code2} label="SQL Workbench" active badge="PRO" />
            <NavItem icon={Layers} label="Schema Explorer" />
            <NavItem icon={Activity} label="Performance" />
            <NavItem icon={History} label="Migration Logs" />
          </div>
        </div>

        {/* System Health */}
        <div className="px-3">
          <div className="p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Infra-Kernel</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Latency</span>
                <span className="text-accent font-mono">0.45ms</span>
              </div>
              <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                <div className="bg-accent h-full w-[15%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-2 border-t border-border">
        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-accent to-emerald-300" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">Engineer Admin</p>
            <p className="text-[10px] text-muted-foreground">Pro Plan</p>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
};
