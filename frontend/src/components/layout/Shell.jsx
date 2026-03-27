import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { CommandPalette } from '../ui/CommandPalette';
import { AISidebar } from '../ai/AISidebar';

export const Shell = ({ children }) => {
  const [showAI, setShowAI] = useState(true);
  
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground selection:bg-brand/30 selection:text-white">
      <CommandPalette />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        
        {/* Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-panel relative border-x border-border">
          {children}
        </main>

        {/* AI Context Panel (Toggleable) */}
        {showAI && <AISidebar />}
      </div>

      <StatusBar />
    </div>
  );
};
