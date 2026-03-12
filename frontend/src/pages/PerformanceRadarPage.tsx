import { useState, useEffect } from 'react';
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

    // Carica la lista dipendenti al mount
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
        <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 pb-20 mt-4 sm:mt-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-['Space_Grotesk'] text-white flex items-center gap-3">
                        <Activity className="text-neon-blue" size={32} />
                        Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-cyan">Radar</span>
                    </h1>
                    <p className="text-slate-400 mt-2">Monitora KPIs dei dipendenti e ricevi feedback costruttivi generati dall'AI.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Sidebar Dipendenti */}
                <div className="lg:col-span-4 glass-panel rounded-2xl p-4 border border-white/5 flex flex-col h-[600px] overflow-hidden">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Users size={16} className="text-neon-cyan" />
                        Team Roster
                    </h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {employees.map(emp => (
                            <button
                                key={emp.id}
                                onClick={() => handleSelectEmployee(emp.id)}
                                className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center ${selectedEmp === emp.id
                                    ? 'bg-neon-blue/10 border-neon-blue/40 shadow-[0_0_15px_rgba(0,210,255,0.15)]'
                                    : 'bg-black/30 border-white/5 hover:border-white/20'
                                    }`}
                            >
                                <div>
                                    <div className="font-bold text-slate-100">{emp.name}</div>
                                    <div className="text-xs text-slate-400 font-mono mt-1">{emp.department}</div>
                                </div>
                                {/* Piccolo indicatore visivo */}
                                <div className={`w-2 h-2 rounded-full ${emp.productivity_score >= 80 ? 'bg-neon-green shadow-[0_0_8px_rgba(16,185,129,0.8)]' : emp.productivity_score >= 60 ? 'bg-neon-amber' : 'bg-red-500'}`} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dashoard Dettaglio */}
                <div className="lg:col-span-8 glass-panel rounded-2xl p-6 border border-white/5 relative overflow-hidden flex flex-col min-h-[600px]">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 blur-[80px] pointer-events-none" />

                    {errorMSG && (
                        <div className="text-red-400 text-sm flex items-center gap-2 bg-red-500/10 p-3 rounded-lg border border-red-500/20 mb-4">
                            <AlertCircle size={16} /> {errorMSG}
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex-1 flex flex-col items-center justify-center text-neon-blue gap-4 animate-pulse">
                            <RefreshCw size={40} className="animate-spin" />
                            <p className="text-sm font-semibold tracking-widest uppercase">Estrazione Metriche & AI Review...</p>
                        </div>
                    )}

                    {!isLoading && data && (
                        <div className="flex flex-col h-full z-10 space-y-6">
                            {/* Header metrics */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xs uppercase text-slate-400 font-bold mb-1">Productivity</span>
                                    <span className="text-3xl font-black text-neon-cyan drop-shadow-[0_0_10px_rgba(0,210,255,0.4)]">
                                        {data.employee.productivity_score}
                                    </span>
                                </div>
                                <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xs uppercase text-slate-400 font-bold mb-1">Goals Met</span>
                                    <span className="text-3xl font-black text-neon-purple drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                                        {data.employee.goals_met_percent}%
                                    </span>
                                </div>
                                <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xs uppercase text-slate-400 font-bold mb-1">Peer Rating</span>
                                    <span className="text-3xl font-black text-neon-green drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                                        {data.employee.peer_feedback_score}<span className="text-lg text-slate-500">/5</span>
                                    </span>
                                </div>
                            </div>

                            {/* Trend Visivo (Mock Bar Chart inline) */}
                            <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-neon-cyan" />
                                    Trend Produttività (Ultimi Mesi)
                                </h4>
                                <div className="flex items-end justify-between h-32 gap-2 pt-4 border-b border-t-white/10 border-b-white/10 border-x-transparent text-xs text-slate-400">
                                    {data.monthly_trend.map((t, idx) => (
                                        <div key={idx} className="flex flex-col items-center flex-1 gap-2">
                                            <div className="w-full max-w-[40px] bg-gradient-to-t from-neon-blue/20 to-neon-cyan/80 rounded-t-sm transition-all duration-1000 ease-out flex items-start justify-center pt-1 shadow-[0_-5px_15px_rgba(0,210,255,0.2)]"
                                                style={{ height: `${t.productivity}%` }}>
                                                <span className="font-bold text-white opacity-80">{t.productivity}</span>
                                            </div>
                                            <span className="font-mono">{t.month}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AI Feedback */}
                            <div className="flex-1 bg-gradient-to-br from-neon-purple/5 to-transparent rounded-xl p-5 border border-neon-purple/20 shadow-[0_0_30px_rgba(168,85,247,0.05)] overflow-y-auto">
                                <h4 className="text-sm font-bold text-neon-purple uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Zap size={16} />
                                    AI Performance Review (Manager View)
                                </h4>
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed font-sans">
                                    {/* Parsing the markdown from AI playfully */}
                                    {data.ai_feedback.split('\n').map((line, i) => {
                                        if (line.trim() === '') return <br key={i} />;
                                        if (line.startsWith('1)') || line.startsWith('2)') || line.startsWith('3)')) {
                                            return <p key={i} className="font-semibold text-white mt-3 mb-1">{line}</p>;
                                        }
                                        if (line.includes('**')) {
                                            // simple bold parser
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

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PerformanceRadarPage;
