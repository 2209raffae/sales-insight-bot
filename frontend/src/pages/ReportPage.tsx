import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Printer, Activity } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:4000/api';

const ReportPage = () => {
    const [periodType, setPeriodType] = useState('month');
    const [specificPeriod, setSpecificPeriod] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reportData, setReportData] = useState<any[]>([]);

    const fetchReport = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE_URL}/report/general?period=${periodType}`);
            const payload = res.data?.data || [];
            setReportData(payload);
            // reset specific period if it doesn't exist in new data
            const unique = [...new Set(payload.map((r: any) => r.period))].sort().reverse();
            if (specificPeriod && !unique.includes(specificPeriod)) {
                setSpecificPeriod('');
            }
        } catch (err: any) {
            console.error(err);
            setError('Impossibile caricare il report generale.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [periodType]);

    const handlePrint = () => {
        window.print();
    };

    const num = (v: number | string | null) => {
        if (v === null || v === undefined) return '-';
        return Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const uniquePeriods = [...new Set(reportData.map(r => r.period))].sort().reverse();

    // Grouping data
    const grouped: Record<string, any> = {};
    reportData.forEach(row => {
        if (specificPeriod && row.period !== specificPeriod) return;

        if (!grouped[row.period]) {
            grouped[row.period] = {
                totals: { leads: 0, winning_leads: 0, spend: 0, budget: 0 },
                rows: []
            };
        }
        grouped[row.period].rows.push(row);
        grouped[row.period].totals.leads += row.leads;
        grouped[row.period].totals.winning_leads += row.winning_leads;
        grouped[row.period].totals.spend += row.spend;
        grouped[row.period].totals.budget += row.budget;
    });

    const periods = Object.keys(grouped).sort().reverse();

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 min-h-screen flex flex-col">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 no-print">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black text-emerald-400 tracking-tighter uppercase mb-2 text-shadow-xl shadow-emerald-500/20">
                        <FileText size={36} className="text-emerald-400" />
                        Report Generale
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        Aggregazione completa di metriche Leads e Spese nel tempo.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-black/40 p-2 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase text-gray-400 font-bold">Filtro:</span>
                        <select value={specificPeriod} onChange={e => setSpecificPeriod(e.target.value)} className="bg-cyber-card border border-emerald-500/30 text-white rounded px-3 py-1.5 text-sm outline-none">
                            <option value="">Tutti i periodi</option>
                            {uniquePeriods.map((p: any) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="h-6 w-px bg-white/10 hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase text-gray-400 font-bold">Aggregazione:</span>
                        <select value={periodType} onChange={e => setPeriodType(e.target.value)} className="bg-cyber-card border border-emerald-500/30 text-white rounded px-3 py-1.5 text-sm outline-none font-bold text-emerald-400">
                            <option value="month">Mensile</option>
                            <option value="quarter">Trimestrale</option>
                            <option value="semester">Semestrale</option>
                        </select>
                    </div>

                    <button onClick={fetchReport} className="bg-white/5 border border-white/10 hover:bg-white/10 p-2 rounded-lg transition-colors">
                        <Activity size={18} className="text-emerald-500" />
                    </button>

                    <button onClick={handlePrint} className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white px-4 py-1.5 rounded-lg transition-all text-sm font-bold uppercase tracking-wider">
                        <Printer size={16} /> Stampa
                    </button>
                </div>
            </div>

            {error && <div className="p-4 mb-6 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg">{error}</div>}

            <div className="glass-panel p-0 rounded-xl flex-1 relative print-friendly overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 backdrop-blur-sm">
                        <FileText size={40} className="text-emerald-500 animate-pulse" />
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {!loading && (
                        <motion.div key={periodType + specificPeriod} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-0 overflow-x-auto print-overflow-visible">
                            <table className="w-full text-left border-collapse text-sm print-table">
                                <thead className="bg-black/90 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="p-4 text-emerald-400 font-bold uppercase tracking-wider text-xs border-b border-white/10">Dettaglio (Fonte)</th>
                                        <th className="p-4 text-emerald-400 font-bold uppercase tracking-wider text-xs border-b border-white/10 text-right">Leads</th>
                                        <th className="p-4 text-emerald-400 font-bold uppercase tracking-wider text-xs border-b border-white/10 text-right">Vincenti</th>
                                        <th className="p-4 text-emerald-400 font-bold uppercase tracking-wider text-xs border-b border-white/10 text-right">Spesa (€)</th>
                                        <th className="p-4 text-emerald-400 font-bold uppercase tracking-wider text-xs border-b border-white/10 text-right text-gray-400">Budget (€)</th>
                                        <th className="p-4 text-emerald-400 font-bold uppercase tracking-wider text-xs border-b border-white/10 text-right text-yellow-500">CPL Medio (€)</th>
                                        <th className="p-4 text-emerald-400 font-bold uppercase tracking-wider text-xs border-b border-white/10 text-right text-neon-blue">CPL Vincente (€)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {periods.length === 0 ? (
                                        <tr><td colSpan={7} className="p-12 text-center text-gray-500 italic">Nessun dato disponibile per questo scenario.</td></tr>
                                    ) : (
                                        periods.map(p => {
                                            const group = grouped[p];
                                            const t = group.totals;
                                            const avgCpl = t.leads > 0 ? (t.spend / t.leads) : 0;
                                            const avgCplWinning = t.winning_leads > 0 ? (t.spend / t.winning_leads) : 0;

                                            return (
                                                <React.Fragment key={p}>
                                                    {/* Trx Intestazione Periodo */}
                                                    <tr className="bg-emerald-500/10 border-b border-emerald-500/20">
                                                        <td colSpan={7} className="p-4 font-black text-emerald-400 tracking-wider text-lg uppercase shadow-[inset_0_4px_10px_rgba(16,185,129,0.05)]">{p}</td>
                                                    </tr>

                                                    {/* Trx Dettaglio Fonti */}
                                                    {group.rows.sort((a: any, b: any) => b.spend - a.spend).map((r: any, i: number) => (
                                                        <tr key={`${p}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                            <td className="p-3 pl-8 text-gray-300 font-bold uppercase text-xs tracking-wider">{r.source}</td>
                                                            <td className="p-3 text-right font-mono">{r.leads}</td>
                                                            <td className="p-3 text-right font-mono text-neon-blue">{r.winning_leads}</td>
                                                            <td className="p-3 text-right font-mono text-emerald-400">€ {num(r.spend)}</td>
                                                            <td className="p-3 text-right font-mono text-gray-500">€ {num(r.budget)}</td>
                                                            <td className="p-3 text-right font-mono text-yellow-500">€ {num(r.cpl)}</td>
                                                            <td className="p-3 text-right font-mono text-neon-purple font-bold">€ {num(r.cpl_winning)}</td>
                                                        </tr>
                                                    ))}

                                                    {/* Trx Totali Periodo */}
                                                    <tr className="bg-black/40 border-b-2 border-emerald-500/30 font-bold">
                                                        <td className="p-4 pl-8 uppercase text-xs tracking-widest text-emerald-400">Totale {p}</td>
                                                        <td className="p-4 text-right font-mono text-white text-lg">{t.leads}</td>
                                                        <td className="p-4 text-right font-mono text-neon-blue text-lg">{t.winning_leads}</td>
                                                        <td className="p-4 text-right font-mono text-emerald-400 text-lg shadow-emerald">€ {num(t.spend)}</td>
                                                        <td className="p-4 text-right font-mono text-gray-500 text-lg">€ {num(t.budget)}</td>
                                                        <td className="p-4 text-right font-mono text-yellow-500 text-lg">€ {num(avgCpl)}</td>
                                                        <td className="p-4 text-right font-mono text-neon-purple text-lg shadow-purple">€ {num(avgCplWinning)}</td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Print Styles injected in JSX to keep Component encapsulated */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    .no-print { display: none !important; }
                    .glass-panel { background: white !important; border: none !important; box-shadow: none !important; color: black !important; }
                    .text-emerald-400, .text-neon-blue, .text-neon-purple, .text-yellow-500, .text-gray-400, .text-gray-300 { color: black !important; text-shadow: none !important; }
                    body { background: white !important; }
                    .print-table { width: 100% !important; font-size: 11px !important; }
                    .print-table th, .print-table td { border: 1px solid #ccc !important; color: black !important; padding: 6px !important; }
                    .print-table thead { background: #eee !important; position: static !important; }
                    tr.bg-emerald-500\\/10 { background-color: #f0f0f0 !important; }
                    tr.bg-black\\/40 { background-color: #ddd !important; }
                    .print-overflow-visible { overflow: visible !important; }
                }
            `}} />
        </div>
    );
};

export default ReportPage;
