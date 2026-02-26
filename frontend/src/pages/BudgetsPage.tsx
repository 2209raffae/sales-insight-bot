import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Trash2, Edit2, Info, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:4000/api';

const BudgetsPage = () => {
    const today = new Date();
    const [yearFilter, setYearFilter] = useState(today.getFullYear().toString());
    const [monthFilter, setMonthFilter] = useState((today.getMonth() + 1).toString().padStart(2, '0'));

    const [activeTab, setActiveTab] = useState('planning'); // 'planning' | 'report'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [budgets, setBudgets] = useState<any[]>([]);
    const [report, setReport] = useState<any[]>([]);
    const [sources, setSources] = useState<string[]>([]);

    const [form, setForm] = useState({
        id: '',
        year: today.getFullYear().toString(),
        month: (today.getMonth() + 1).toString().padStart(2, '0'),
        source: '',
        amount: ''
    });

    const fetchSources = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/leads/sources`);
            setSources(res.data.sources || []);
        } catch (e) { console.error("Error fetching sources", e); }
    };

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const reqUrlBudgets = `${API_BASE_URL}/budgets?year=${yearFilter}&month=${monthFilter}`;
            const reqUrlReport = `${API_BASE_URL}/budgets/kpis/report?year=${yearFilter}&month=${monthFilter}`;

            const [budgetsRes, reportRes] = await Promise.all([
                axios.get(reqUrlBudgets),
                axios.get(reqUrlReport)
            ]);

            setBudgets(budgetsRes.data || []);
            setReport(reportRes.data?.rows || []);
        } catch (err: any) {
            console.error(err);
            setError('Impossibile caricare i dati di budget dal server.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSources();
    }, []);

    useEffect(() => {
        fetchData();
    }, [yearFilter, monthFilter]);

    const saveBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                year: parseInt(form.year),
                month: parseInt(form.month),
                source: form.source,
                planned_budget: parseFloat(form.amount)
            };

            if (form.id) {
                await axios.put(`${API_BASE_URL}/budgets/${form.id}`, payload);
            } else {
                await axios.post(`${API_BASE_URL}/budgets`, payload);
            }

            setForm({ ...form, id: '', source: '', amount: '' }); // keep year/month
            fetchData();
        } catch (err: any) {
            alert("Errore Salvataggio: " + err.message);
        }
    };

    const deleteBudget = async (id: number) => {
        if (!window.confirm("Eliminare definitivamente questo budget?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/budgets/${id}`);
            fetchData();
        } catch (err: any) {
            alert("Errore: " + err.message);
        }
    };

    const num = (v: number | string | null) => {
        if (v === null || v === undefined) return '-';
        return Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Calculate Totals for the Report Tab
    const totalBudget = report.reduce((sum, r) => sum + (r.planned_budget || 0), 0);
    const totalSpend = report.reduce((sum, r) => sum + (r.actual_spend || 0), 0);
    const totalVariance = totalBudget > 0 ? totalBudget - totalSpend : 0;
    const isVariancePositive = totalVariance >= 0;

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 min-h-screen flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black text-yellow-500 tracking-tighter uppercase mb-2 text-shadow-xl shadow-yellow-500/20">
                        <Target size={36} className="text-yellow-400" />
                        Gestione Budget
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        Pianificazione Finanziaria e Controllo Scostamenti
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-black/40 p-2 rounded-xl border border-white/10 backdrop-blur-md">
                    <span className="text-xs uppercase text-gray-400 font-bold hidden sm:inline-block">Riferimento:</span>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="bg-cyber-card border border-yellow-500/30 text-white rounded px-3 py-1 text-sm outline-none font-bold">
                        <option value="2023">2023</option>
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                    </select>
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="bg-cyber-card border border-yellow-500/30 text-white rounded px-3 py-1 text-sm outline-none font-bold">
                        <option value="01">Gennaio</option>
                        <option value="02">Febbraio</option>
                        <option value="03">Marzo</option>
                        <option value="04">Aprile</option>
                        <option value="05">Maggio</option>
                        <option value="06">Giugno</option>
                        <option value="07">Luglio</option>
                        <option value="08">Agosto</option>
                        <option value="09">Settembre</option>
                        <option value="10">Ottobre</option>
                        <option value="11">Novembre</option>
                        <option value="12">Dicembre</option>
                    </select>
                </div>
            </div>

            {error && <div className="p-4 mb-6 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg">{error}</div>}

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-panel p-6 rounded-xl border-l-4 border-l-yellow-500 relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform"><PiggyBank size={120} /></div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Budget Mese Allocato</p>
                    <h3 className="text-4xl font-bold font-mono text-white">€ {num(totalBudget)}</h3>
                </div>
                <div className="glass-panel p-6 rounded-xl border-l-4 border-l-neon-pink relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform"><Target size={120} /></div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Spesa Effettiva (Consuntivo)</p>
                    <h3 className="text-4xl font-bold font-mono text-neon-pink">€ {num(totalSpend)}</h3>
                </div>
                <div className={`glass-panel p-6 rounded-xl border-l-4 relative overflow-hidden group ${isVariancePositive ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform">
                        {isVariancePositive ? <TrendingDown size={120} /> : <TrendingUp size={120} />}
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Varianza Residua</p>
                    <h3 className={`text-4xl font-bold font-mono ${isVariancePositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isVariancePositive ? '+' : '-'} € {num(Math.abs(totalVariance))}
                    </h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Form Column */}
                <form onSubmit={saveBudget} className="glass-panel p-6 rounded-xl border border-yellow-500/20 bg-black/60 sticky top-24">
                    <h3 className="font-bold text-lg mb-6 text-yellow-400 uppercase tracking-widest border-b border-yellow-500/20 pb-2 flex items-center gap-2">
                        <Edit2 size={18} />
                        {form.id ? 'Modifica Allocazione' : 'Nuova Allocazione'}
                    </h3>

                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Anno</label>
                                <input required type="number" min="2020" max="2100" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Mese</label>
                                <input required type="number" min="1" max="12" value={form.month} onChange={e => setForm({ ...form, month: e.target.value.padStart(2, '0') })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none font-mono" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Canale / Fonte</label>
                            <select required value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full bg-cyber-bg border border-white/20 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none">
                                <option value="">Seleziona Fonte...</option>
                                {sources.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Ammontare Budget (€)</label>
                            <input required type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full bg-cyber-bg border border-yellow-500/50 rounded p-3 text-lg text-yellow-400 font-bold focus:border-yellow-400 outline-none font-mono placeholder:text-gray-700" placeholder="e.g. 500.00" />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-wider py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                                Sincronizza
                            </button>
                            {form.id && (
                                <button type="button" onClick={() => setForm({ ...form, id: '', source: '', amount: '' })} className="px-4 border border-white/20 rounded-lg hover:bg-white/10 text-white font-bold">Annulla</button>
                            )}
                        </div>
                    </div>
                </form>

                {/* Tabs & Data Column */}
                <div className="lg:col-span-2 flex flex-col h-full">

                    <div className="flex border-b border-white/10 bg-black/40 p-2 gap-2 rounded-t-xl hide-scrollbar overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('planning')}
                            className={`px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap
                                ${activeTab === 'planning' ? 'bg-yellow-500/20 text-yellow-400 shadow-[inset_0_0_10px_rgba(234,179,8,0.3)]' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                        >
                            Lista Allocazioni
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap
                                ${activeTab === 'report' ? 'bg-neon-blue/20 text-neon-blue shadow-[inset_0_0_10px_rgba(0,242,254,0.3)]' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                        >
                            Report Consuntivo (Budget vs Actual)
                        </button>
                    </div>

                    <div className="glass-panel p-0 rounded-b-xl flex-1 relative min-h-[400px]">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 backdrop-blur-sm">
                                <Target size={40} className="text-yellow-500 animate-spin" />
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {/* TAB: LISTA ALLOCAZIONI */}
                            {!loading && activeTab === 'planning' && (
                                <motion.div key="planning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-0 overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="bg-black/80 sticky top-0 backdrop-blur-md">
                                            <tr>
                                                <th className="p-4 text-yellow-500 font-bold uppercase text-xs border-b border-white/10">Periodo</th>
                                                <th className="p-4 text-yellow-500 font-bold uppercase text-xs border-b border-white/10">Fonte Assegnata</th>
                                                <th className="p-4 text-yellow-500 font-bold uppercase text-xs border-b border-white/10 text-right">Valore (€)</th>
                                                <th className="p-4 text-yellow-500 font-bold uppercase text-xs border-b border-white/10 text-center">Azioni</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {budgets.map((b: any) => (
                                                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-mono text-gray-400">{b.year}-{String(b.month).padStart(2, '0')}</td>
                                                    <td className="p-4"><span className="bg-white/10 px-2 py-1 rounded text-xs text-white">{b.source}</span></td>
                                                    <td className="p-4 text-right font-mono font-bold text-yellow-400">€ {num(b.planned_budget)}</td>
                                                    <td className="p-4 flex justify-center gap-2">
                                                        <button onClick={() => setForm({ id: b.id, year: b.year.toString(), month: String(b.month).padStart(2, '0'), source: b.source, amount: b.planned_budget.toString() })} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded"><Edit2 size={16} /></button>
                                                        <button onClick={() => deleteBudget(b.id)} className="p-2 text-red-500/80 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {!budgets.length && <tr><td colSpan={4} className="p-12 text-center text-gray-500 italic">Nessun budget inserito per {yearFilter}-{monthFilter}.</td></tr>}
                                        </tbody>
                                        {budgets.length > 0 && (
                                            <tfoot className="bg-white/5 font-bold">
                                                <tr>
                                                    <td colSpan={2} className="p-4 border-t border-white/20 text-right uppercase text-xs text-gray-400">Totale Allocato:</td>
                                                    <td className="p-4 border-t border-white/20 text-right font-mono text-yellow-400">€ {num(budgets.reduce((s, b) => s + b.planned_budget, 0))}</td>
                                                    <td className="p-4 border-t border-white/20"></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </motion.div>
                            )}

                            {/* TAB: CONSUNTIVO */}
                            {!loading && activeTab === 'report' && (
                                <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-0 overflow-x-auto">
                                    <div className="p-4 bg-neon-blue/10 border-b border-neon-blue/20 text-sm text-neon-blue flex items-start gap-3">
                                        <Info size={18} className="shrink-0 mt-0.5" />
                                        <p>Il report consuntivo confronta i budget allocati con la spesa reale aggregata da CSV e Inserimenti Manuali per lo stesso mese/fonte.</p>
                                    </div>
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="bg-black/80 sticky top-0 backdrop-blur-md">
                                            <tr>
                                                <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10">Fonte</th>
                                                <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10 text-right">Budget</th>
                                                <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10 text-right">Spesa</th>
                                                <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10 text-right">Varianza</th>
                                                <th className="p-4 text-neon-blue font-bold uppercase text-xs border-b border-white/10 text-center">Stato</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.map((r: any, i: number) => {
                                                const planned = r.planned_budget || 0;
                                                const actual = r.actual_spend || 0;
                                                const varAmt = planned - actual;
                                                const isUnder = varAmt >= 0;
                                                return (
                                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                        <td className="p-4 font-bold text-gray-200">{r.source}</td>
                                                        <td className="p-4 text-right font-mono text-yellow-400">€ {num(planned)}</td>
                                                        <td className="p-4 text-right font-mono text-neon-pink">€ {num(actual)}</td>
                                                        <td className={`p-4 text-right font-mono font-bold ${isUnder ? 'text-green-500' : 'text-red-500'}`}>
                                                            {isUnder ? '+' : ''}€ {num(varAmt)}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {isUnder ?
                                                                <span className="text-[10px] uppercase bg-green-500/10 text-green-500 px-2 py-1 rounded border border-green-500/20">OK</span> :
                                                                <span className="text-[10px] uppercase bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20">OVER</span>
                                                            }
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {!report.length && <tr><td colSpan={5} className="p-12 text-center text-gray-500 italic">Nessun dato di scostamento calcolabile nel periodo.</td></tr>}
                                        </tbody>
                                        {report.length > 0 && (
                                            <tfoot className="bg-white/5 font-bold">
                                                <tr>
                                                    <td className="p-4 border-t border-white/20 text-right uppercase text-xs text-gray-400">Totali:</td>
                                                    <td className="p-4 border-t border-white/20 text-right font-mono text-yellow-500">€ {num(totalBudget)}</td>
                                                    <td className="p-4 border-t border-white/20 text-right font-mono text-neon-pink">€ {num(totalSpend)}</td>
                                                    <td className={`p-4 border-t border-white/20 text-right font-mono ${isVariancePositive ? 'text-green-500' : 'text-red-500'}`}>
                                                        {isVariancePositive ? '+' : '-'}€ {num(Math.abs(totalVariance))}
                                                    </td>
                                                    <td className="p-4 border-t border-white/20"></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BudgetsPage;
