import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ChevronRight } from 'lucide-react';

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
}

const PolicyBotPage = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Auto-scroll all'ultimo messaggio
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text: input };
        const newMessages = [...messages, userMsg];

        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/hr/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_history: newMessages,
                    new_message: userMsg.text
                })
            });

            if (!response.ok) throw new Error("Errore di rete");

            const data = await response.json();
            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: data.reply };

            setMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
            const errorMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: "Errore di connessione al bot HR." };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 pb-20 mt-4 sm:mt-8 flex flex-col h-[calc(100vh-140px)]">
            <div className="mb-6 shrink-0">
                <h1 className="text-3xl font-bold font-['Space_Grotesk'] text-white flex items-center gap-3">
                    <Bot className="text-neon-pink" size={32} />
                    Policy & Leave <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-pink to-neon-purple">Bot</span>
                </h1>
                <p className="text-slate-400 mt-2">Assistente virtuale per policy aziendali, resoconti ferie e richieste permessi.</p>
            </div>

            <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-neon-pink/5 blur-[80px] pointer-events-none" />

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10 scroll-smooth">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                            <div className="w-20 h-20 rounded-full bg-neon-pink/10 flex items-center justify-center mb-2">
                                <Bot size={40} className="text-neon-pink" />
                            </div>
                            <p className="text-center max-w-sm">"Ciao! Sono l'assistente per le risorse umane. Puoi chiedermi info su ferie, smart working, benefit, o policy interne."</p>

                            <div className="flex flex-wrap gap-2 justify-center mt-6">
                                {['Quanti giorni di ferie ho?', 'Policy Smart Working', 'Come rimborso una spesa?'].map(txt => (
                                    <button
                                        key={txt}
                                        onClick={() => setInput(txt)}
                                        className="text-xs px-3 py-1.5 rounded-full border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10 flex items-center gap-1 transition-colors bg-black/40"
                                    >
                                        {txt} <ChevronRight size={12} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 shadow-lg ${msg.sender === 'user'
                                    ? 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-[0_0_10px_rgba(0,210,255,0.2)]'
                                    : 'bg-neon-pink/10 border-neon-pink text-neon-pink shadow-[0_0_10px_rgba(255,0,127,0.2)]'
                                    }`}>
                                    {msg.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
                                </div>

                                <div className={`max-w-[80%] rounded-2xl p-4 leading-relaxed whitespace-pre-wrap ${msg.sender === 'user'
                                    ? 'bg-neon-blue/10 border border-neon-blue/20 text-blue-50'
                                    : 'bg-black/40 border border-white/5 text-slate-200 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 shrink-0 rounded-full bg-neon-pink/10 border-2 border-neon-pink text-neon-pink flex items-center justify-center">
                                <Bot size={18} className="animate-pulse" />
                            </div>
                            <div className="max-w-[80%] rounded-2xl p-4 bg-black/40 border border-white/5 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-neon-pink/60 animate-bounce" />
                                <span className="w-2 h-2 rounded-full bg-neon-pink/60 animate-bounce" style={{ animationDelay: '0.2s' }} />
                                <span className="w-2 h-2 rounded-full bg-neon-pink/60 animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/50 border-t border-white/5 z-10 backdrop-blur-md">
                    <div className="relative flex items-center max-w-4xl mx-auto">
                        <textarea
                            className="w-full bg-[#111116] border border-white/10 rounded-xl pl-4 pr-14 py-3 text-sm text-slate-200 focus:outline-none focus:border-neon-pink focus:ring-1 focus:ring-neon-pink/50 transition-all resize-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] h-[52px] leading-relaxed"
                            placeholder="Fai una domanda sulle policy HR..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2 p-2 bg-gradient-to-r from-neon-pink to-neon-purple rounded-lg text-white hover:shadow-[0_0_15px_rgba(255,0,127,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={18} className={isLoading ? "opacity-0" : "opacity-100"} />
                            {isLoading && <div className="absolute inset-0 m-auto w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        </button>
                    </div>
                    <div className="text-center mt-2">
                        <span className="text-[10px] text-slate-500">Risposte AI. Verifica sempre le policy nel portale intranet ufficiale.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolicyBotPage;
