import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Layout, AlertCircle, Trash2, Zap, Users } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  QueryForm, 
  ResponseCard, 
  DebugPanel, 
  HistoryPanel, 
  QuickActions 
} from '../components/OrchestratorComponents';

const AIConsolePage = () => {
    const { token, user } = useAuth();
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creatingDemo, setCreatingDemo] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [currentCompany, setCurrentCompany] = useState('');
    const [currentQuery, setCurrentQuery] = useState('');
    const [lastResponse, setLastResponse] = useState<any>(null);
    const [debugMode, setDebugMode] = useState(false);
    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem('nexus_orchestrator_history');
        return saved ? JSON.parse(saved) : [];
    });

    // Payloads for debug and "Riesegui"
    const [requestPayload, setRequestPayload] = useState<any>(null);
    const [lastValidPayload, setLastValidPayload] = useState<any>(null);
    const [localTimestamp, setLocalTimestamp] = useState('');

    const fetchCompanies = async () => {
        try {
            console.log("Fetching companies... (timestamp:", Date.now(), ")");
            const res = await axios.get(`/api/admin/companies?t=${Date.now()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Companies response:", res.data);
            
            let fetchedCompanies = [];
            if (Array.isArray(res.data)) {
                fetchedCompanies = res.data;
            } else if (res.data && typeof res.data === 'object' && Array.isArray(res.data.data)) {
                fetchedCompanies = res.data.data;
            }
            
            console.log(`Fetched ${fetchedCompanies.length} companies.`);
            setCompanies(fetchedCompanies);
            return fetchedCompanies;
        } catch (err: any) {
            console.error('Error fetching companies:', err);
            setError('Impossibile caricare le aziende.');
            return [];
        }
    };

    useEffect(() => {
        if (token) fetchCompanies();
    }, [token]);

    const saveToHistory = (query: string, company_id: number) => {
        const newItem = { query, company_id, timestamp: new Date().toISOString() };
        const newHistory = [newItem, ...history.filter((h: any) => h.query !== query).slice(0, 9)];
        setHistory(newHistory);
        localStorage.setItem('nexus_orchestrator_history', JSON.stringify(newHistory));
    };

    const handleRunQuery = async (overridePayload?: any) => {
        const payload = overridePayload || {
            company_id: currentCompany ? parseInt(currentCompany) : null,
            query: currentQuery?.trim()
        };

        console.log("handleRunQuery invoked with payload:", payload);

        if (!payload.company_id) {
            console.warn("handleRunQuery blocked: company_id is missing");
            setError('Seleziona un\'azienda prima di procedere.');
            return;
        }
        if (!payload.query) {
            console.warn("handleRunQuery blocked: query is missing/empty");
            setError('Inserisci una domanda per l\'IA.');
            return;
        }
        
        setLoading(true);
        setError('');
        
        setRequestPayload(payload);
        setLocalTimestamp(new Date().toLocaleString());

        try {
            const res = await axios.post('/api/runtime/query', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Defensive parsing
            const data = res.data;
            if (!data || typeof data !== 'object') {
                throw new Error("Risposta API non valida (previsto oggetto)");
            }

            setLastResponse(data);
            setLastValidPayload(payload);
            saveToHistory(payload.query, payload.company_id);
        } catch (err: any) {
            const detail = err.response?.data?.detail || err.message;
            setError(`Errore: ${detail}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDemo = async () => {
        setCreatingDemo(true);
        setError('');
        setSuccess('');
        try {
            console.log("Creating demo company...");
            const res = await axios.post('/api/admin/setup-demo', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Setup demo response:", res.data);
            
            // Aspetta un piccolo istante per sicurezza e poi ricarica
            await new Promise(resolve => setTimeout(resolve, 500));
            const updatedList = await fetchCompanies();
            console.log("List updated after creation, count:", updatedList.length);
            
            if (res.data?.id) {
                const newId = res.data.id.toString();
                console.log("Setting current company to:", newId);
                setCurrentCompany(newId);
                setSuccess(`Azienda "${res.data.name}" creata e selezionata con successo!`);
                setTimeout(() => setSuccess(''), 5000);
            }
        } catch (err: any) {
            console.error("Error creating demo:", err.response?.data || err.message);
            setError(`Fallimento creazione demo company: ${err.response?.data?.detail || err.message}`);
        } finally {
            setCreatingDemo(false);
        }
    };

    const handleRunAgain = () => {
        if (lastValidPayload) {
            handleRunQuery(lastValidPayload);
        }
    };

    const loadFromHistory = (item: any) => {
        setCurrentCompany(item.company_id.toString());
        setCurrentQuery(item.query);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem('nexus_orchestrator_history');
    };

    const selectedCompanyObj = companies.find((c: any) => c.id === parseInt(currentCompany));

    if (user?.is_admin !== 1) {
        return (
            <div className="pt-24 pb-12 w-full flex items-center justify-center min-h-screen">
                <div className="glass-panel p-8 rounded-xl text-center border border-red-500/20">
                    <Shield size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Accesso Riservato</h2>
                    <p className="text-slate-400 mt-2 text-sm">Questa console è accessibile solo agli account Admin per finalità di testing.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 px-4 max-w-7xl mx-auto">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-blue to-neon-purple text-transparent bg-clip-text tracking-tighter uppercase">
                        <Layout size={36} className="text-neon-blue" />
                        AI Console
                    </h1>
                    <div className="flex items-center gap-6 mt-4">
                        <Link 
                            to="/admin"
                            className="text-xs uppercase font-bold tracking-widest pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-300 transition-all flex items-center gap-1.5"
                        >
                            <Users size={14} /> Gestione Utenti
                        </Link>
                        <span className="text-xs uppercase font-bold tracking-widest pb-2 border-b-2 border-neon-blue text-white flex items-center gap-1.5">
                            <Zap size={14} className="text-neon-blue" /> AI Console
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-black/40 p-2 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-2">Debug Mode</span>
                    <button 
                        onClick={() => setDebugMode(!debugMode)}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 flex items-center ${debugMode ? 'bg-neon-purple' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute w-4 h-4 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${debugMode ? 'translate-x-6.5' : 'translate-x-1.5'}`} />
                    </button>
                    <span className={`text-[10px] font-black uppercase px-2 ${debugMode ? 'text-neon-purple' : 'text-slate-500'}`}>
                        {debugMode ? 'ON' : 'OFF'}
                    </span>
                </div>
            </div>

            {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span className="flex-1 font-medium">{error}</span>
                    <button onClick={() => setError('')} className="hover:text-white transition-colors">✕</button>
                </motion.div>
            )}

            {success && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-xs flex items-center gap-3">
                    <Zap size={18} className="text-green-400" />
                    <span className="flex-1 font-medium">{success}</span>
                    <button onClick={() => setSuccess('')} className="hover:text-white transition-colors">✕</button>
                </motion.div>
            )}

            {/* Grid Layout */}
            <div className="grid lg:grid-cols-12 gap-6">
                
                {/* Left Column: Form & History */}
                <div className="lg:col-span-4 space-y-6">
                    <QueryForm 
                        companies={companies}
                        onRun={() => {
                            console.log("OnRun Clicked from QueryForm");
                            handleRunQuery();
                        }}
                        onCreateDemo={handleCreateDemo}
                        loading={loading}
                        creatingDemo={creatingDemo}
                        currentCompany={currentCompany}
                        setCurrentCompany={setCurrentCompany}
                        query={currentQuery}
                        setQuery={setCurrentQuery}
                        onRefreshCompanies={fetchCompanies}
                    />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Azioni Rapide</span>
                        </div>
                        <QuickActions 
                            onSelect={(q: string) => setCurrentQuery(q)} 
                            currentCompany={currentCompany}
                        />
                    </div>

                    <div className="pt-4">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recenti</span>
                            <button onClick={clearHistory} className="text-slate-600 hover:text-red-400 p-1 transition-colors">
                                <Trash2 size={12} />
                            </button>
                        </div>
                        <HistoryPanel 
                            history={history} 
                            onLoad={loadFromHistory} 
                            companies={companies} 
                        />
                    </div>
                </div>

                {/* Right Column: Results & Debug */}
                <div className="lg:col-span-8 space-y-6">
                    <ResponseCard 
                        result={lastResponse} 
                        loading={loading} 
                        onRunAgain={handleRunAgain}
                        showDebug={debugMode}
                    />
                    
                    <AnimatePresence>
                        {debugMode && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: 'auto' }} 
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden h-full"
                            >
                                <DebugPanel 
                                    result={lastResponse} 
                                    requestPayload={requestPayload}
                                    localTimestamp={localTimestamp}
                                    selectedCompany={selectedCompanyObj}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!lastResponse && !loading && (
                        <div className="glass-panel p-8 rounded-xl text-center border-dashed border-white/5 opacity-40">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">
                                Inserisci una query e seleziona un'azienda per iniziare il debug
                            </p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default AIConsolePage;
