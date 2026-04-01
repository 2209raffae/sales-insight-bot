import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Radar, Search, Target, TrendingUp, AlertTriangle, 
    Crosshair, Building, Link as LinkIcon, Zap, 
    History, Trash2, ShieldCheck, Globe, ArrowRight,
    CheckCircle2, Pencil, Save, X
} from 'lucide-react';
import axios from 'axios';

interface BattleCard {
    id: number;
    url: string;
    company_name: string;
    summary: string;
    pricing_strategy: string;
    usp: string[];
    weaknesses: string[];
    target_audience: string;
    pitch_advice: string;
    comparison_analysis: string | null;
    created_at: string;
}

const CompetitorRadarPage = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<BattleCard | null>(null);
    const [history, setHistory] = useState<BattleCard[]>([]);
    const [ownWebsite, setOwnWebsite] = useState('');
    const [isEditingOwn, setIsEditingOwn] = useState(false);
    const [tempOwnWebsite, setTempOwnWebsite] = useState('');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetchUser();
        fetchSettings();
        fetchHistory();
    }, []);

    const fetchUser = async () => {
        try {
            const res = await axios.get('/api/auth/me');
            setUser(res.data);
        } catch (err) {
            console.error("Errore fetch utente", err);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/competitor/settings');
            setOwnWebsite(res.data.own_website_url);
            setTempOwnWebsite(res.data.own_website_url);
        } catch (err) {
            console.error("Errore fetch settings", err);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get('/api/competitor/history');
            setHistory(res.data);
        } catch (err) {
            console.error("Errore fetch history", err);
        }
    };

    const handleSaveOwnWebsite = async () => {
        try {
            await axios.post('/api/competitor/settings', { own_website_url: tempOwnWebsite });
            setOwnWebsite(tempOwnWebsite);
            setIsEditingOwn(false);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Errore durante il salvataggio.");
        }
    };

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        let validUrl = url.trim();
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
            validUrl = 'https://' + validUrl;
        }

        setLoading(true);
        setError('');
        
        try {
            const res = await axios.post('/api/competitor/analyze', { url: validUrl });
            setResult(res.data);
            fetchHistory(); // Refresh history list
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Errore durante l\'analisi. Riprova più tardi.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Eliminare questa analisi dallo storico?")) return;
        try {
            await axios.delete(`/api/competitor/${id}`);
            if (result?.id === id) setResult(null);
            fetchHistory();
        } catch (err) {
            alert("Errore durante l'eliminazione.");
        }
    };

    return (
        <div className="w-full pt-20 lg:pt-24 pb-12 animate-in fade-in duration-500 relative z-10 px-4 sm:px-6 max-w-[1600px] mx-auto">
            
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-amber to-neon-pink text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                        <Radar size={36} className="text-neon-amber" />
                        Competitor Radar
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        <span className="w-2 h-2 rounded-full bg-neon-amber animate-pulse"></span>
                        Strategic Intelligence & Benchmarking Hub
                    </p>
                </div>

                {/* Own Website Setting Banner */}
                <div className="glass-panel px-6 py-4 rounded-2xl border-neon-amber/20 bg-neon-amber/5 flex items-center gap-4 min-w-[320px]">
                    <div className="w-10 h-10 rounded-xl bg-neon-amber/20 flex items-center justify-center text-neon-amber">
                        <ShieldCheck size={24} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-neon-amber uppercase tracking-widest leading-none mb-1">Il Tuo Sito (Benchmark)</p>
                        {isEditingOwn ? (
                            <div className="flex items-center gap-2 mt-1">
                                <input 
                                    value={tempOwnWebsite}
                                    onChange={(e) => setTempOwnWebsite(e.target.value)}
                                    className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs text-white outline-none focus:border-neon-amber w-full font-mono"
                                    placeholder="https://tuosito.it"
                                />
                                <button onClick={handleSaveOwnWebsite} className="text-neon-green hover:scale-110 transition-transform"><Save size={16} /></button>
                                <button onClick={() => setIsEditingOwn(false)} className="text-red-400 hover:scale-110 transition-transform"><X size={16} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3 mt-1">
                                <span className="text-sm font-bold text-white font-mono truncate max-w-[200px]">
                                    {ownWebsite || 'Non impostato'}
                                </span>
                                {user?.is_admin === 1 && (
                                    <button onClick={() => { setTempOwnWebsite(ownWebsite); setIsEditingOwn(true); }} className="text-slate-500 hover:text-white transition-colors">
                                        <Pencil size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT: History Sidebar */}
                <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
                    <div className="glass-panel p-5 rounded-2xl h-[calc(100vh-280px)] flex flex-col">
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <History size={14} /> Dossier Recenti
                        </h2>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {history.length === 0 && !loading && (
                                <div className="text-center py-12 opacity-30">
                                    <p className="text-xs uppercase font-bold">Nessun dossier salvato</p>
                                </div>
                            )}
                            {history.map((card) => (
                                <div 
                                    key={card.id}
                                    onClick={() => setResult(card)}
                                    className={`group p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                                        result?.id === card.id 
                                            ? 'bg-neon-amber/10 border-neon-amber/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                                            : 'bg-white/5 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-2 relative z-10">
                                        <div className="overflow-hidden mr-6">
                                            <p className="text-xs font-bold text-white truncate uppercase tracking-tighter">{card.company_name}</p>
                                            <p className="text-[10px] text-slate-500 font-mono truncate">{card.url.replace('https://', '')}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDelete(card.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all absolute top-0 right-0"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-[8px] font-black text-slate-600 uppercase italic">
                                            {new Date(card.created_at).toLocaleDateString()}
                                        </span>
                                        {result?.id === card.id && <div className="w-1.5 h-1.5 rounded-full bg-neon-amber animate-pulse" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CENTER: Main Analysis Hub */}
                <div className="lg:col-span-9 space-y-6 order-1 lg:order-2">
                    
                    {/* Search Bar Panel */}
                    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-amber to-neon-pink" />
                        <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Obiettivo Concorrente</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                                        <Globe size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Inserisci URL concorrente (es. competitor.com)"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:border-neon-amber focus:ring-1 focus:ring-neon-amber/30 transition-all font-mono"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !url}
                                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-neon-amber to-neon-pink rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50 active:scale-95 group"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Infiltrazione...
                                    </>
                                ) : (
                                    <>
                                        <Crosshair size={18} className="group-hover:rotate-45 transition-transform" /> Avvia Analisi
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <AnimatePresence mode="wait">
                        {loading && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="h-[400px] flex flex-col items-center justify-center space-y-6">
                                <div className="relative">
                                    <Radar size={80} className="text-neon-amber/20 animate-pulse" />
                                    <motion.div 
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 border-t-4 border-l-4 border-neon-amber rounded-full"
                                    />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter">Acquisizione Intelligence in corso</h3>
                                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                        Scansione del sito target e confronto con i vostri parametri proprietari...
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {!result && !loading && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="h-[400px] glass-panel rounded-3xl flex flex-col items-center justify-center p-12 text-center border-dashed border-2 border-white/5 bg-white/[0.02]">
                                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/5 group">
                                    <Radar size={48} className="text-slate-700 group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-400 mb-3 tracking-tighter">RADAR ATTIVO</h3>
                                <p className="text-slate-600 max-w-sm text-sm uppercase font-bold tracking-widest">
                                    Seleziona un dossier salvato o inserisci un nuovo obiettivo per iniziare il briefing.
                                </p>
                            </motion.div>
                        )}

                        {result && !loading && (
                            <motion.div 
                                key={result.id}
                                initial={{ opacity: 0, y: 20 }} 
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* Results Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                    
                                    {/* Main Dossier Card */}
                                    <div className="lg:col-span-8 space-y-6">
                                        <div className="glass-panel rounded-2xl overflow-hidden relative border-white/10 group">
                                            <div className="absolute top-0 right-0 p-6 opacity-30 group-hover:opacity-100 transition-opacity">
                                                <Building size={60} className="text-neon-amber" />
                                            </div>
                                            <div className="p-8 border-b border-white/10 bg-gradient-to-br from-white/5 to-transparent">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className="px-3 py-1 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-full text-[10px] font-black uppercase tracking-widest">Analisi AI Completata</span>
                                                    <span className="text-slate-600 text-[10px] font-mono uppercase">{new Date(result.created_at).toLocaleString()}</span>
                                                </div>
                                                <h2 className="text-4xl font-black text-white mb-2 tracking-tighter italic">{result.company_name}</h2>
                                                <a href={result.url} target="_blank" rel="noreferrer" className="text-sm text-neon-amber/70 hover:text-neon-amber hover:underline font-mono inline-flex items-center gap-2">
                                                    <LinkIcon size={14} /> {result.url}
                                                </a>
                                            </div>
                                            
                                            <div className="p-8 space-y-8">
                                                <div>
                                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                        <ArrowRight size={14} className="text-neon-amber" /> Executive Intelligence
                                                    </h4>
                                                    <p className="text-slate-200 text-base leading-relaxed font-medium bg-white/5 p-5 rounded-xl border-l-2 border-neon-amber">
                                                        {result.summary}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-6">
                                                        <div>
                                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Punti Forza (USP)</h4>
                                                            <div className="space-y-2">
                                                                {result.usp.map((item, idx) => (
                                                                    <div key={idx} className="flex gap-3 p-3 bg-neon-green/5 border border-neon-green/10 rounded-lg group/item transition-colors hover:bg-neon-green/10">
                                                                        <CheckCircle2 size={16} className="text-neon-green shrink-0 mt-0.5" />
                                                                        <span className="text-sm text-slate-300 font-medium group-hover/item:text-white transition-colors">{item}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Politica Prezzi</h4>
                                                            <div className="p-4 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-400 font-medium">
                                                                {result.pricing_strategy}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-6">
                                                        <div>
                                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 text-red-400/70">Vulnerabilità</h4>
                                                            <div className="space-y-2">
                                                                {result.weaknesses.map((item, idx) => (
                                                                    <div key={idx} className="flex gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg group/item transition-colors hover:bg-red-500/10">
                                                                        <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                                                        <span className="text-sm text-slate-300 font-medium group-hover/item:text-white transition-colors">{item}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Target Ideale</h4>
                                                            <div className="p-4 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-400 font-medium">
                                                                {result.target_audience}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sidebar Results: Strategy & Comparison */}
                                    <div className="lg:col-span-4 space-y-6">
                                        
                                        {/* Pitch Advice */}
                                        <div className="glass-panel p-6 rounded-2xl border-neon-pink/20 bg-gradient-to-br from-neon-pink/10 to-transparent relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-neon-pink" />
                                            <h4 className="text-[10px] font-black text-neon-pink uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Zap size={14} /> Tactical Pitch Advice
                                            </h4>
                                            <p className="text-sm text-white italic leading-relaxed font-serif">
                                                "{result.pitch_advice}"
                                            </p>
                                        </div>

                                        {/* COMPARISON BENCHMARK [NEW] */}
                                        <div className="glass-panel p-6 rounded-2xl border-neon-amber/20 bg-gradient-to-br from-neon-amber/10 to-transparent relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-amber/5 rounded-full blur-3xl" />
                                            <h4 className="text-[10px] font-black text-neon-amber uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <TrendingUp size={14} /> Strategic Benchmarking (Noi vs Loro)
                                            </h4>
                                            <div className="space-y-4 relative z-10">
                                                <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                                                    <p className="text-xs text-neon-amber font-black uppercase mb-2 tracking-widest">Analisi AI Evolutiva:</p>
                                                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                                                        {result.comparison_analysis || "Scansiona il tuo sito aziendale per attivare il confronto automatico."}
                                                    </p>
                                                </div>
                                                
                                                <div className="pt-2">
                                                    <div className="flex items-center gap-2 opacity-50 mb-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-neon-amber" />
                                                        <span className="text-[9px] font-bold text-white uppercase">Focus operativo NexUS</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 italic">
                                                        Questi suggerimenti sono stati generati confrontando la vostra impronta digitale attuale con il target scansionato.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Call to Action */}
                                        <button className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 transition-all flex items-center justify-center gap-2 group">
                                            Esporta Battled Card (PDF) <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                        </button>

                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(245, 158, 11, 0.2);
                }
            `}</style>
        </div>
    );
};

export default CompetitorRadarPage;
