import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, AlertCircle, Edit2, Trash2, Calendar, Zap, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const SpendPage = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        from: firstDay,
        to: lastDay,
        winning: 'LAVORATA,CHIUSA',
        mode: 'both'
    });

    const [activeTab, setActiveTab] = useState('source');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Tab Data
    const [summary, setSummary] = useState<any>(null);
    const [anomalies, setAnomalies] = useState<any>([]);

    // Manual Edit State
    const [manualEntries, setManualEntries] = useState<any[]>([]);
    const [sources, setSources] = useState<string[]>([]);
    const [manualForm, setManualForm] = useState({
        id: '', source: '', period_type: 'month', period_value: '', amount: '', note: ''
    });

    // Forecast State
    const [forecastText, setForecastText] = useState('');
    const [isForecasting, setIsForecasting] = useState(false);

    const buildQuery = () => {
        const p = new URLSearchParams();
        if (filters.from) p.append('from', filters.from);
        if (filters.to) p.append('to', filters.to);
        if (filters.winning) p.append('winning', filters.winning);
        if (filters.mode) p.append('mode', filters.mode);
        return p.toString();
    };

    const fetchKPIs = async () => {
        setLoading(true);
        setError('');
        try {
            const q = buildQuery();
            const [sumRes, alertsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/kpi/spend/summary?${q}`),
                axios.get(`${API_BASE_URL}/advanced/alerts`)
            ]);
            setSummary(sumRes.data);
            setAnomalies(alertsRes.data.alerts || []);
        } catch (err: any) {
            console.error(err);
            setError('Errore di sistema: impossibile caricare i KPI spese. Controlla filtri o il backend.');
        } finally {
            setLoading(false);
        }
    };

    const fetchSourcesAndManual = async () => {
        try {
            const [srcRes, manRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/leads/sources`),
                axios.get(`${API_BASE_URL}/spend/manual`)
            ]);
            setSources(srcRes.data.sources || []);
            setManualEntries(manRes.data || []);
        } catch (err) {
            console.error("Non è stato possibile caricare le fonti o spese manuali", err);
        }
    };

    useEffect(() => {
        fetchSourcesAndManual();
    }, []);

    useEffect(() => {
        fetchKPIs();
    }, [filters]);

    // Manual Form Handlers
    const saveManual = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                source: manualForm.source,
                period_type: manualForm.period_type,
                period_value: manualForm.period_value,
                amount: parseFloat(manualForm.amount),
                note: manualForm.note || null
            };

            if (manualForm.id) {
                await axios.put(`${API_BASE_URL}/spend/manual/${manualForm.id}`, payload);
            } else {
                await axios.post(`${API_BASE_URL}/spend/manual`, payload);
            }

            setManualForm({ id: '', source: '', period_type: 'month', period_value: '', amount: '', note: '' });
            await fetchSourcesAndManual();
            fetchKPIs(); // Refresh graphs
        } catch (err: any) {
            alert("Errore Salvataggio: " + err.message);
        }
    };

    const deleteManual = async (id: number) => {
        if (!window.confirm("Eliminare questa spesa?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/spend/manual/${id}`);
            await fetchSourcesAndManual();
            fetchKPIs();
        } catch (err: any) {
            alert("Errore: " + err.message);
        }
    };

    const generateForecast = async () => {
        setIsForecasting(true);
        setForecastText('');
        try {
            const res = await axios.get(`${API_BASE_URL}/advanced/forecast-trend?${buildQuery()}`);
            setForecastText(res.data.forecast || "Nessuna previsione prodotta.");
        } catch (err: any) {
            setForecastText("Errore Generazione AI: " + err.message);
        } finally {
            setIsForecasting(false);
        }
    };

    const num = (v: number | string | null) => {
        if (v === null || v === undefined) return '-';
        return Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Derived Summary Stats
    let avgCpl = null;
    let bestSource = null;
    if (summary && summary.cpl_by_source) {
        const valids = summary.cpl_by_source.filter((r: any) => r.cpl !== null);
        if (valids.length > 0) {
            avgCpl = valids.reduce((s: number, r: any) => s + r.cpl, 0) / valids.length;
            bestSource = valids.reduce((a: any, b: any) => a.cpl < b.cpl ? a : b);
        }
    }

    const totalAlerts = (summary?.overspending_alerts?.length || 0) + anomalies.length;

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 min-h-screen flex flex-col">

            {/* Header & Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-pink to-neon-purple text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                        <DollarSign size={36} className="text-neon-pink" />
                        KPI Spese & CPL
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        Monitoraggio costi e ROI avanzato
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-neon-pink" />
                        <input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} className="bg-cyber-card border border-neon-pink/30 text-white rounded px-2 py-1 text-xs outline-none" />
                        <span className="text-gray-500">-</span>
                        <input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} className="bg-cyber-card border border-neon-pink/30 text-white rounded px-2 py-1 text-xs outline-none" />
                    </div>

                    <div className="h-6 w-px bg-white/10 hidden md:block"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase text-gray-500">Vincenti:</span>
                        <input type="text" value={filters.winning} onChange={e => setFilters({ ...filters, winning: e.target.value })} className="bg-cyber-card border border-neon-pink/30 text-white rounded px-2 py-1 text-xs outline-none w-32" />
                    </div>

                    <div className="h-6 w-px bg-white/10 hidden md:block"></div>

                    <div className="flex bg-black/50 rounded-lg p-1 border border-white/5">
                        {['imported', 'actual', 'both'].map(m => (
                            <button
                                key={m}
                                onClick={() => setFilters({ ...filters, mode: m })}
                                className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors ${filters.mode === m ? 'bg-neon-pink text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                {m === 'imported' ? 'CSV' : m === 'actual' ? 'Manuale' : 'Mix'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error && <div className="p-4 mb-6 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg">{error}</div>}

            {/* Quick Stats Grid */}
            {!error && summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="glass-panel p-5 rounded-xl border-l-2 border-neon-pink">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Spesa Totale</p>
                        <h3 className="text-2xl font-bold font-mono">€ {num(summary.total_spend)}</h3>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border-l-2 border-neon-blue">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">CPL Medio</p>
                        <h3 className="text-2xl font-bold font-mono text-neon-blue">€ {avgCpl ? num(avgCpl) : '-'}</h3>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border-l-2 border-neon-purple">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Miglior Fonte (CPL)</p>
                        <h3 className="text-xl font-bold text-neon-purple truncate">{bestSource ? `${bestSource.source}` : '-'}</h3>
                        <p className="text-xs text-neon-purple/50">€ {bestSource ? num(bestSource.cpl) : '-'}</p>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border-l-2 border-red-500">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Alert Sforamento</p>
                        <h3 className="text-2xl font-bold font-mono text-red-500">{totalAlerts}</h3>
                    </div>
                </div>
            )}

            {/* Main Tabs Area */}
            <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden">
                <div className="flex overflow-x-auto border-b border-white/10 bg-black/40 p-2 gap-2 hide-scrollbar">
                    {[
                        { id: 'source', label: 'Spesa x Fonte' },
                        { id: 'cpl', label: 'Analisi CPL' },
                        { id: 'winning', label: 'CPL Vincente' },
                        { id: 'trend', label: 'Trend Mensile' },
                        { id: 'alerts', label: 'Alerts', badge: totalAlerts },
                        { id: 'manual', label: 'Spese Manuali' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2
                                ${activeTab === tab.id
                                    ? 'bg-neon-pink/20 text-neon-pink shadow-[inset_0_0_10px_rgba(255,0,127,0.3)]'
                                    : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                        >
                            {tab.label}
                            {tab.badge > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">{tab.badge}</span>}
                        </button>
                    ))}
                </div>

                <div className="p-6 flex-1 min-h-[500px] relative overflow-y-auto hide-scrollbar">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 backdrop-blur-sm">
                            <div className="w-12 h-12 border-4 border-neon-pink border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {!loading && summary && (
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="h-full"
                            >
                                {/* By Source Chart */}
                                {activeTab === 'source' && (
                                    <div className="h-[450px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={summary.spend_by_source} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#22222a" horizontal={false} />
                                                <XAxis type="number" stroke="#666" />
                                                <YAxis dataKey="source" type="category" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} width={120} />
                                                <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111116', border: '1px solid #ff007f' }} />
                                                <Bar dataKey="total_spend" fill="#ff007f" radius={[0, 4, 4, 0]}>
                                                    {summary.spend_by_source?.map((_: any, i: number) => <Cell key={i} fill={i % 2 === 0 ? '#ff007f' : '#b026ff'} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Data Tables (CPL & Winning) */}
                                {(activeTab === 'cpl' || activeTab === 'winning') && (
                                    <div className="overflow-hidden border border-white/10 rounded-lg">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead className="bg-black/80 sticky top-0 backdrop-blur-md">
                                                <tr>
                                                    <th className="p-4 text-neon-pink font-bold uppercase text-xs border-b border-white/10">Fonte</th>
                                                    <th className="p-4 text-neon-pink font-bold uppercase text-xs border-b border-white/10 text-right">Spesa</th>
                                                    <th className="p-4 text-neon-pink font-bold uppercase text-xs border-b border-white/10 text-right">Lead {activeTab === 'winning' ? 'Vincenti' : ''}</th>
                                                    <th className="p-4 text-neon-pink font-bold uppercase text-xs border-b border-white/10 text-right">CPL {activeTab === 'winning' ? 'Vincente' : ''}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(activeTab === 'cpl' ? summary.cpl_by_source : summary.cost_per_winning_by_source)?.map((r: any, i: number) => (
                                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                        <td className="p-4 font-bold text-gray-200">{r.source}</td>
                                                        <td className="p-4 text-right font-mono text-neon-pink">€ {num(r.total_spend)}</td>
                                                        <td className="p-4 text-right font-mono text-gray-400">{activeTab === 'cpl' ? r.leads_count : r.winning_leads}</td>
                                                        <td className="p-4 text-right font-mono text-neon-blue font-bold">€ {num(activeTab === 'cpl' ? r.cpl : r.cost_per_winning)}</td>
                                                    </tr>
                                                ))}
                                                {!(activeTab === 'cpl' ? summary.cpl_by_source : summary.cost_per_winning_by_source)?.length && (
                                                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nessun dato.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Trend Dashboard */}
                                {activeTab === 'trend' && (
                                    <div className="flex flex-col gap-6">
                                        <div className="flex justify-between items-center bg-black/30 p-4 rounded-xl border border-white/5">
                                            <div>
                                                <h3 className="font-bold text-lg text-white">Trend Serie Temporale</h3>
                                            </div>
                                            <button
                                                onClick={generateForecast}
                                                disabled={isForecasting}
                                                className="btn-futuristic bg-neon-purple/20 text-neon-purple border border-neon-purple hover:bg-neon-purple hover:text-white px-4 py-2 flex items-center gap-2 rounded-lg transition-all"
                                            >
                                                {isForecasting ? <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div> : <Zap size={16} />}
                                                Genera Previsione AI
                                            </button>
                                        </div>

                                        {forecastText && (
                                            <div className="bg-black/60 border border-neon-purple/50 p-6 rounded-xl font-mono text-sm leading-relaxed text-gray-300">
                                                <div className="text-neon-purple mb-2 flex items-center gap-2 uppercase tracking-widest text-xs font-bold"><Bot size={16} /> Nexus Predictor</div>
                                                <div dangerouslySetInnerHTML={{ __html: forecastText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>').replace(/\n/g, '<br/>') }}></div>
                                            </div>
                                        )}

                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={summary.monthly_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.8} />
                                                            <stop offset="95%" stopColor="#00f2fe" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#22222a" vertical={false} />
                                                    <XAxis dataKey="month" stroke="#666" />
                                                    <YAxis stroke="#666" yAxisId="left" />
                                                    <YAxis stroke="#666" yAxisId="right" orientation="right" />
                                                    <RechartsTooltip contentStyle={{ backgroundColor: '#111116', border: '1px solid #00f2fe' }} />
                                                    <Area yAxisId="left" type="monotone" dataKey="total_spend" stroke="#ff007f" fillOpacity={0.1} />
                                                    <Area yAxisId="right" type="monotone" dataKey="cpl" stroke="#00f2fe" fillOpacity={1} fill="url(#colorMonthly)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* ALERTS */}
                                {activeTab === 'alerts' && (
                                    <div className="space-y-4">
                                        {anomalies.map((a: any, i: number) => (
                                            <div key={`anom-${i}`} className={`p-4 rounded-xl border flex items-start gap-4 ${a.severity === 'critic' ? 'bg-red-500/10 border-red-500/50 text-red-200' : 'bg-orange-500/10 border-orange-500/50 text-orange-200'}`}>
                                                <AlertCircle className={a.severity === 'critic' ? 'text-red-500' : 'text-orange-500'} />
                                                <div>
                                                    <h4 className="font-bold uppercase tracking-wider text-sm mb-1">[Anomalia Backend] {a.source}</h4>
                                                    <p className="text-sm">{a.message}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {summary.overspending_alerts?.map((a: any, i: number) => (
                                            <div key={`alert-${i}`} className="p-4 rounded-xl border bg-yellow-500/10 border-yellow-500/50 flex items-start flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <AlertCircle className="text-yellow-500 shrink-0" />
                                                    <div>
                                                        <h4 className="font-bold text-yellow-500 uppercase tracking-wider text-sm mb-1">{a.source}</h4>
                                                        <p className="text-sm text-yellow-200">{a.alert_reason}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 min-w-max">
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-gray-500 uppercase">Spesa</p>
                                                        <p className="font-mono font-bold text-white">€ {num(a.total_spend)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-gray-500 uppercase">Vincenti</p>
                                                        <p className="font-mono font-bold text-white">{a.winning_leads || 0}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {totalAlerts === 0 && (
                                            <div className="p-10 text-center border border-dashed border-green-500/30 rounded-xl bg-green-500/5">
                                                <p className="text-green-500 text-lg">Tutto nella norma. Nessun alert o anomalia rilevati.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* MANUAL ENTRIES */}
                                {activeTab === 'manual' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                                        <form onSubmit={saveManual} className="glass-panel p-6 rounded-xl border border-neon-blue/20 bg-black/60 sticky top-0">
                                            <h3 className="font-bold text-lg mb-6 text-neon-blue uppercase tracking-widest border-b border-neon-blue/20 pb-2">
                                                {manualForm.id ? 'Modifica Spesa' : 'Nuova Spesa Manuale'}
                                            </h3>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Fonte</label>
                                                    <select required value={manualForm.source} onChange={e => setManualForm({ ...manualForm, source: e.target.value })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-white focus:border-neon-blue outline-none">
                                                        <option value="">Seleziona...</option>
                                                        {sources.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Tipo</label>
                                                        <select value={manualForm.period_type} onChange={e => setManualForm({ ...manualForm, period_type: e.target.value })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-white focus:border-neon-blue outline-none">
                                                            <option value="month">Mese</option>
                                                            <option value="week">Settimana</option>
                                                            <option value="quarter">Trimestre</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Valore (es 2023-01)</label>
                                                        <input required type="text" value={manualForm.period_value} onChange={e => setManualForm({ ...manualForm, period_value: e.target.value })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-white focus:border-neon-blue outline-none font-mono" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Importo (€)</label>
                                                    <input required type="number" step="0.01" value={manualForm.amount} onChange={e => setManualForm({ ...manualForm, amount: e.target.value })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-neon-pink font-bold focus:border-neon-pink outline-none font-mono placeholder:text-gray-700" placeholder="1500.00" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Nota Opzionale</label>
                                                    <input type="text" value={manualForm.note} onChange={e => setManualForm({ ...manualForm, note: e.target.value })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-white focus:border-neon-blue outline-none" />
                                                </div>

                                                <div className="pt-4 flex gap-3">
                                                    <button type="submit" className="flex-1 bg-neon-blue hover:bg-white text-black font-bold uppercase tracking-wider py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)]">
                                                        Salva
                                                    </button>
                                                    {manualForm.id && (
                                                        <button type="button" onClick={() => setManualForm({ id: '', source: '', period_type: 'month', period_value: '', amount: '', note: '' })} className="px-4 border border-white/20 rounded-lg hover:bg-white/10 text-white">Annulla</button>
                                                    )}
                                                </div>
                                            </div>
                                        </form>

                                        <div className="lg:col-span-2 overflow-hidden border border-white/10 rounded-lg">
                                            <table className="w-full text-left border-collapse text-sm">
                                                <thead className="bg-black/80 sticky top-0 backdrop-blur-md">
                                                    <tr>
                                                        <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10">Periodo</th>
                                                        <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10">Fonte</th>
                                                        <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10 text-right">Spesa</th>
                                                        <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10 text-center">Azioni</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {manualEntries.map((m: any) => (
                                                        <tr key={m.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                            <td className="p-4 font-mono text-gray-400">{m.period_value} <span className="text-[10px] ml-1 opacity-50 uppercase">{m.period_type}</span></td>
                                                            <td className="p-4"><span className="bg-white/10 px-2 py-1 rounded text-xs">{m.source}</span></td>
                                                            <td className="p-4 text-right font-mono font-bold text-neon-pink">€ {num(m.amount)}</td>
                                                            <td className="p-4 flex justify-center gap-2">
                                                                <button onClick={() => setManualForm({ id: m.id, source: m.source, period_type: m.period_type, period_value: m.period_value, amount: m.amount.toString(), note: m.note || '' })} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded"><Edit2 size={16} /></button>
                                                                <button onClick={() => deleteManual(m.id)} className="p-2 text-red-400 hover:text-white bg-red-500/10 rounded"><Trash2 size={16} /></button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {!manualEntries.length && <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nessuna spesa manuale inserita.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SpendPage;
