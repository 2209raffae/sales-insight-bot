import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Plus, MessageSquare, Send, X, Shield,
    Calendar, CheckCircle, Search, UserPlus
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
    created_at: string;
}

interface ProjectDetail extends Project {
    members: Member[];
    updates: Update[];
}

const TaskForcePage = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modals state
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    // Add Member search
    const [allUsers, setAllUsers] = useState<{ id: number, first_name: string, last_name: string, email: string }[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');

    // New Update state
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [sendingUpdate, setSendingUpdate] = useState(false);

    useEffect(() => {
        fetchProjects();
        // Qualunque utente può vedere la lista operatori base per invitare
        axios.get('/api/taskforce/operators', { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } })
            .then(res => setAllUsers(res.data)).catch(console.error);
    }, [user]);

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/taskforce/projects', { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } });
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
            const res = await axios.get(`/api/taskforce/projects/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } });
            setSelectedProject(res.data);
        } catch (err) {
            console.error("Errore caricamento dettagli progetto", err);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/taskforce/projects', {
                name: newProjectName,
                description: newProjectDesc
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } });
            setProjects([res.data, ...projects]);
            setIsProjectModalOpen(false);
            setNewProjectName('');
            setNewProjectDesc('');
            fetchProjectDetail(res.data.id);
        } catch (err) {
            alert('Errore creazione progetto');
        }
    };

    const handlePostUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject || !newUpdateContent.trim()) return;

        setSendingUpdate(true);
        try {
            const res = await axios.post(`/api/taskforce/projects/${selectedProject.id}/updates`, {
                content: newUpdateContent
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } });
            // Aggiorna localmente
            setSelectedProject(prev => prev ? {
                ...prev,
                updates: [res.data, ...prev.updates]
            } : prev);
            setNewUpdateContent('');
        } catch (err) {
            alert('Errore invio aggiornamento. Assicurati che l\'email sia validata se usi Resend gratuito.');
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
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } });
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

    if (loading) return <div className="pt-32 text-center text-neon-green/70">Caricamento Task Force...</div>;

    return (
        <div className="w-full pt-20 lg:pt-24 pb-12 animate-in fade-in duration-500 relative z-10 px-4 sm:px-6 h-[calc(100vh-6rem)] flex flex-col">

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
                    className="bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green hover:text-black transition-all px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 w-fit"
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
                            <div className="text-center p-6 text-sm text-slate-500">
                                Nessuna Task Force trovata.<br />Creane una per iniziare.
                            </div>
                        ) : (
                            projects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => fetchProjectDetail(p.id)}
                                    className={`w-full text-left p-4 rounded-xl transition-all border ${selectedProject?.id === p.id ? 'bg-neon-green/10 border-neon-green/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`font-bold truncate pr-2 ${selectedProject?.id === p.id ? 'text-neon-green' : 'text-slate-200'}`}>
                                            {p.name}
                                        </h4>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
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
                                    <div>
                                        <h2 className="text-2xl font-black text-white mb-2">{selectedProject.name}</h2>
                                        <p className="text-slate-400 text-sm max-w-2xl">{selectedProject.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                            <CheckCircle size={12} /> {selectedProject.status}
                                        </span>
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
                                        <div className="flex -space-x-3">
                                            {selectedProject.members.map((m, i) => (
                                                <div key={m.id} className="w-8 h-8 rounded-full border-2 border-black bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[10px] font-bold text-white relative group" style={{ zIndex: 10 - i }}>
                                                    {m.first_name[0]}{m.last_name[0]}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                                                        {m.first_name} {m.last_name} ({m.role})
                                                    </div>
                                                </div>
                                            ))}
                                            {(user?.is_admin === 1 || selectedProject.members.some(m => m.user_id === user?.id && m.role === 'Leader')) && (
                                                <button
                                                    onClick={() => setIsMemberModalOpen(true)}
                                                    className="w-8 h-8 rounded-full border-2 border-dashed border-neon-green/50 bg-neon-green/10 flex items-center justify-center text-neon-green hover:bg-neon-green/20 hover:scale-110 transition-all z-20"
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
                                        <MessageSquare size={48} className="mb-4 opacity-20" />
                                        <p>Nessun aggiornamento. Rompi il ghiaccio!</p>
                                    </div>
                                ) : (
                                    selectedProject.updates.map(upd => (
                                        <div key={upd.id} className="flex gap-4 p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green/20 to-emerald-500/20 border border-neon-green/30 flex items-center justify-center text-neon-green font-bold shrink-0">
                                                {upd.author_name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-baseline mb-2">
                                                    <h5 className="text-sm font-bold text-slate-200">{upd.author_name}</h5>
                                                    <span className="text-[10px] text-slate-500">{new Date(upd.created_at).toLocaleString()}</span>
                                                </div>
                                                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {upd.content}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="glass-panel rounded-b-2xl p-4 border-t border-white/10 bg-black/80">
                                <form onSubmit={handlePostUpdate} className="flex gap-3 items-end">
                                    <textarea
                                        value={newUpdateContent}
                                        onChange={(e) => setNewUpdateContent(e.target.value)}
                                        placeholder="Scrivi un aggiornamento per la task force. Un'email verrà inviata a tutti i membri..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-neon-green resize-none h-20 placeholder:text-slate-600"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={sendingUpdate || !newUpdateContent.trim()}
                                        className="h-12 px-6 bg-neon-green text-black font-bold uppercase tracking-wider text-sm rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                                    >
                                        {sendingUpdate ? <span className="animate-pulse">Invio...</span> : <><Send size={16} /> Invia</>}
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="h-full glass-panel rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500 border-dashed border-2 border-white/10">
                            Seleziona una Task Force dalla dashboard laterale
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Modals ─── */}
            <AnimatePresence>
                {isProjectModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield size={20} className="text-neon-green" /> Nuova Task Force</h3>
                                <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Nome Progetto</label>
                                    <input type="text" required value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-neon-green focus:outline-none text-sm" placeholder="Es. Migrazione Cloud 2025" />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Descrizione/Missione</label>
                                    <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-neon-green focus:outline-none text-sm h-24 resize-none" placeholder="Obiettivo principale della task force..." />
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setIsProjectModalOpen(false)} className="flex-1 py-3 text-sm font-bold bg-white/5 text-white hover:bg-white/10 rounded-lg transition-colors">Annulla</button>
                                    <button type="submit" className="flex-1 py-3 text-sm font-bold bg-neon-green text-black hover:bg-emerald-400 rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">Inizia Operazione</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}

                {isMemberModalOpen && (user?.is_admin === 1 || selectedProject?.members.some(m => m.user_id === user?.id && m.role === 'Leader')) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserPlus size={20} className="text-neon-green" /> Aggiungi Membro</h3>
                                <button onClick={() => setIsMemberModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleAddMember} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Seleziona Utente</label>
                                    <select
                                        required
                                        value={selectedUserId}
                                        onChange={e => setSelectedUserId(e.target.value as any)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-neon-green focus:outline-none text-sm appearance-none"
                                    >
                                        <option value="" disabled>-- Scegli un operatore --</option>
                                        {allUsers.filter(u => !selectedProject?.members.some(m => m.user_id === u.id)).map(u => (
                                            <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setIsMemberModalOpen(false)} className="flex-1 py-3 text-sm font-bold bg-white/5 text-white hover:bg-white/10 rounded-lg transition-colors">Annulla</button>
                                    <button type="submit" className="flex-1 py-3 text-sm font-bold bg-neon-green text-black hover:bg-emerald-400 rounded-lg transition-colors">Assegna</button>
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
