import React from 'react';
import { 
  Wifi, 
  Cpu, 
  Database, 
  ShieldCheck, 
  Activity, 
  Clock, 
  Command,
  HelpCircle,
  Bell
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';

const StatusItem = ({ icon: Icon, label, color = "text-muted-foreground", animate = false }) => (
  <div className={`flex items-center gap-1.5 px-2 cursor-default border-r border-border h-full hover:bg-muted/30 transition-colors ${color}`}>
    <Icon className={`w-3 h-3 ${animate ? 'animate-pulse' : ''}`} />
    <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
  </div>
);

export const StatusBar = () => {
  const { loading, activeInstance } = useEditor();

  return (
    <footer className="h-6 bg-sidebar border-t border-border flex items-center justify-between select-none">
      <div className="flex items-center h-full">
        <StatusItem 
          icon={ShieldCheck} 
          label="Secure" 
          color="text-accent" 
        />
        <StatusItem 
          icon={Database} 
          label={activeInstance?.engine || 'No Engine'} 
        />
        <StatusItem 
          icon={Activity} 
          label="0.45ms" 
          color="text-emerald-400" 
        />
        {loading && (
          <StatusItem 
            icon={Clock} 
            label="Streaming Results..." 
            color="text-amber-400" 
            animate={true} 
          />
        )}
      </div>

      <div className="flex items-center h-full">
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-border hover:bg-muted/30 transition-colors">
          <Command className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Command Palette</span>
          <div className="flex items-center gap-0.5 ml-1">
            <kbd className="px-1 py-0 bg-muted rounded border border-border text-[9px] text-foreground font-sans uppercase">Ctrl</kbd>
            <kbd className="px-1 py-0 bg-muted rounded border border-border text-[9px] text-foreground font-sans uppercase">K</kbd>
          </div>
        </div>
        <StatusItem icon={Bell} label="" />
        <StatusItem icon={HelpCircle} label="" />
        <div className="px-3 flex items-center gap-1.5 text-accent h-full">
          <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-bold">PRO</span>
        </div>
      </div>
    </footer>
  );
};
