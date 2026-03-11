import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Activity, Filter, AlertTriangle, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import axios from 'axios';

const API_BASE_URL = '/api';

const LeadsPage = () => {
    const [activeTab, setActiveTab] = useState('status');
    const [staleDays, setStaleDays] = useState(3);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [data, setData] = useState<any>({
        status: null,
        source: null,
        aging: null,
        operators: null,
        summary: null
    });

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            // Check if leads exist first
            const statusCheck = await axios.get(`${API_BASE_URL}/leads/status`);
            if (!statusCheck.data.ready) {
                setError('Nessun dato leads caricato. Effettua prima l\'upload dei dati nel modulo Database.');
                setLoading(false);
                return;
            }

            const [byStatusRes, bySourceRes, agingRes, byOpRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/kpi/leads/by-status`),
                axios.get(`${API_BASE_URL}/kpi/leads/by-source`),
                axios.get(`${API_BASE_URL}/kpi/leads/aging?days=${staleDays}`),
                axios.get(`${API_BASE_URL}/kpi/leads/by-operator`)
            ]);

            const statusRows = byStatusRes.data.leads_by_status || [];
            const openCount = statusRows
                .filter((r: any) => ['da lavorare', 'aperto', 'open', 'nuovo', 'assegnato', 'in lavorazione', 'pending', 'new', 'assigned']
                    .includes((r.status || '').toLowerCase()))
                .reduce((s: number, r: any) => s + r.count, 0);

            setData({
                status: byStatusRes.data.leads_by_status || [],
                source: bySourceRes.data.leads_by_source || [],
                aging: agingRes.data,
                operators: byOpRes.data.operator_workload || [],
                summary: {
                    total: byStatusRes.data.total_leads || 0,
                    openCount: openCount,
                    uniqueStatus: statusRows.length
                }
            });
        } catch (err: any) {
            console.error(err);
            setError('Errore di connessione al database centrale.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [staleDays]);

    const num = (v: number) => Number(v).toLocaleString('it-IT');

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 min-h-screen flex flex-col">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-blue to-neon-purple text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                        <Users size={36} className="text-neon-blue" />
                        Dashboard Leads
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        <span className="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></span>
                        Metriche Deterministiche e Analisi Aging
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-black/40 p-2 lg:p-3 rounded-xl border border-white/10 backdrop-blur-md">
                    <span className="text-xs uppercase text-gray-400 font-bold flex items-center gap-2"><Filter size={14} /> Soglia Inattività:</span>
                    <input
                        type="number"
                        value={staleDays}
                        onChange={(e) => setStaleDays(parseInt(e.target.value) || 0)}
                        className="w-16 bg-cyber-card border border-neon-blue/30 text-white text-center rounded-md py-1 focus:outline-none focus:border-neon-blue font-mono"
                    />
                    <span className="text-xs text-gray-500 uppercase">Giorni</span>
                </div>
            </div>

            {error && (
                <div className="glass-panel border-red-500/50 p-6 rounded-xl flex items-center gap-4 mb-8 bg-red-500/10 text-red-200">
                    <AlertTriangle size={24} className="text-red-500 shrink-0" />
                    <div>
                        <h4 className="font-bold uppercase tracking-wider mb-1">Anomalia di Sistema</h4>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {!error && data.summary && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="glass-panel p-6 rounded-xl border-l-4 border-l-neon-blue relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform"><Users size={120} /></div>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Leads Totali Acquisiti</p>
                            <h3 className="text-4xl font-bold font-mono">{num(data.summary.total)}</h3>
                        </div>
                        <div className="glass-panel p-6 rounded-xl border-l-4 border-l-yellow-400 relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform"><Activity size={120} /></div>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Aperti / In Lavorazione</p>
                            <div className="flex items-end gap-3">
                                <h3 className="text-4xl font-bold font-mono text-yellow-400">{num(data.summary.openCount)}</h3>
                                <span className="text-sm text-yellow-400/70 mb-1">{data.summary.total ? ((data.summary.openCount / data.summary.total) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>
                        <div className="glass-panel p-6 rounded-xl border-l-4 border-l-neon-purple relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform"><UserCheck size={120} /></div>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Stati Unici CRM</p>
                            <h3 className="text-4xl font-bold font-mono text-neon-purple">{data.summary.uniqueStatus}</h3>
                        </div>
                    </div>

                    <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden">
                        <div className="flex overflow-x-auto border-b border-white/10 bg-black/40 p-2 gap-2 hide-scrollbar">
                            {[
                                { id: 'status', label: 'Per Stato' },
                                { id: 'source', label: 'Origine' },
                                { id: 'aging', label: 'Analisi Aging' },
                                { id: 'operators', label: 'Operatori' },
                                { id: 'risks', label: 'Rischi', badge: data.aging?.total_at_risk }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2
                                        ${activeTab === tab.id
                                            ? 'bg-neon-blue/20 text-neon-blue shadow-[inset_0_0_10px_rgba(0,242,254,0.3)]'
                                            : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                                >
                                    {tab.label}
                                    {tab.badge > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">{tab.badge}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 flex-1 min-h-[400px] relative">
                            {loading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 backdrop-blur-sm">
                                    <Activity size={40} className="text-neon-blue animate-spin" />
                                </div>
                            ) : null}

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full w-full"
                                >
                                    {/* STATUS TAB */}
                                    {activeTab === 'status' && (
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.status} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#22222a" horizontal={false} />
                                                    <XAxis type="number" stroke="#666" tick={{ fill: '#666' }} />
                                                    <YAxis dataKey="status" type="category" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} width={120} />
                                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111116', border: '1px solid #00f2fe' }} />
                                                    <Bar dataKey="count" fill="#00f2fe" radius={[0, 4, 4, 0]}>
                                                        {data.status.map((_: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#00f2fe' : '#4facfe'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}

                                    {/* SOURCE TAB */}
                                    {activeTab === 'source' && (
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.source} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#22222a" horizontal={false} />
                                                    <XAxis type="number" stroke="#666" />
                                                    <YAxis dataKey="source" type="category" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} width={120} />
                                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111116', border: '1px solid #b026ff' }} />
                                                    <Bar dataKey="count" fill="#b026ff" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}

                                    {/* AGING TAB */}
                                    {activeTab === 'aging' && data.aging && (
                                        <div className="flex flex-col h-full gap-6">
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                {[
                                                    { l: 'Età Media', v: `${data.aging.aging_summary.avg_age_days.toFixed(1)} gg` },
                                                    { l: 'Mediana', v: `${data.aging.aging_summary.median_age_days.toFixed(1)} gg` },
                                                    { l: 'Max Età', v: `${data.aging.aging_summary.max_age_days.toFixed(1)} gg` },
                                                    { l: 'Min Età', v: `${data.aging.aging_summary.min_age_days.toFixed(1)} gg` }
                                                ].map((s, i) => (
                                                    <div key={i} className="bg-black/30 border border-white/5 rounded-lg p-4 text-center">
                                                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{s.l}</div>
                                                        <div className="font-mono text-xl text-white">{s.v}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex-1 min-h-[250px] w-full mt-4">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={data.aging.aging_buckets} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#22222a" vertical={false} />
                                                        <XAxis dataKey="bucket" stroke="#666" tick={{ fill: '#ccc', fontSize: 12 }} />
                                                        <YAxis stroke="#666" />
                                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111116', border: '1px solid #ff007f' }} />
                                                        <Bar dataKey="count" fill="#ff007f" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {/* OPERATORS TAB */}
                                    {activeTab === 'operators' && (
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.operators} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#22222a" horizontal={false} />
                                                    <XAxis type="number" stroke="#666" />
                                                    <YAxis dataKey="operator" type="category" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} width={120} />
                                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111116', border: '1px solid #10b981' }} />
                                                    <Bar dataKey="total_leads" fill="#10b981" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}

                                    {/* RISKS TAB */}
                                    {activeTab === 'risks' && data.aging && (
                                        <div className="flex flex-col h-full">
                                            <div className="mb-4 text-sm text-gray-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg flex items-center gap-3">
                                                <AlertTriangle size={18} className="text-red-500" />
                                                <span>Questa tabella mostra un campione di leads aperti con età superiore alla soglia di inattività configurata ({staleDays} gg).</span>
                                            </div>
                                            <div className="flex-1 overflow-auto border border-white/10 rounded-lg">
                                                <table className="w-full text-left border-collapse text-sm">
                                                    <thead className="bg-black/80 sticky top-0 z-10 backdrop-blur-md">
                                                        <tr>
                                                            <th className="p-3 text-neon-blue font-bold uppercase tracking-wider text-xs border-b border-white/10">ID Lead</th>
                                                            <th className="p-3 text-neon-blue font-bold uppercase tracking-wider text-xs border-b border-white/10">Stato</th>
                                                            <th className="p-3 text-neon-blue font-bold uppercase tracking-wider text-xs border-b border-white/10">Fonte</th>
                                                            <th className="p-3 text-neon-blue font-bold uppercase tracking-wider text-xs border-b border-white/10">Operatore</th>
                                                            <th className="p-3 text-neon-blue font-bold uppercase tracking-wider text-xs border-b border-white/10 text-right">Età (gg)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {data.aging.sample_at_risk_leads?.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="p-8 text-center text-gray-500">Nessun lead a rischio rilevato in questo range.</td>
                                                            </tr>
                                                        ) : (
                                                            data.aging.sample_at_risk_leads?.map((r: any, i: number) => (
                                                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                                    <td className="p-3 font-mono text-gray-300">{r.lead_id}</td>
                                                                    <td className="p-3"><span className="bg-white/10 px-2 py-1 rounded text-xs">{r.status}</span></td>
                                                                    <td className="p-3">{r.source || '-'}</td>
                                                                    <td className="p-3">{r.operator || r.assignee || '-'}</td>
                                                                    <td className="p-3 text-right text-red-400 font-mono font-bold">{r.age_days?.toFixed(1)}</td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default LeadsPage;
