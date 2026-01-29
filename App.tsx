import React, { useState } from 'react';
import LiveInterface from './components/LiveInterface';
import ChatInterface from './components/ChatInterface';
import { AppMode } from './types';
import { SparklesIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.LIVE);

  return (
    <div className="flex flex-col h-screen bg-aura-900 text-slate-200 font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <header className="h-14 border-b border-cyan-900/30 bg-aura-900/80 backdrop-blur-md flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-cyan-500/50 flex items-center justify-center bg-cyan-900/20 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse-fast"></div>
            </div>
            <h1 className="text-xl font-bold tracking-widest text-cyan-100 font-mono hologram-text">
                AURA<span className="text-cyan-600">.IA</span>
            </h1>
        </div>

        <nav className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button 
                onClick={() => setMode(AppMode.LIVE)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === AppMode.LIVE ? 'bg-cyan-900/40 text-cyan-300 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <SparklesIcon className="w-4 h-4" /> Live
            </button>
            <button 
                onClick={() => setMode(AppMode.RESEARCH)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === AppMode.RESEARCH ? 'bg-cyan-900/40 text-cyan-300 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <GlobeAltIcon className="w-4 h-4" /> Research
            </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
          {/* We keep LiveInterface mounted but hidden to preserve connection state if user switches briefly */}
          <div className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${mode === AppMode.LIVE ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
              <LiveInterface />
          </div>
          
          <div className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${mode === AppMode.RESEARCH ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
              <ChatInterface />
          </div>
      </main>
    </div>
  );
};

export default App;