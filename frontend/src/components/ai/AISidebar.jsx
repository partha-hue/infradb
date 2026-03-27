import React from 'react';
import { Sparkles, Zap, MessageSquare, Wand2, Lightbulb, History, HelpCircle, Loader2 } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';

const AIAction = ({ icon: Icon, label, description, onClick, loading }) => (
  <button 
    onClick={onClick}
    disabled={loading}
    className="w-full text-left p-3 rounded-lg border border-border bg-panel hover:bg-muted/50 hover:border-brand/30 transition-all group disabled:opacity-50"
  >
    <div className="flex items-center gap-2 mb-1">
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5 text-brand group-hover:scale-110 transition-transform" />
      )}
      <span className="text-xs font-bold text-foreground uppercase tracking-tight">{label}</span>
    </div>
    <p className="text-[10px] text-muted-foreground leading-relaxed">{description}</p>
  </button>
);

export const AISidebar = () => {
  const { optimizeSQL, explainSQL, loading, aiResponse } = useEditor();

  return (
    <aside className="w-80 bg-sidebar border-l border-border flex flex-col overflow-hidden hidden lg:flex">
      <div className="h-12 flex items-center px-4 border-b border-border gap-2">
        <Sparkles className="w-4 h-4 text-brand animate-pulse" />
        <span className="text-sm font-bold tracking-tight">AI Assistant</span>
        <div className="ml-auto flex items-center gap-1">
           <span className="text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">AGENT 4.0</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] px-1">Optimization</div>
          <AIAction 
            icon={Zap} 
            label="Optimize Query" 
            description="Rewrite query to use indices and reduce L3 cache misses." 
            onClick={optimizeSQL}
            loading={loading}
          />
          <AIAction 
            icon={Lightbulb} 
            label="Explain Plan" 
            description="Visualize the execution tree and find bottlenecks." 
            onClick={explainSQL}
            loading={loading}
          />
          <AIAction 
            icon={Wand2} 
            label="Fix Syntax" 
            description="Identify and resolve SQL dialect errors automatically." 
            onClick={() => {}} // TODO: Implement fixSyntax
          />
        </div>

        {/* Chat / Terminal Style */}
        <div className="flex-1 flex flex-col min-h-[300px] border border-border rounded-lg bg-background/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex justify-between items-center bg-sidebar/50">
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
              <MessageSquare className="w-3 h-3" /> Chat History
            </div>
            <History className="w-3 h-3 text-muted-foreground cursor-pointer" />
          </div>
          <div className="flex-1 p-3 text-[11px] font-mono text-muted-foreground space-y-3 overflow-y-auto">
            {aiResponse ? (
              <div className="space-y-4">
                <div className="text-brand/80"># Response from AI Agent:</div>
                {aiResponse.optimized_sql && (
                   <div className="bg-background/80 p-2 rounded border border-brand/20 text-foreground whitespace-pre-wrap">
                     {aiResponse.optimized_sql}
                   </div>
                )}
                <div className="text-foreground leading-relaxed italic">
                  {aiResponse.explanation}
                </div>
              </div>
            ) : (
              <>
                <div className="text-brand/80"># Ready to assist.</div>
                <div>{">"} System: InfraDB Vector Engine detected. AVX-512 optimization active.</div>
                <div className="text-foreground">AI: I noticed your query on 'churn_data' doesn't have a LIMIT. Adding one would reduce execution time by 85%. Would you like me to apply it?</div>
              </>
            )}
          </div>
          <div className="p-2 border-t border-border bg-sidebar/50">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ask AI anything..." 
                className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-brand/50"
              />
              <div className="absolute right-2 top-2">
                <kbd className="px-1 py-0.5 bg-muted rounded border border-border text-[9px] text-muted-foreground">↵</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <HelpCircle className="w-3 h-3" />
          <span>Learn about AI Safety & Data Governance</span>
        </div>
      </div>
    </aside>
  );
};
