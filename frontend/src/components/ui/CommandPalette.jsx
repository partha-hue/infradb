import React, { useEffect, useState } from 'react';
import { Search, Database, Command, Code2, Cpu, History, Zap, Settings, Shield } from 'lucide-react';

export const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-sidebar border border-border-bright rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center gap-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input 
            autoFocus
            placeholder="Search queries, tables, instances, or commands..." 
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder-muted-foreground"
          />
          <div className="flex items-center gap-1">
             <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border text-[10px] text-muted-foreground">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
          <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Commands</div>
          
          <div className="space-y-1">
            <CommandItem icon={Code2} label="Execute Current Selection" shortcut="⌘ ↵" />
            <CommandItem icon={Zap} label="Optimize Query (AI)" shortcut="⌘ ⌥ O" color="text-brand" />
            <CommandItem icon={History} label="Search Execution Logs" shortcut="⌘ L" />
          </div>

          <div className="mt-4 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Navigation</div>
          
          <div className="space-y-1">
            <CommandItem icon={Database} label="Switch to Production Cluster" shortcut="G P" />
            <CommandItem icon={Cpu} label="View Engine Metrics" shortcut="G M" />
            <CommandItem icon={Shield} label="Manage Team Permissions" />
            <CommandItem icon={Settings} label="Global Settings" shortcut="⌘ ," />
          </div>
        </div>

        <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
           <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-muted rounded border border-border">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-muted rounded border border-border">↵</kbd> Select</span>
           </div>
           <div className="text-[10px] font-bold text-brand flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" /> InfraDB Core v3.0
           </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={() => setIsOpen(false)} />
    </div>
  );
};

const CommandItem = ({ icon: Icon, label, shortcut, color = "text-foreground" }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors group">
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="text-sm">{label}</span>
    </div>
    {shortcut && (
      <span className="text-[10px] font-mono text-muted-foreground tracking-tighter">{shortcut}</span>
    )}
  </div>
);
