import React from 'react';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { Header } from './Header';
import { useEditor } from '../../context/EditorContext';

export const Shell = ({ children }) => {
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground font-sans overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative border-l border-border">
          <Header />
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  );
};
