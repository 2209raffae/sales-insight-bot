import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Plus, MessageSquare, Send, X, Shield,
    Calendar, CheckCircle, Search, UserPlus, Trash2, Cpu, Check
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Project {
    id: number;
    name: string;
    description: string;
    status: string;
    created_at: string;
    created_by: number;
}

interface Member {
    id: number;
    user_id: number;
    role: string;
    first_name: string;
    last_name: string;
    email: string;
}

interface Update {
    id: number;
    author_id: number;
    author_name: string;
    content: string;
    attachment_path?: string;
    attachment_type?: string;
    created_at: string;
}

interface Todo {
    id: number;
    project_id: number;
    content: string;
    assigned_to: number | null;
    is_done: number;
    created_at: string;
}

interface ProjectDetail extends Project {
    members: Member[];
    updates: Update[];
    todos?: Todo[]; // Local extension
}

interface SuggestedMember {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    matched_categories: string[];
}

const TaskForcePage = () => {
    const { user, token } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modals state
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    // AI Suggestion state
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestedMembers, setSuggestedMembers] = useState<SuggestedMember[]>([]);
    const [selectedSugIds, setSelectedSugIds] = useState<number[]>([]);

    // Add Member search
    const [allUsers, setAllUsers] = useState<{ id: number, first_name: string, last_name: string, email: string }[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');

    // New Update state
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [sendingUpdate, setSendingUpdate] = useState(false);
    const [showSentCheck, setShowSentCheck] = useState(false);

    // Tasks/Tabs state
    const [activeTab, setActiveTab] = useState<'briefing' | 'tasks' | 'chat'>('briefing');
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTodoContent, setNewTodoContent] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState<number | ''>('');
    const [isAddingTodo, setIsAddingTodo] = useState(false);

    // Briefing state
    const [briefingMd, setBriefingMd] = useState('');
    const [isSavingBriefing, setIsSavingBriefing] = useState(false);
    const [isEditingBriefing, setIsEditingBriefing] = useState(false);

    // SITREP state
    const [isSitrepModalOpen, setIsSitrepModalOpen] = useState(false);
    const [sitrepContent, setSitrepContent] = useState('');
    const [isGeneratingSitrep, setIsGeneratingSitrep] = useState(false);

    useEffect(() => {
        if (!token) return;
        fetchProjects();
        // Qualunque utente può vedere la lista operatori base per invitare
        axios.get('/api/taskforce/operators', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setAllUsers(res.data)).catch(console.error);
    }, [token]);

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/taskforce/projects', { headers: { Authorization: `Bearer ${token}` } });
            setProjects(res.data);
            if (res.data.length > 0 && !selectedProject) {
                fetchProjectDetail(res.data[0].id);
            }
        } catch (err: any) {
            setError('Errore caricamento progetti Task Force.');
        } finally {
            setLoading(false);
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (selectedProject?.updates) {
            scrollToBottom();
        }
    }, [selectedProject?.updates]);

    const fetchProjectDetail = async (id: number) => {
        try {
            const res = await axios.get(`/api/taskforce/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setSelectedProject(res.data);
            setBriefingMd(res.data.briefing_md || `# Briefing Missione: ${res.data.name}\n\nInserisci qui le linee guida, gli obiettivi e le informazioni critiche per il team.`);
            setShowSentCheck(false);
            
            // Carica anche i task
            const tasksRes = await axios.get(`/api/taskforce/projects/${id}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
            setTodos(tasksRes.data);
            // Default to briefing if not already set or if switching projects
            setActiveTab('briefing');
        } catch (err) {
            console.error("Errore caricamento dettagli progetto", err);
        }
    };

    // WebSocket for Real-time updates
    useEffect(() => {
        if (!selectedProject || !token) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // In local development we want to point to 8000 if we are on 5173
        const host = window.location.host.includes('5173') 
            ? window.location.host.replace('5173', '4000') 
            : window.location.host;
            
        const wsUrl = `${protocol}//${host}/api/taskforce/ws/${selectedProject.id}`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Gestione messaggi chat (default)
                if (!data.type) {
                    setSelectedProject(prev => {
                        if (!prev || prev.id !== selectedProject.id) return prev;
                        if (prev.updates.some(u => u.id === data.id)) return prev;
                        return { ...prev, updates: [...prev.updates, data] };
                    });
                } 
                // Gestione nuovi task
                else if (data.type === 'todo_new') {
                    setTodos(prev => [...prev, data.data]);
                }
                // Gestione aggiornamento task
                else if (data.type === 'todo_update') {
                    setTodos(prev => prev.map(t => t.id === data.data.id ? { ...t, is_done: data.data.is_done } : t));
                }
            } catch (e) {
                console.error("WebSocket message error", e);
            }
        };

        return () => socket.close();
    }, [selectedProject?.id, token]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // 1. Create project
            const res = await axios.post('/api/taskforce/projects', {
                name: newProjectName,
                description: newProjectDesc
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            const newProj = res.data;

            // 2. Add AI selected members if any
            for (const uid of selectedSugIds) {
                try {
                    await axios.post(`/api/taskforce/projects/${newProj.id}/members`, {
                        user_id: uid,
                        role: 'Specialista AI'
                    }, { headers: { Authorization: `Bearer ${token}` } });
                } catch (err) {
                    console.error("Errore aggiunta membro AI", uid, err);
                }
            }

            setProjects([newProj, ...projects]);
            setIsProjectModalOpen(false);
            setNewProjectName('');
            setNewProjectDesc('');
            setSelectedSugIds([]);
            setSuggestedMembers([]);
            fetchProjectDetail(newProj.id);
        } catch (err) {
            alert('Errore creazione progetto');
        }
    };

    const handleDeleteProject = async (id: number) => {
        if (!confirm('Sei sicuro di voler eliminare definitivamente questa Task Force?')) return;
        try {
            await axios.delete(`/api/taskforce/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            const updated = projects.filter(p => p.id !== id);
            setProjects(updated);
            if (selectedProject?.id === id) {
                setSelectedProject(updated.length > 0 ? null : null); // Trigger detail fetch if needed
                if (updated.length > 0) fetchProjectDetail(updated[0].id);
                else setSelectedProject(null);
            }
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Errore eliminazione progetto');
        }
    };

    const handleSuggestMembers = async () => {
        if (!newProjectDesc.trim()) {
            alert("Inserisci una descrizione per usare l'AI");
            return;
        }
        setIsSuggesting(true);
        try {
            const res = await axios.post('/api/taskforce/suggest-members', {
                description: newProjectDesc
            }, { headers: { Authorization: `Bearer ${token}` } });
            setSuggestedMembers(res.data);
            // Auto-select top match if any?
            // setSelectedSugIds(res.data.map((m: any) => m.user_id));
        } catch (err) {
            alert("Errore suggerimento AI");
        } finally {
            setIsSuggesting(false);
        }
    };

    const toggleSugMember = (id: number) => {
        setSelectedSugIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handlePostUpdate = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedProject || (!newUpdateContent.trim() && !attachment)) return;

        setSendingUpdate(true);
        try {
            const formData = new FormData();
            formData.append('content', newUpdateContent);
            if (attachment) {
                formData.append('file', attachment);
            }

            await axios.post(`/api/taskforce/projects/${selectedProject.id}/updates`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`
                }
            });
            
            // L'aggiornamento verrà aggiunto tramite WebSocket broadcast (anche per il mittente)
            // per evitare duplicati e garantire l'ordine.
            
            setNewUpdateContent('');
            setAttachment(null);
            setShowSentCheck(true);
            setTimeout(() => setShowSentCheck(false), 3000);
        } catch (err) {
            alert('Errore invio aggiornamento.');
        } finally {
            setSendingUpdate(false);
        }
    };

    const handleCreateTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject || !newTodoContent.trim()) return;
        setIsAddingTodo(true);
        try {
            await axios.post(`/api/taskforce/projects/${selectedProject.id}/tasks`, {
                content: newTodoContent,
                assigned_to: selectedAssignee || null
            }, { headers: { Authorization: `Bearer ${token}` } });
            setNewTodoContent('');
            setSelectedAssignee('');
        } catch (err) {
            alert('Errore creazione task');
        } finally {
            setIsAddingTodo(false);
        }
    };

    const handleToggleTodo = async (todoId: number) => {
        try {
            await axios.patch(`/api/taskforce/tasks/${todoId}/toggle`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            alert('Errore aggiornamento task');
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject || !selectedUserId) return;
        try {
            const res = await axios.post(`/api/taskforce/projects/${selectedProject.id}/members`, {
                user_id: Number(selectedUserId),
                role: 'Membro'
            }, { headers: { Authorization: `Bearer ${token}` } });
            setSelectedProject(prev => prev ? {
                ...prev,
                members: [...prev.members, res.data]
            } : prev);
            setIsMemberModalOpen(false);
            setSelectedUserId('');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Errore aggiunta membro');
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        if (!selectedProject) return;
        try {
            const res = await axios.put(`/api/taskforce/projects/${selectedProject.id}/status`, {
                status: newStatus
            }, { headers: { Authorization: `Bearer ${token}` } });

            // Aggiorna localmente sia il dettaglio che la lista
            setSelectedProject(prev => prev ? { ...prev, status: res.data.status } : null);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, status: res.data.status } : p));
        } catch (err) {
            alert('Errore aggiornamento stato');
        }
    };

    const handleSaveBriefing = async () => {
        if (!selectedProject) return;
        setIsSavingBriefing(true);
        try {
            await axios.put(`/api/taskforce/projects/${selectedProject.id}/briefing`, {
                briefing_md: briefingMd
            }, { headers: { Authorization: `Bearer ${token}` } });
            setIsEditingBriefing(false);
        } catch (err) {
            alert('Errore salvataggio briefing');
        } finally {
            setIsSavingBriefing(false);
        }
    };

    const handleGenerateSitrep = async () => {
        if (!selectedProject) return;
        setIsGeneratingSitrep(true);
        setIsSitrepModalOpen(true);
        try {
            const res = await axios.post(`/api/taskforce/projects/${selectedProject.id}/sitrep`, {}, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setSitrepContent(res.data.sitrep);
        } catch (err) {
            setSitrepContent("Errore durante la generazione del SITREP IA. Riprova tra poco.");
        } finally {
            setIsGeneratingSitrep(false);
        }
    };

    if (loading) return (
        <div className="pt-32 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-neon-green/20 border-t-neon-green rounded-full animate-spin" />
            <p className="text-neon-green/70 font-bold uppercase tracking-widest text-xs">Caricamento Task Force...</p>
        </div>
    );

    return (
        <div className="w-full pt-20 lg:pt-24 pb-12 animate-in fade-in duration-500 relative z-10 px-4 sm:px-6 h-[calc(100vh-6rem)] flex flex-col max-w-7xl mx-auto">

            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-green to-emerald-400 text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                        <Shield size={36} className="text-neon-green" />
                        Task Force Manager
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></span>
                        Mission Control & Comunicazione AI
                    </p>
                </div>
                <button
                    onClick={() => setIsProjectModalOpen(true)}
                    className="bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green hover:text-black transition-all px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 w-fit shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                >
                    <Plus size={16} /> Nuova Task Force
                </button>
            </div>

            {error && <div className="text-red-400 bg-red-400/10 p-4 border border-red-400/20 rounded-xl mb-6">{error}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">

                {/* ─── Projects List (Sidebar) ─── */}
                <div className="lg:col-span-1 glass-panel rounded-2xl overflow-y-auto border-dashed border-white/10 flex flex-col">
                    <div className="p-4 border-b border-white/5 sticky top-0 bg-black/40 backdrop-blur-md z-10">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Search size={16} className="text-neon-green" /> I Tuoi Progetti
                        </h3>
                    </div>

                    <div className="p-3 space-y-2 flex-1">
                        {projects.length === 0 ? (
                            <div className="text-center p-8 text-sm text-slate-500 italic">
                                Nessuna Task Force trovata.<br />Creane una per iniziare.
                            </div>
                        ) : (
                            projects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => fetchProjectDetail(p.id)}
                                    className={`w-full text-left p-4 rounded-xl transition-all border ${selectedProject?.id === p.id ? 'bg-neon-green/10 border-neon-green/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/5'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`font-bold truncate pr-2 ${selectedProject?.id === p.id ? 'text-neon-green' : 'text-slate-200'}`}>
                                            {p.name}
                                        </h4>
                                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${p.status === 'attivo' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : p.status === 'completato' ? 'bg-blue-500' : 'bg-red-500'}`} />
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{p.description || 'Nessuna descrizione'}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* ─── Project Detail Area ─── */}
                <div className="lg:col-span-3 flex flex-col min-h-[500px]">
                    {selectedProject ? (
                        <div className="flex flex-col h-full glass-panel rounded-2xl overflow-hidden border border-white/5 relative">
                            {/* Header Professionale Mission Control */}
                            <div className="p-6 border-b border-white/10 bg-slate-900/40 backdrop-blur-md sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <h1 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
                                            {selectedProject!.name}
                                            <span className={`w-3 h-3 rounded-full animate-pulse ${
                                                selectedProject!.status === 'attivo' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 
                                                selectedProject!.status === 'completato' ? 'bg-blue-500' : 'bg-red-500'
                                            }`}></span>
                                        </h1>
                                        
                                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                                            {['attivo', 'completato', 'sospeso'].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => handleUpdateStatus(s)}
                                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${selectedProject!.status === s
                                                        ? (s === 'attivo' ? 'bg-emerald-500 text-black' : s === 'completato' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white')
                                                        : 'text-slate-500 hover:bg-white/10'}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>

                                        {user?.is_admin === 1 && (
                                            <button 
                                                onClick={() => handleDeleteProject(selectedProject!.id)}
                                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 ml-auto md:ml-0"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-xs font-light line-clamp-1">{selectedProject!.description}</p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <motion.button 
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleGenerateSitrep}
                                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400/30"
                                    >
                                        <Cpu size={16} />
                                        SITREP IA
                                    </motion.button>
                                    <button 
                                        onClick={() => setIsMemberModalOpen(true)}
                                        className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all border border-white/10"
                                        title="Gestione Team"
                                    >
                                        <Users size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Tab Navigation Professionale */}
                            <div className="flex border-b border-white/5 bg-slate-900/50">
                                <button 
                                    onClick={() => setActiveTab('briefing')}
                                    className={`flex-1 py-4 text-sm font-medium transition-all relative ${
                                        activeTab === 'briefing' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Shield size={16} />
                                        Briefing Missione
                                    </div>
                                    {activeTab === 'briefing' && (
                                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                                    )}
                                </button>
                                <button 
                                    onClick={() => setActiveTab('tasks')}
                                    className={`flex-1 py-4 text-sm font-medium transition-all relative ${
                                        activeTab === 'tasks' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Calendar size={16} />
                                        Piano Operativo
                                        {todos.filter(t => !t.is_done).length > 0 && (
                                            <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-full flex items-center justify-center border border-emerald-500/30">
                                                {todos.filter(t => !t.is_done).length}
                                            </span>
                                        )}
                                    </div>
                                    {activeTab === 'tasks' && (
                                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                                    )}
                                </button>
                                <button 
                                    onClick={() => setActiveTab('chat')}
                                    className={`flex-1 py-4 text-sm font-medium transition-all relative ${
                                        activeTab === 'chat' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <MessageSquare size={16} />
                                        Comunicazioni
                                    </div>
                                    {activeTab === 'chat' && (
                                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                                    )}
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0 bg-slate-900/20 overflow-hidden relative">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'briefing' && (
                                        <motion.div 
                                            key="briefing"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="absolute inset-0 p-8 overflow-y-auto"
                                        >
                                            <div className="max-w-3xl mx-auto bg-slate-800/40 rounded-xl border border-white/5 p-8 shadow-2xl relative">
                                                <div className="flex justify-between items-center mb-8">
                                                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                                        <Shield size={20} className="text-emerald-500" />
                                                        Briefing Strategico
                                                    </h2>
                                                    <button 
                                                        onClick={() => setIsEditingBriefing(!isEditingBriefing)}
                                                        className="text-emerald-400 hover:text-emerald-300 text-sm font-medium flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all hover:bg-emerald-500/20"
                                                    >
                                                        {isEditingBriefing ? <X size={16} /> : <Plus size={16} />}
                                                        {isEditingBriefing ? 'Annulla' : 'Modifica Briefing'}
                                                    </button>
                                                </div>

                                                {isEditingBriefing ? (
                                                    <div className="space-y-4">
                                                        <textarea 
                                                            value={briefingMd}
                                                            onChange={(e) => setBriefingMd(e.target.value)}
                                                            className="w-full h-[400px] bg-slate-900/50 text-slate-200 border border-white/10 rounded-xl p-6 focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm leading-relaxed"
                                                            placeholder="Inserisci il briefing in Markdown..."
                                                        />
                                                        <div className="flex justify-end">
                                                            <button 
                                                                onClick={handleSaveBriefing}
                                                                disabled={isSavingBriefing}
                                                                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-all transform active:scale-95 shadow-lg shadow-emerald-500/30 flex items-center gap-2"
                                                            >
                                                                {isSavingBriefing ? (
                                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                ) : <Check size={18} />}
                                                                Salva Cambiamenti
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="prose prose-invert prose-emerald max-w-none text-slate-300 leading-relaxed">
                                                        {briefingMd.split('\n').map((line, i) => (
                                                            <p key={i} className="mb-2">
                                                                {line.startsWith('#') ? (
                                                                    <span className="text-emerald-400 font-bold text-xl block mt-4 mb-2">
                                                                        {line.replace(/^#+\s/, '')}
                                                                    </span>
                                                                ) : line.startsWith('-') || line.startsWith('*') ? (
                                                                    <span className="flex items-start gap-2 ml-4">
                                                                        <span className="text-emerald-500 mt-1.5">•</span>
                                                                        <span>{line.replace(/^[-*]\s/, '')}</span>
                                                                    </span>
                                                                ) : line}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Sideboard: Team Operativo */}
                                            <div className="max-w-3xl mx-auto mt-8 bg-black/20 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                                                        <Users size={16} /> Team Operativo Assegnato
                                                    </h3>
                                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold uppercase">
                                                        {selectedProject!.members.length} Operatori
                                                    </span>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {selectedProject!.members.map(member => (
                                                        <motion.div 
                                                            key={member.user_id}
                                                            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                                            className="bg-white/5 border border-white/5 p-3 rounded-xl flex items-center gap-3 transition-all"
                                                        >
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 flex items-center justify-center text-xs font-black border border-emerald-500/20 shadow-inner">
                                                                {member.first_name[0]}{member.last_name[0]}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-white truncate">{member.first_name} {member.last_name}</p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                    <p className="text-[9px] uppercase tracking-tighter text-slate-500 font-medium truncate">{member.role}</p>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'tasks' && (
                                        <motion.div 
                                            key="tasks"
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 1.02 }}
                                            className="absolute inset-0 p-8 overflow-y-auto"
                                        >
                                            <div className="max-w-4xl mx-auto space-y-6">
                                                <div className="flex justify-between items-center bg-slate-800/20 p-6 rounded-2xl border border-white/5 mb-8">
                                                    <div>
                                                        <h2 className="text-xl font-semibold text-white">Piano d'Azione</h2>
                                                        <p className="text-slate-400 text-sm">Organizza i traguardi operativi del team</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => setIsAddingTodo(!isAddingTodo)}
                                                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20 transition-all flex items-center gap-2"
                                                    >
                                                        {isAddingTodo ? <X size={18} /> : <Plus size={18} />}
                                                        {isAddingTodo ? 'Annulla' : 'Nuovo Task'}
                                                    </button>
                                                </div>

                                                {isAddingTodo && (
                                                    <form onSubmit={handleCreateTodo} className="bg-slate-800/40 p-6 rounded-2xl border border-emerald-500/20 mb-8 animate-in slide-in-from-top duration-300">
                                                        <div className="space-y-4">
                                                            <input 
                                                                type="text"
                                                                required
                                                                value={newTodoContent}
                                                                onChange={e => setNewTodoContent(e.target.value)}
                                                                placeholder="Cosa bisogna fare?"
                                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50"
                                                            />
                                                            <div className="flex gap-4">
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1 ml-1">Assegna a</label>
                                                                    <select 
                                                                        value={selectedAssignee}
                                                                        onChange={e => setSelectedAssignee(e.target.value as any)}
                                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50"
                                                                    >
                                                                        <option value="">Chiunque</option>
                                                                        {selectedProject.members.map(m => (
                                                                            <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <button type="submit" className="self-end bg-emerald-500 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                                                                    Crea Task
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </form>
                                                )}

                                                {todos.length === 0 ? (
                                                    <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                                        <Calendar className="mx-auto text-slate-600 mb-4" size={48} />
                                                        <p className="text-slate-400">Nessun task pianificato per questa missione.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-3">
                                                        {todos.sort((a, b) => a.is_done - b.is_done).map((todo) => (
                                                            <motion.div 
                                                                layout
                                                                key={todo.id}
                                                                className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${
                                                                    todo.is_done ? 'bg-slate-900/40 border-white/5 opacity-60' : 'bg-slate-800/40 border-white/10 hover:border-emerald-500/30'
                                                                }`}
                                                            >
                                                                <button 
                                                                    onClick={() => handleToggleTodo(todo.id)}
                                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                        todo.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'
                                                                    }`}
                                                                >
                                                                    {todo.is_done === 1 && <Check size={14} className="text-white" />}
                                                                </button>
                                                                <div className="flex-1">
                                                                    <p className={`text-sm ${todo.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                                                        {todo.content}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                                                            Assegnato a: {allUsers.find(u => u.id === todo.assigned_to)?.first_name || 'Chiunque'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'chat' && (
                                        <motion.div 
                                            key="chat"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="absolute inset-0 flex flex-col"
                                        >
                                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                                {selectedProject!.updates.map((update) => {
                                                    const isOwn = update.author_id === user?.id;
                                                    return (
                                                        <div key={update.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                            <div className={`max-w-[80%] rounded-2xl p-4 shadow-lg ${
                                                                isOwn ? 'bg-emerald-500 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                                                            }`}>
                                                                {!isOwn && (
                                                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 text-emerald-400 flex items-center gap-1.5">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                        {update.author_name || 'Operatore NexUS'}
                                                                    </p>
                                                                )}
                                                                <p className="text-sm leading-relaxed">{update.content}</p>
                                                                {update.attachment_path && (
                                                                    <div className="mt-3 p-2 bg-black/20 rounded-lg border border-white/10 group relative overflow-hidden">
                                                                        {update.attachment_type?.startsWith('image/') ? (
                                                                            <a href={update.attachment_path} target="_blank" rel="noreferrer" title="Apri immagine a schermo intero">
                                                                                <img src={update.attachment_path} alt="Allegato" className="max-w-full h-auto rounded-md cursor-zoom-in hover:opacity-80 transition-all border border-white/5" />
                                                                                <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                                                                                    <div className="bg-emerald-500 text-white rounded-full p-2 shadow-2xl">
                                                                                        <Plus size={16} />
                                                                                    </div>
                                                                                </div>
                                                                            </a>
                                                                        ) : (
                                                                            <a href={update.attachment_path} target="_blank" rel="noreferrer" download className="flex items-center justify-between gap-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all group/file">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                                                                                        <Plus size={16} className="rotate-45" />
                                                                                    </div>
                                                                                    <div className="overflow-hidden">
                                                                                        <p className="text-[10px] text-emerald-300 font-bold uppercase truncate max-w-[120px]">
                                                                                            {update.attachment_path.split('/').pop()?.substring(0, 15) || 'Allegato'}...
                                                                                        </p>
                                                                                        <p className="text-[8px] text-slate-500 uppercase tracking-widest font-black">DOCUMENTO</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-[10px] text-emerald-500 font-black group-hover/file:translate-x-1 transition-transform bg-emerald-500/10 px-2 py-1 rounded">SCARICA</div>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                
                                                                <p className={`text-[10px] mt-2 opacity-50 text-right`}>
                                                                    {new Date(update.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={messagesEndRef} />
                                            </div>

                                            <div className="p-4 bg-slate-900/50 border-t border-white/5 backdrop-blur-md">
                                                {attachment && (
                                                    <div className="mb-3 p-2 bg-emerald-500/10 rounded-lg flex justify-between items-center border border-emerald-500/20">
                                                        <span className="text-xs text-emerald-400 truncate max-w-[80%]">📎 {attachment.name}</span>
                                                        <button onClick={() => setAttachment(null)} className="text-red-400"><X size={14} /></button>
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="file" 
                                                        id="file-upload" 
                                                        className="hidden" 
                                                        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                                    />
                                                    <label htmlFor="file-upload" className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl cursor-pointer transition-all border border-white/5">
                                                        <Plus size={20} />
                                                    </label>
                                                    <input 
                                                        value={newUpdateContent}
                                                        onChange={(e) => setNewUpdateContent(e.target.value)}
                                                        onKeyPress={(e) => e.key === 'Enter' && handlePostUpdate()}
                                                        placeholder="Scrivi un aggiornamento..."
                                                        className="flex-1 bg-white/5 text-white border border-white/10 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-sm"
                                                    />
                                                    <button 
                                                        onClick={() => handlePostUpdate()}
                                                        disabled={sendingUpdate || (!newUpdateContent.trim() && !attachment)}
                                                        className="p-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95"
                                                    >
                                                        {sendingUpdate ? <span className="animate-pulse">...</span> : showSentCheck ? <CheckCircle size={18} /> : <><Send size={14} /> Briefing</>}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 border-dashed border-2 border-white/5 rounded-2xl">
                            <Shield size={64} className="mb-4 opacity-5" />
                            <p className="uppercase tracking-[0.2em] text-xs font-light">Seleziona una Task Force Attiva</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Modals ─── */}
            <AnimatePresence>
                {isProjectModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                                <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter"><Shield size={24} className="text-neon-green" /> Inizializza Task Force</h3>
                                <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full"><X size={20} /></button>
                            </div>
                            
                            <div className="grid md:grid-cols-2">
                                <form onSubmit={handleCreateProject} className="p-6 space-y-4 border-r border-white/5">
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Nome Operazione</label>
                                        <input type="text" required value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-neon-green focus:outline-none text-sm transition-all" placeholder="Es. Migrazione Cloud 2025" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Descrizione Problema / Missione</label>
                                        <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-neon-green focus:outline-none text-sm h-32 resize-none transition-all font-light" placeholder="Descrivi il problema per permettere all'AI di suggerire gli esperti migliori..." />
                                    </div>
                                    
                                    <div className="pt-2">
                                        <button 
                                            type="button" 
                                            onClick={handleSuggestMembers}
                                            disabled={isSuggesting || !newProjectDesc.trim()}
                                            className="w-full py-2.5 rounded-xl border border-neon-blue/30 text-neon-blue bg-neon-blue/5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neon-blue hover:text-black transition-all disabled:opacity-30"
                                        >
                                            {isSuggesting ? (
                                                <div className="w-4 h-4 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
                                            ) : (
                                                <><Cpu size={14} /> Analizza con AI</>
                                            )}
                                        </button>
                                    </div>

                                    <div className="pt-6 flex gap-3">
                                        <button type="submit" className="flex-1 py-4 text-xs font-black bg-neon-green text-black hover:bg-emerald-400 rounded-2xl transition-all shadow-[0_0_25px_rgba(16,185,129,0.2)] uppercase tracking-widest">Crea e Assegna</button>
                                    </div>
                                </form>

                                <div className="p-6 bg-black/40">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4 flex items-center justify-between">
                                        <span>Esperti Suggeriti</span>
                                        {selectedSugIds.length > 0 && <span className="text-neon-green bg-neon-green/10 px-2 py-0.5 rounded-full">{selectedSugIds.length} selezionati</span>}
                                    </div>
                                    
                                    <div className="space-y-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {suggestedMembers.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                                <Cpu size={32} className="mb-2" />
                                                <p className="text-[10px] uppercase leading-relaxed">Usa l'analisi AI per trovare<br/>i membri più qualificati</p>
                                            </div>
                                        ) : (
                                            suggestedMembers.map(m => (
                                                <div 
                                                    key={m.user_id} 
                                                    onClick={() => toggleSugMember(m.user_id)}
                                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedSugIds.includes(m.user_id) ? 'bg-neon-green/10 border-neon-green/40' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="font-bold text-xs text-white">{m.first_name} {m.last_name}</div>
                                                        {selectedSugIds.includes(m.user_id) && <Check size={14} className="text-neon-green" />}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {m.matched_categories.map(cat => (
                                                            <span key={cat} className="text-[9px] px-1.5 py-0.5 rounded-md bg-neon-blue/10 text-neon-blue border border-neon-blue/20">
                                                                {cat}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {isMemberModalOpen && (user?.is_admin === 1 || selectedProject?.members.some(m => m.user_id === user?.id && m.role === 'Leader')) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter"><UserPlus size={20} className="text-neon-green" /> Recluta Operatore</h3>
                                <button onClick={() => setIsMemberModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-2"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleAddMember} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Seleziona Utente</label>
                                    <select
                                        required
                                        value={selectedUserId}
                                        onChange={e => setSelectedUserId(e.target.value as any)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-neon-green focus:outline-none text-sm appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>-- Scegli un operatore --</option>
                                        {allUsers.filter(u => !selectedProject?.members.some(m => m.user_id === u.id)).map(u => (
                                            <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button type="submit" className="flex-1 py-3 text-xs font-black bg-neon-green text-black hover:bg-emerald-400 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] uppercase tracking-widest">Aggiungi al Team</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal SITREP IA Professionale */}
            <AnimatePresence>
                {isSitrepModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSitrepModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        ></motion.div>
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/5 bg-emerald-500/5 flex justify-between items-center">
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                                        <Cpu size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">SITREP: Rapporto Operativo IA</h3>
                                        <p className="text-[10px] uppercase tracking-widest text-emerald-500/60 font-bold">Analisi in tempo reale della missione</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsSitrepModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {isGeneratingSitrep ? (
                                    <div className="py-20 text-center">
                                        <div className="inline-block relative">
                                            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                                            <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 animate-pulse" size={24} />
                                        </div>
                                        <p className="mt-6 text-slate-400 animate-pulse font-mono tracking-widest text-sm">ELABORAZIONE DATI MISSIONE...</p>
                                    </div>
                                ) : (
                                    <div className="prose prose-invert prose-emerald max-w-none">
                                        <div className="text-slate-300 whitespace-pre-wrap leading-relaxed font-sans text-[15px]">
                                            {sitrepContent.split('\n').map((line, i) => {
                                                if (line.startsWith('**') || line.match(/^\d\)/)) {
                                                    return <p key={i} className="text-emerald-400 font-bold mt-4 mb-2 border-l-2 border-emerald-500/30 pl-3">{line}</p>;
                                                }
                                                return <p key={i} className={`${line.trim() ? 'mb-2' : 'h-1'}`}>{line}</p>;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-slate-950/50 border-t border-white/5 flex justify-end">
                                <button 
                                    onClick={() => setIsSitrepModalOpen(false)}
                                    className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all text-sm font-semibold"
                                >
                                    Chiudi Rapporto
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TaskForcePage;
