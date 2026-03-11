import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, Users, DollarSign, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = '/api';

const StatCard = ({ title, value, icon: Icon, color, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="glass-panel p-6 rounded-xl relative overflow-hidden group"
    >
        <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-20 pointer-events-none ${color}`}></div>
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-gray-400 text-sm tracking-widest uppercase mb-1">{title}</p>
                <h3 className="text-4xl font-bold tracking-tighter shadow-sm">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg bg-black/50 border border-white/10 ${color.replace('bg-', 'text-')}`}>
                <Icon size={24} />
            </div>
        </div>
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1, delay: delay + 0.2 }}
                className={`h-full ${color}`}
            ></motion.div>
        </div>
    </motion.div>
);

const DashboardPage = () => {
    const [data, setData] = useState({
        leadsSummary: { total: 0, w: 0, l: 0 },
        spendSummary: { total_spend: 0, total_leads: 0, cpl: 0 },
        trend: []
    });
    const [loading, setLoading] = useState(true);

    // Parametri filtro default: mese corrente
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [leadsRes, spendRes, trendRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/kpi/leads/summary?from=${firstDay}&to=${lastDay}`),
                    axios.get(`${API_BASE_URL}/kpi/spend/summary?from=${firstDay}&to=${lastDay}&mode=both`),
                    axios.get(`${API_BASE_URL}/kpi/spend/trend?from=${firstDay}&to=${lastDay}&mode=both`)
                ]);

                setData({
                    leadsSummary: leadsRes.data,
                    spendSummary: spendRes.data,
                    trend: trendRes.data.trend || []
                });
            } catch (error) {
                console.error("Errore fetch dati:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firstDay, lastDay]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Activity size={48} className="text-neon-blue" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-neon-blue to-neon-purple text-transparent bg-clip-text tracking-tighter uppercase uppercase">
                        Sistema di Analisi Principale
                    </h1>
                    <p className="text-gray-400 mt-2 font-light tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Sensori attivi. Dati aggiornati in tempo reale.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-neon-blue border border-neon-blue/30 px-3 py-1 rounded-full bg-neon-blue/10">
                        {firstDay} / {lastDay}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Totale Spesa"
                    value={`€ ${data.spendSummary.total_spend.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    color="bg-neon-pink"
                    delay={0.1}
                />
                <StatCard
                    title="Totale Leads"
                    value={data.leadsSummary.total.toLocaleString('it-IT')}
                    icon={Users}
                    color="bg-neon-blue"
                    delay={0.2}
                />
                <StatCard
                    title="CPL Medio"
                    value={`€ ${data.spendSummary.cpl.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
                    icon={TrendingUp}
                    color="bg-neon-purple"
                    delay={0.3}
                />
                <StatCard
                    title="Lead Vinte"
                    value={data.leadsSummary.w.toLocaleString('it-IT')}
                    icon={Activity}
                    color="bg-green-500"
                    delay={0.4}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Trend Chart */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-panel p-6 rounded-xl"
                >
                    <h3 className="text-xl font-bold mb-6 text-white/90 uppercase tracking-wider">Trend Spesa vs Leads</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff007f" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ff007f" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#00f2fe" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#22222a" />
                                <XAxis dataKey="date" stroke="#666" tick={{ fill: '#666' }} />
                                <YAxis yAxisId="left" stroke="#ff007f" tick={{ fill: '#ff007f' }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#00f2fe" tick={{ fill: '#00f2fe' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111116', border: '1px solid #22222a', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#ff007f" fillOpacity={1} fill="url(#colorSpend)" />
                                <Area yAxisId="right" type="monotone" dataKey="leads" stroke="#00f2fe" fillOpacity={1} fill="url(#colorLeads)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* CPL Gauge/Alerts (Placeholder for advanced insights) */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="glass-panel p-6 rounded-xl flex flex-col"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white/90 uppercase tracking-wider">Stato Sistema</h3>
                        <AlertTriangle className="text-yellow-500" />
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center space-y-8">
                        <div className="relative w-48 h-48 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#22222a" strokeWidth="10" />
                                <motion.circle
                                    cx="50" cy="50" r="45" fill="none" stroke="url(#gradientCPL)" strokeWidth="10"
                                    strokeDasharray="283"
                                    initial={{ strokeDashoffset: 283 }}
                                    animate={{ strokeDashoffset: 283 - (283 * Math.min((data.leadsSummary.w / (data.leadsSummary.total || 1)), 1)) }}
                                    transition={{ duration: 2, delay: 0.8 }}
                                />
                                <defs>
                                    <linearGradient id="gradientCPL" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#00f2fe" />
                                        <stop offset="100%" stopColor="#b026ff" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute text-center">
                                <p className="text-3xl font-bold">{((data.leadsSummary.w / (data.leadsSummary.total || 1)) * 100).toFixed(1)}%</p>
                                <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Win Rate</p>
                            </div>
                        </div>

                        <div className="w-full space-y-4">
                            <div className="bg-black/40 p-4 rounded-lg border border-neon-blue/20 flex justify-between items-center">
                                <span className="text-gray-400">Leads totali acquisiti</span>
                                <span className="font-bold text-neon-blue">{data.leadsSummary.total}</span>
                            </div>
                            <div className="bg-black/40 p-4 rounded-lg border border-neon-purple/20 flex justify-between items-center">
                                <span className="text-gray-400">Spesa totale allocata</span>
                                <span className="font-bold text-neon-purple">€ {data.spendSummary.total_spend.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default DashboardPage;
