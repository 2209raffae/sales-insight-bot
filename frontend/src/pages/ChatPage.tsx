import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Code, Terminal, AlertCircle, Activity } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:4000/api';

interface Message {
    id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: Date;
}

const TypewriterText = ({ text }: { text: string }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        let i = 0;
        setDisplayedText('');
        const intervalId = setInterval(() => {
            setDisplayedText((prev) => prev + text.charAt(i));
            i++;
            if (i === text.length) {
                clearInterval(intervalId);
            }
        }, 15); // Velocità digitazione

        return () => clearInterval(intervalId);
    }, [text]);

    return <span>{displayedText}</span>;
};

const ChatPage = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            sender: 'bot',
            text: 'Inizializzazione sistema NexUS Copilot completata. Connesso al database analitico centrale. Invia un comando o una query sui KPI attuali per iniziare l\'interfaccia diagnostica.',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/chat`, {
                question: userMessage.text
            });

            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: response.data.answer || "Nessuna risposta dal server centrale.",
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error: any) {
            console.error("Chat Error:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: "ERRORE DI SISTEMA. Impossibile contattare il core cognitivo (Backend API). Verifica l'integrità della connessione.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div className="pt-24 pb-12 w-full h-[calc(100vh-2rem)] flex flex-col relative z-10">

            {/* Header Interfaccia */}
            <div className="mb-6 flex justify-between items-center bg-black/40 p-4 rounded-xl border border-neon-blue/20 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Bot size={32} className="text-neon-cyan" />
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse"></span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-2">
                            <Terminal size={18} className="text-neon-cyan" />
                            NexUS AI Terminal
                        </h1>
                        <p className="text-xs text-neon-blue/70 uppercase">Modello LLaMa / Groq Link Attivo</p>
                    </div>
                </div>
                <div className="hidden md:flex gap-2 text-xs text-gray-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Code size={12} /> Security: Max</span>
                    <span className="mx-2">|</span>
                    <span className="flex items-center gap-1"><Activity size={12} /> Latency: 24ms</span>
                </div>
            </div>

            {/* Finestra Log Chat */}
            <div className="flex-1 glass-panel rounded-xl overflow-hidden flex flex-col border border-white/5 relative shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                {/* Griglia di Scansione Sfondo */}
                <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth z-10">
                    <AnimatePresence>
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[80%] flex gap-4 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border 
                    ${message.sender === 'user'
                                            ? 'bg-neon-purple/20 border-neon-purple/50 text-neon-purple'
                                            : message.text.includes('ERRORE')
                                                ? 'bg-red-500/20 border-red-500/50 text-red-500'
                                                : 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan'
                                        }`}
                                    >
                                        {message.sender === 'user' ? <User size={20} /> : message.text.includes('ERRORE') ? <AlertCircle size={20} /> : <Bot size={20} />}
                                    </div>

                                    {/* Messaggio */}
                                    <div className={`flex flex-col gap-1 ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{message.sender === 'user' ? 'OPERATORE' : 'NEXUS_AI'}</span>
                                            <span>•</span>
                                            <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                        </div>

                                        <div className={`p-4 rounded-xl relative overflow-hidden group border
                      ${message.sender === 'user'
                                                ? 'bg-neon-purple/10 border-neon-purple/30 text-white rounded-tr-none'
                                                : message.text.includes('ERRORE')
                                                    ? 'bg-red-500/10 border-red-500/30 text-red-200 rounded-tl-none font-mono text-sm uppercase'
                                                    : 'bg-black/60 border-neon-cyan/30 text-cyan-50 rounded-tl-none font-mono text-sm leading-relaxed'
                                            }`}
                                        >
                                            {message.sender === 'bot' && !message.text.includes('ERRORE') ? (
                                                <TypewriterText text={message.text} />
                                            ) : (
                                                message.text
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                            <div className="flex flex-row gap-4 max-w-[80%]">
                                <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
                                    <Bot size={20} className="text-neon-cyan animate-pulse" />
                                </div>
                                <div className="p-4 rounded-xl bg-black/60 border border-neon-cyan/30 rounded-tl-none flex items-center gap-2">
                                    <span className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                    <span className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Console Input Area */}
                <div className="p-4 bg-black/80 border-t border-white/10 relative z-20">
                    <div className="flex items-center relative">
                        <span className="absolute left-4 text-neon-cyan font-mono">{'>'}</span>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Inserisci query o comando direttivo..."
                            autoFocus
                            className="w-full bg-black border border-neon-cyan/50 text-white font-mono rounded-lg pl-10 pr-16 py-4 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all placeholder:text-gray-600"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 p-2 bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan hover:text-black rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
