import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Users, TrendingUp, AlertCircle, RefreshCw, Zap } from 'lucide-react';

interface Employee {
    id: number;
    name: string;
    department: string;
    productivity_score: number;
    goals_met_percent: number;
    peer_feedback_score: number;
}

interface PerformanceData {
    employee: Employee;
    ai_feedback: string;
    monthly_trend: { month: string, productivity: number }[];
}

const PerformanceRadarPage = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
    const [data, setData] = useState<PerformanceData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMSG, setErrorMSG] = useState('');

    useEffect(() => {
        fetch('/api/hr/performance/employees')
            .then(res => res.json())
            .then(data => {
                setEmployees(data);
                if (data.length > 0) handleSelectEmployee(data[0].id);
            })
            .catch(() => setErrorMSG("Impossibile caricare i dipendenti."));
    }, []);

    const handleSelectEmployee = async (id: number) => {
        setSelectedEmp(id);
        setIsLoading(true);
        setErrorMSG('');
        try {
            const res = await fetch(`/api/hr/performance/radar/${id}`);
            if (!res.ok) throw new Error("Errore nel recupero dati performance");
            const result = await res.json();
            setData(result);
        } catch (e: any) {
            setErrorMSG(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 min-h-screen flex flex-col">

            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-blue to-neon-purple text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                        <Activity size={36} className="text-neon-blue" />
                        Performance Radar
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        <span className="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></span>
                        KPI Dipendenti e AI Performance Review
                    </p>
                </div>
            </motion.div>

            {errorMSG && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel border-red-500/50 p-6 rounded-xl flex items-center gap-4 mb-8 bg-red-500/10 text-red-200">
                    <AlertCircle size={24} className="text-red-500 shrink-0" />
                    <div>
                        <h4 className="font-bold uppercase tracking-wider mb-1">Anomalia di Sistema</h4>
                        <p className="text-sm">{errorMSG}</p>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">

                {/* Sidebar Dipendenti */}
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                    className="lg:col-span-4 glass-panel rounded-xl p-5 border-l-4 border-l-neon-purple flex flex-col max-h-[650px] overflow-hidden">
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-bold flex items-center gap-2">
                        <Users size={14} className="text-neon-purple" />
                        Team Roster
                    </h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {employees.map(emp => (
                            <button
                                key={emp.id}
                                onClick={() => handleSelectEmployee(emp.id)}
                                className={`w-full text-left p-3 rounded-lg border transition-all flex justify-between items-center ${selectedEmp === emp.id
                                    ? 'bg-neon-blue/10 border-neon-blue/40 shadow-[0_0_15px_rgba(0,210,255,0.15)]'
                                    : 'bg-black/30 border-white/5 hover:border-white/20 hover:bg-white/5'
                                    }`}
                            >
                                <div>
                                    <div className="font-bold text-sm text-slate-100">{emp.name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-1">{emp.department}</div>
                                </div>
                                <div className={`w-2.5 h-2.5 rounded-full ${emp.productivity_score >= 80 ? 'bg-neon-green shadow-[0_0_8px_rgba(16,185,129,0.8)]' : emp.productivity_score >= 60 ? 'bg-neon-amber' : 'bg-red-500'}`} />
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Dashboard Dettaglio */}
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                    className="lg:col-span-8 glass-panel rounded-xl p-6 relative overflow-hidden flex flex-col min-h-[650px]">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 blur-[80px] pointer-events-none" />

                    {isLoading && (
                        <div className="flex-1 flex flex-col items-center justify-center text-neon-blue gap-4 animate-pulse">
                            <RefreshCw size={40} className="animate-spin" />
                            <p className="text-sm font-semibold tracking-widest uppercase">Estrazione Metriche & AI Review...</p>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {!isLoading && data && (
                            <motion.div key={data.employee.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col h-full z-10 space-y-6">

                                {/* Header metrics */}
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: 'Productivity', value: data.employee.productivity_score, color: 'neon-blue', border: 'border-l-neon-blue' },
                                        { label: 'Goals Met', value: `${data.employee.goals_met_percent}%`, color: 'neon-purple', border: 'border-l-neon-purple' },
                                        { label: 'Peer Rating', value: data.employee.peer_feedback_score, suffix: '/5', color: 'neon-green', border: 'border-l-neon-green' }
                                    ].map((m, i) => (
                                        <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                                            className={`glass-panel p-4 rounded-xl ${m.border} border-l-4 text-center relative overflow-hidden group`}>
                                            <span className="text-xs uppercase text-gray-400 font-bold tracking-wider">{m.label}</span>
                                            <div className={`text-3xl font-black mt-1 text-${m.color}`}>
                                                {m.value}{m.suffix && <span className="text-lg text-slate-500">{m.suffix}</span>}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Trend Visivo */}
                                <div className="glass-panel rounded-xl p-5">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <TrendingUp size={14} className="text-neon-cyan" />
                                        Trend Produttività (Ultimi Mesi)
                                    </h4>
                                    <div className="flex items-end justify-between h-32 gap-2 pt-4 border-b border-white/10 text-xs text-slate-400">
                                        {data.monthly_trend.map((t, idx) => (
                                            <motion.div key={idx} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.1 * idx, duration: 0.5 }}
                                                className="flex flex-col items-center flex-1 gap-2" style={{ transformOrigin: 'bottom' }}>
                                                <div className="w-full max-w-[40px] bg-gradient-to-t from-neon-blue/20 to-neon-cyan/80 rounded-t-sm flex items-start justify-center pt-1 shadow-[0_-5px_15px_rgba(0,210,255,0.2)]"
                                                    style={{ height: `${t.productivity}%` }}>
                                                    <span className="font-bold text-white opacity-80">{t.productivity}</span>
                                                </div>
                                                <span className="font-mono">{t.month}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* AI Feedback */}
                                <div className="flex-1 glass-panel rounded-xl p-5 border-l-4 border-l-neon-pink overflow-y-auto">
                                    <h4 className="text-xs font-bold text-neon-pink uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Zap size={14} />
                                        AI Performance Review
                                    </h4>
                                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
                                        {data.ai_feedback.split('\n').map((line, i) => {
                                            if (line.trim() === '') return <br key={i} />;
                                            if (line.includes('**')) {
                                                const parts = line.split('**');
                                                return (
                                                    <p key={i} className="my-1">
                                                        {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-neon-cyan">{p}</strong> : p)}
                                                    </p>
                                                );
                                            }
                                            return <p key={i} className="my-1">{line}</p>;
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
};

export default PerformanceRadarPage;
