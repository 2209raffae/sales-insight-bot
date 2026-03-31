import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Trash2, Save, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const AGENTS = [
    { slug: 'sales-insight', label: 'Sales Insight', color: 'neon-blue' },
    { slug: 'hr-copilot', label: 'HR Copilot', color: 'neon-pink' },
    { slug: 'competitor-radar', label: 'Competitor Radar', color: 'neon-amber' },
    { slug: 'task-force', label: 'Task Force', color: 'neon-green' },
];

interface UserData {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_admin: number;
    permissions: { agent_slug: string; module_slug: string | null }[];
    expertise: { id: number; name: string }[];
}

interface ExpertiseCategory {
    id: number;
    name: string;
}

const AdminPanel = () => {
    const { user, token } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [categories, setCategories] = useState<ExpertiseCategory[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<number | null>(null);
    const [saving, setSaving] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'categories'>('users');

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch {
            setError('Errore nel caricamento utenti');
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/admin/categories', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCategories(res.data);
        } catch {
            setError('Errore nel caricamento categorie');
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([fetchUsers(), fetchCategories()]);
        setLoading(false);
    };

    useEffect(() => { loadAll(); }, []);

    const toggleAgent = (userId: number, agentSlug: string) => {
        setUsers(prev => prev.map(u => {
            if (u.id !== userId) return u;
            const hasAgent = u.permissions.some(p => p.agent_slug === agentSlug);
            if (hasAgent) {
                return { ...u, permissions: u.permissions.filter(p => p.agent_slug !== agentSlug) };
            } else {
                return { ...u, permissions: [...u.permissions, { agent_slug: agentSlug, module_slug: null }] };
            }
        }));
    };

    const toggleExpertise = (userId: number, catId: number) => {
        setUsers(prev => prev.map(u => {
            if (u.id !== userId) return u;
            const hasExp = u.expertise.some(e => e.id === catId);
            if (hasExp) {
                return { ...u, expertise: u.expertise.filter(e => e.id !== catId) };
            } else {
                const cat = categories.find(c => c.id === catId);
                if (!cat) return u;
                return { ...u, expertise: [...u.expertise, cat] };
            }
        }));
    };

    const saveUserChanges = async (userId: number) => {
        setSaving(userId);
        try {
            const u = users.find(x => x.id === userId);
            if (!u) return;

            // Save Permissions
            await axios.put(`/api/admin/users/${userId}/permissions`, {
                permissions: u.permissions.map(p => ({ agent_slug: p.agent_slug, module_slug: p.module_slug }))
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Save Details & Expertise (via update user)
            await axios.put(`/api/admin/users/${userId}`, {
                first_name: u.first_name,
                last_name: u.last_name,
                role: u.role,
                expertise_ids: u.expertise.map(e => e.id)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

        } catch {
            setError('Errore nel salvataggio modifiche');
        } finally {
            setSaving(null);
        }
    };

    const deleteUser = async (userId: number) => {
        if (!confirm('Sei sicuro di voler eliminare questo utente?')) return;
        try {
            await axios.delete(`/api/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Errore eliminazione');
        }
    };

    const addCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const res = await axios.post('/api/admin/categories', { name: newCategoryName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCategories(prev => [...prev, res.data]);
            setNewCategoryName('');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Errore creazione categoria');
        }
    };

    const deleteCategory = async (id: number) => {
        if (!confirm('Eliminare questa categoria? Rimuoverà l\'associazione da tutti gli utenti.')) return;
        try {
            await axios.delete(`/api/admin/categories/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCategories(prev => prev.filter(c => c.id !== id));
            // Update local user state to remove the deleted category from their expertise
            setUsers(prev => prev.map(u => ({
                ...u,
                expertise: u.expertise.filter(e => e.id !== id)
            })));
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Errore eliminazione categoria');
        }
    };

    if (!user || user.is_admin !== 1) {
        return (
            <div className="pt-24 pb-12 w-full flex items-center justify-center min-h-screen">
                <div className="glass-panel p-8 rounded-xl text-center">
                    <Shield size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white">Accesso Negato</h2>
                    <p className="text-slate-400 mt-2">Solo gli amministratori possono accedere a questa pagina.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 min-h-screen flex flex-col px-4 max-w-6xl mx-auto">

            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-amber to-neon-pink text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                        <Shield size={36} className="text-neon-amber" />
                        Admin Panel
                    </h1>
                    <div className="flex items-center gap-6 mt-4">
                        <button 
                            onClick={() => setActiveTab('users')}
                            className={`text-xs uppercase font-bold tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'users' ? 'border-neon-amber text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            Gestione Utenti
                        </button>
                        <button 
                            onClick={() => setActiveTab('categories')}
                            className={`text-xs uppercase font-bold tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'categories' ? 'border-neon-amber text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            Categorie Competenze
                        </button>
                    </div>
                </div>
            </motion.div>

            {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-white">✕</button>
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-neon-amber/30 border-t-neon-amber rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-4">
                    {activeTab === 'users' ? (
                        <AnimatePresence>
                            {users.map((u, idx) => (
                                <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                                    className="glass-panel rounded-xl overflow-hidden">

                                    {/* User Header */}
                                    <div
                                        onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${u.is_admin ? 'bg-neon-amber/20 text-neon-amber border border-neon-amber/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
                                                {u.first_name[0]}{u.last_name[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    {u.first_name} {u.last_name}
                                                    {u.is_admin === 1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-amber/20 text-neon-amber border border-neon-amber/30 uppercase font-bold">Admin</span>}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                                    <span>{u.email}</span>
                                                    <span>•</span>
                                                    <span className="text-neon-amber/80">{u.role}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="hidden md:flex gap-1 overflow-hidden max-w-[150px]">
                                                {u.expertise.map(e => (
                                                    <span key={e.id} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10 whitespace-nowrap">
                                                        {e.name}
                                                    </span>
                                                ))}
                                            </div>
                                            {expandedUser === u.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                        </div>
                                    </div>

                                    {/* Expanded: Permissions & Expertise */}
                                    {expandedUser === u.id && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-white/5 p-5 bg-black/20">

                                            <div className="grid md:grid-cols-2 gap-8 mb-6">
                                                {/* Profile Details */}
                                                <div className="space-y-4">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Dettagli Profilo</div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[9px] text-slate-500 uppercase ml-1">Nome</label>
                                                            <input 
                                                                type="text" 
                                                                value={u.first_name} 
                                                                onChange={(e) => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, first_name: e.target.value } : x))}
                                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-neon-amber/50 outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] text-slate-500 uppercase ml-1">Cognome</label>
                                                            <input 
                                                                type="text" 
                                                                value={u.last_name} 
                                                                onChange={(e) => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, last_name: e.target.value } : x))}
                                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-neon-amber/50 outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-slate-500 uppercase ml-1">Ruolo Operativo</label>
                                                        <input 
                                                            type="text" 
                                                            value={u.role} 
                                                            onChange={(e) => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: e.target.value } : x))}
                                                            placeholder="es. Frontend Developer, Manager"
                                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-neon-amber/50 outline-none"
                                                        />
                                                    </div>

                                                    <div className="mt-4">
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Moduli Accessibili</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {AGENTS.map(a => {
                                                                const hasAccess = u.permissions.some(p => p.agent_slug === a.slug);
                                                                return (
                                                                    <button
                                                                        key={a.slug}
                                                                        onClick={() => toggleAgent(u.id, a.slug)}
                                                                        className={`p-2 rounded-lg border text-[11px] font-bold transition-all text-center ${hasAccess
                                                                            ? `bg-${a.color}/10 border-${a.color}/40 text-${a.color} shadow-[0_0_10px_rgba(255,255,255,0.05)]`
                                                                            : 'bg-black/30 border-white/5 text-slate-500 hover:border-white/20'
                                                                            }`}
                                                                    >
                                                                        {a.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Skills / Expertise */}
                                                <div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Competenze & Expertise</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {categories.length === 0 && <p className="text-xs text-slate-600 italic">Nessuna categoria definita</p>}
                                                        {categories.map(c => {
                                                            const hasExp = u.expertise.some(e => e.id === c.id);
                                                            return (
                                                                <button
                                                                    key={c.id}
                                                                    onClick={() => toggleExpertise(u.id, c.id)}
                                                                    className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all ${hasExp
                                                                        ? 'bg-neon-amber/10 border-neon-amber/40 text-neon-amber shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                                                        : 'bg-black/30 border-white/5 text-slate-500 hover:border-white/20'
                                                                        }`}
                                                                >
                                                                    {c.name}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                                                <button
                                                    onClick={() => saveUserChanges(u.id)}
                                                    disabled={saving === u.id}
                                                    className="px-6 py-2 bg-gradient-to-r from-neon-green/80 to-neon-blue/80 rounded-lg text-sm font-bold flex items-center gap-2 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 text-white"
                                                >
                                                    {saving === u.id ? (
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Save size={16} />
                                                    )}
                                                    Salva Modifiche
                                                </button>

                                                {u.id !== user?.id && (
                                                    <button
                                                        onClick={() => deleteUser(u.id)}
                                                        className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-bold flex items-center gap-2 hover:bg-red-500/20 transition-all"
                                                    >
                                                        <Trash2 size={16} /> Elimina Utente
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6 rounded-xl">
                            <div className="flex gap-3 mb-8">
                                <input 
                                    type="text" 
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Nome nuova categoria (es. Frontend Auto)"
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-neon-amber/50 transition-all"
                                />
                                <button 
                                    onClick={addCategory}
                                    className="px-6 py-2 bg-neon-amber rounded-lg text-black font-bold uppercase tracking-widest text-xs hover:bg-neon-amber/80 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                >
                                    Aggiungi
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-white">
                                {categories.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 group hover:border-white/20 transition-all">
                                        <div className="font-bold tracking-tight">{c.name}</div>
                                        <button 
                                            onClick={() => deleteCategory(c.id)}
                                            className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                                {categories.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-slate-500 italic uppercase tracking-widest text-xs">
                                        Nessuna categoria creata. Inizia aggiungendone una sopra.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
