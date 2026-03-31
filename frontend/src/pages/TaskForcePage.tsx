import { useState, useEffect } from 'react';
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

interface ProjectDetail extends Project {
    members: Member[];
    updates: Update[];
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

    const fetchProjectDetail = async (id: number) => {
        try {
            const res = await axios.get(`/api/taskforce/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setSelectedProject(res.data);
            setShowSentCheck(false);
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
                setSelectedProject(prev => {
                    if (!prev || prev.id !== selectedProject.id) return prev;
                    if (prev.updates.some(u => u.id === data.id)) return prev;
                    return { ...prev, updates: [data, ...prev.updates] };
                });
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

    const handlePostUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject || (!newUpdateContent.trim() && !attachment)) return;

        setSendingUpdate(true);
        try {
            const formData = new FormData();
            formData.append('content', newUpdateContent);
            if (attachment) {
                formData.append('file', attachment);
            }

            const res = await axios.post(`/api/taskforce/projects/${selectedProject.id}/updates`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            // Add locally instantly
            setSelectedProject(prev => prev ? {
                ...prev,
                updates: [res.data, ...prev.updates]
            } : prev);
            
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
                        <>
                            {/* Header Progetto */}
                            <div className="glass-panel rounded-t-2xl p-6 border-b border-white/5 relative overflow-hidden shrink-0">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-neon-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-2">
                                            <h2 className="text-2xl font-black text-white">{selectedProject.name}</h2>
                                            {user?.is_admin === 1 && (
                                                <button 
                                                    onClick={() => handleDeleteProject(selectedProject.id)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                                    title="Elimina Progetto"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-sm max-w-2xl">{selectedProject.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {(user?.is_admin === 1 || selectedProject.members.some(m => m.user_id === user?.id && m.role === 'Leader')) ? (
                                            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                                {['attivo', 'completato', 'sospeso'].map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => handleUpdateStatus(s)}
                                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${selectedProject.status === s
                                                            ? (s === 'attivo' ? 'bg-emerald-500 text-black' : s === 'completato' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white')
                                                            : 'text-slate-500 hover:bg-white/5'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className={`px-3 py-1 border rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${selectedProject.status === 'attivo' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                selectedProject.status === 'completato' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                    'bg-red-500/20 text-red-400 border-red-500/30'
                                                }`}>
                                                <CheckCircle size={12} /> {selectedProject.status}
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar size={12} /> {new Date(selectedProject.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Area Membri Orizzontale */}
                                <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                                            <Users size={14} /> Membri ({selectedProject.members.length})
                                        </span>
                                        <div className="flex -space-x-2">
                                            {selectedProject.members.map((m, i) => (
                                                <div key={m.id} className={`w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white relative group ${m.role === 'Leader' ? 'bg-neon-green shadow-[0_0_10px_rgba(16,185,129,0.3)] text-black' : 'bg-slate-800'}`} style={{ zIndex: 10 - i }}>
                                                    {m.first_name[0]}{m.last_name[0]}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none border border-white/10 shadow-2xl z-[100]">
                                                        <div className="font-bold">{m.first_name} {m.last_name}</div>
                                                        <div className="text-slate-400 text-[9px] uppercase">{m.role}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(user?.is_admin === 1 || selectedProject.members.some(m => m.user_id === user?.id && m.role === 'Leader')) && (
                                                <button
                                                    onClick={() => setIsMemberModalOpen(true)}
                                                    className="w-8 h-8 rounded-full border-2 border-dashed border-neon-green/50 bg-neon-green/10 flex items-center justify-center text-neon-green hover:bg-neon-green hover:text-black transition-all z-20 group"
                                                    title="Aggiungi Membro"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feed Aggiornamenti */}
                            <div className="glass-panel p-6 flex-1 overflow-y-auto space-y-6">
                                {selectedProject.updates.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
                                        <MessageSquare size={48} className="mb-4 opacity-10" />
                                        <p className="text-sm uppercase tracking-widest font-light">In attesa del primo briefing missione...</p>
                                    </div>
                                ) : (
                                    selectedProject.updates.map(upd => (
                                        <div key={upd.id} className="flex gap-4 p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green/20 to-emerald-500/10 border border-neon-green/30 flex items-center justify-center text-neon-green font-bold shrink-0">
                                                {upd.author_name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-2">
                                                    <h5 className="text-sm font-bold text-slate-200">{upd.author_name}</h5>
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{new Date(upd.created_at).toLocaleString()}</span>
                                                </div>
                                                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-light mb-3">
                                                    {upd.content}
                                                </div>
                                                {upd.attachment_path && (
                                                    <div className="mt-2 rounded-xl bg-black/20 border border-white/5 p-2 overflow-hidden w-fit max-w-full">
                                                        {upd.attachment_type?.startsWith('image/') ? (
                                                            <a href={upd.attachment_path} target="_blank" rel="noreferrer">
                                                                <img 
                                                                    src={upd.attachment_path} 
                                                                    alt="Allegato" 
                                                                    className="max-h-64 rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity" 
                                                                />
                                                            </a>
                                                        ) : (
                                                            <a 
                                                                href={upd.attachment_path} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-neon-blue hover:text-white transition-colors"
                                                            >
                                                                <Plus size={14} className="rotate-45" />
                                                                Download {upd.attachment_path.split('/').pop()}
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="glass-panel rounded-b-2xl p-4 border-t border-white/10 bg-black/80">
                                <form onSubmit={handlePostUpdate} className="flex flex-col gap-3">
                                    <div className="flex gap-3 items-end">
                                        <textarea
                                            value={newUpdateContent}
                                            onChange={(e) => setNewUpdateContent(e.target.value)}
                                            placeholder="Scrivi un aggiornamento. Verrà inviato via email e in tempo reale ai membri..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-neon-green/50 resize-none h-20 placeholder:text-slate-600 transition-all font-light"
                                        />
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <button
                                                type="submit"
                                                disabled={sendingUpdate || (!newUpdateContent.trim() && !attachment)}
                                                className="h-12 px-6 bg-neon-green text-black font-black uppercase tracking-wider text-xs rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                            >
                                                {sendingUpdate ? <span className="animate-pulse">...</span> : showSentCheck ? <CheckCircle size={18} /> : <><Send size={14} /> Briefing</>}
                                            </button>
                                            <label className="cursor-pointer group">
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                                />
                                                <div className={`h-10 w-12 flex items-center justify-center rounded-xl border transition-all ${attachment ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'bg-white/5 border-white/10 text-slate-500 group-hover:border-white/20'}`} title="Allega File">
                                                    <Plus size={18} />
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                    {attachment && (
                                        <div className="flex items-center justify-between px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px] text-slate-400">
                                            <span className="truncate max-w-[200px]">📎 {attachment.name}</span>
                                            <button onClick={() => setAttachment(null)} className="text-red-400 hover:text-red-300">Rimuovi</button>
                                        </div>
                                    )}
                                    
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="h-full glass-panel rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500 border-dashed border-2 border-white/5">
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

        </div>
    );
};

export default TaskForcePage;
