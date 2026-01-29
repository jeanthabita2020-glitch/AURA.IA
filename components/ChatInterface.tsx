import React, { useState, useRef, useEffect } from 'react';
import { performResearch } from '../services/gemini';
import { ChatMessage } from '../types';
import { PaperAirplaneIcon, ArrowPathIcon, LinkIcon } from '@heroicons/react/24/solid';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
        role: 'model',
        text: 'Módulo de pesquisa online ativado. Digite sua consulta para acessar a rede global de dados.',
        timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const response = await performResearch(userMsg.text);
    setMessages(prev => [...prev, response]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-aura-900/50 backdrop-blur-sm border-l border-cyan-900/30">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl border ${msg.role === 'user' 
                        ? 'bg-cyan-900/20 border-cyan-700 text-cyan-100 rounded-br-none' 
                        : 'bg-slate-800/80 border-slate-700 text-slate-200 rounded-bl-none shadow-lg'}`}>
                        <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.text}</div>
                        
                        {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-600/50">
                                <div className="text-xs font-mono text-cyan-400 mb-2 flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" /> FONTES DE DADOS
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {msg.sources.map((source, sIdx) => (
                                        <a 
                                            key={sIdx} 
                                            href={source.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs bg-slate-900 hover:bg-cyan-900/50 border border-slate-700 hover:border-cyan-500/50 px-2 py-1 rounded transition-colors truncate max-w-[200px]"
                                        >
                                            {source.title || source.uri}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 font-mono uppercase">
                        {msg.role === 'model' ? 'AURA' : 'USUÁRIO'} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                </div>
            ))}
            {isLoading && (
                 <div className="flex items-start">
                    <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-slate-800/80 border border-slate-700 text-cyan-400 text-sm font-mono animate-pulse">
                        PROCESSANDO DADOS...
                    </div>
                 </div>
            )}
        </div>

        <div className="p-4 bg-aura-900 border-t border-cyan-900/50">
            <div className="flex gap-2 relative">
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pesquisar no banco de dados global..."
                    className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono text-sm"
                />
                <button 
                    onClick={handleSend}
                    disabled={isLoading}
                    className="absolute right-2 top-2 p-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors disabled:opacity-50"
                >
                   {isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
    </div>
  );
};

export default ChatInterface;