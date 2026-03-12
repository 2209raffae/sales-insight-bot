import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Search, Target, TrendingUp, AlertTriangle, Crosshair, Building, Link as LinkIcon, Zap } from 'lucide-react';
import axios from 'axios';

interface BattleCard {
    url: string;
    company_name: string;
    summary: string;
    pricing_strategy: string;
    usp: string[];
    weaknesses: string[];
    target_audience: string;
    pitch_advice: string;
}

const CompetitorRadarPage = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<BattleCard | null>(null);

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        // Basic URL validation
        let validUrl = url;
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
            validUrl = 'https://' + validUrl;
            setUrl(validUrl);
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await axios.post('/api/competitor/analyze', { url: validUrl });
            setResult(res.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Errore durante l\'analisi del sito. Riprova più tardi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full pt-20 lg:pt-24 pb-12 animate-in fade-in duration-500 relative z-10 px-4 sm:px-6">

            <div className="mb-8">
                <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-amber to-neon-pink text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                    <Radar size={36} className="text-neon-amber" />
                    Competitor Radar
                </h1>
                <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                    <span className="w-2 h-2 rounded-full bg-neon-amber animate-pulse"></span>
                    Analisi AI dei Concorrenti & Battle Cards
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Input Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-amber to-neon-pink" />

                        <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                            <Search size={18} className="text-neon-amber" /> Nuovo Obiettivo
                        </h2>

                        <form onSubmit={handleAnalyze} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sito web concorrente</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <LinkIcon size={16} className="text-slate-500" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="es. competitor.com"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-neon-amber focus:ring-1 focus:ring-neon-amber/50 transition-all font-mono"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !url}
                                className="w-full py-3 bg-gradient-to-r from-neon-amber to-neon-pink rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Scansione in corso...
                                    </>
                                ) : (
                                    <>
                                        <Crosshair size={18} /> Avvia Analisi
                                    </>
                                )}
                            </button>
                        </form>

                        {error && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        {loading && (
                            <div className="mt-6 text-center space-y-2">
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-neon-amber to-neon-pink w-1/2 animate-[progress_1s_ease-in-out_infinite]" />
                                </div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">
                                    Lettura DOM & Parsing...
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-black/40 to-neon-amber/5 border border-white/5">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Zap size={16} className="text-neon-amber" /> Come funziona
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed mb-4">
                            Il nostro agente AI scansiona in tempo reale il sito web fornito, aggirando blocchi di base, ed estrapola l'intera offerta visibile.
                        </p>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Successivamente, un modello di intelligenza artificiale <strong>LLaMA 3.3 70B</strong> compila una "Battle Card" strategica pronta da consegnare al team vendite.
                        </p>
                    </div>
                </div>

                {/* Output Section */}
                <div className="lg:col-span-2">
                    <AnimatePresence mode="wait">
                        {!result && !loading ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="h-full min-h-[400px] glass-panel rounded-2xl flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-white/10">
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                    <Radar size={40} className="text-slate-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-300 mb-2">In attesa del Bersaglio</h3>
                                <p className="text-sm text-slate-500 max-w-sm">
                                    Inserisci l'URL di un tuo concorrente nel pannello laterale per generare il dossier di intelligence.
                                </p>
                            </motion.div>
                        ) : result ? (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                className="glass-panel rounded-2xl relative overflow-hidden flex flex-col h-full">

                                {/* Result Header */}
                                <div className="p-6 md:p-8 bg-gradient-to-r from-neon-amber/10 to-transparent border-b border-white/10 relative">
                                    <div className="absolute top-0 right-0 p-4">
                                        <span className="px-3 py-1 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                            Analisi Completa
                                        </span>
                                    </div>
                                    <h2 className="text-3xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
                                        <Building size={28} className="text-neon-amber" />
                                        {result.company_name}
                                    </h2>
                                    <a href={result.url} target="_blank" rel="noreferrer" className="text-sm text-neon-blue hover:underline font-mono">
                                        {result.url}
                                    </a>
                                </div>

                                {/* Result Body */}
                                <div className="p-6 md:p-8 space-y-8 flex-1">

                                    {/* Summary */}
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Executive Summary</h4>
                                        <p className="text-slate-300 text-sm leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5">
                                            {result.summary}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Target & Pricing */}
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <Target size={14} /> Target Audience
                                                </h4>
                                                <div className="text-sm text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5 font-medium">
                                                    {result.target_audience}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <TrendingUp size={14} /> Pricing Strategy
                                                </h4>
                                                <div className="text-sm text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5 font-medium">
                                                    {result.pricing_strategy}
                                                </div>
                                            </div>
                                        </div>

                                        {/* USP & Weaknesses */}
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-xs font-bold text-neon-green uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <Zap size={14} /> Punti di Forza (USP)
                                                </h4>
                                                <ul className="space-y-2">
                                                    {result.usp.map((u, i) => (
                                                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2 bg-neon-green/5 p-2 rounded border border-neon-green/10">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-neon-green mt-1.5 shrink-0" />
                                                            <span>{u}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <AlertTriangle size={14} /> Vulnerabilità
                                                </h4>
                                                <ul className="space-y-2">
                                                    {result.weaknesses.map((w, i) => (
                                                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2 bg-red-500/5 p-2 rounded border border-red-500/10">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                                                            <span>{w}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pitch Advice */}
                                    <div className="pt-4 mt-6 border-t border-white/10">
                                        <h4 className="text-xs font-bold text-neon-amber uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Crosshair size={14} /> Pitch Advisor (Come Vendere Contro)
                                        </h4>
                                        <div className="bg-gradient-to-r from-neon-amber/20 to-transparent p-5 rounded-xl border-l-4 border-neon-amber shadow-lg relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-amber/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                            <p className="text-sm text-white leading-relaxed relative z-10 font-medium">
                                                {result.pitch_advice}
                                            </p>
                                        </div>
                                    </div>

                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </div>

            <style>{`
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}</style>
        </div>
    );
};

export default CompetitorRadarPage;
