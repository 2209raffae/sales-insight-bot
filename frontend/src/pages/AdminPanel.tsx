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
}

const AdminPanel = () => {
    const { user, token } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<number | null>(null);
    const [saving, setSaving] = useState<number | null>(null);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch {
            setError('Errore nel caricamento utenti');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

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

    const savePermissions = async (userId: number) => {
        setSaving(userId);
        try {
            const u = users.find(x => x.id === userId);
            if (!u) return;
            await axios.put(`/api/admin/users/${userId}/permissions`, {
                permissions: u.permissions.map(p => ({ agent_slug: p.agent_slug, module_slug: p.module_slug }))
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch {
            setError('Errore nel salvataggio permessi');
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
        <div className="pt-24 pb-12 w-full animate-in fade-in duration-500 relative z-10 min-h-screen flex flex-col">

            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-4xl font-black bg-gradient-to-r from-neon-amber to-neon-pink text-transparent bg-clip-text tracking-tighter uppercase mb-2">
                        <Shield size={36} className="text-neon-amber" />
                        Admin Panel
                    </h1>
                    <p className="text-gray-400 font-light tracking-wide flex items-center gap-2 text-sm uppercase">
                        <span className="w-2 h-2 rounded-full bg-neon-amber animate-pulse"></span>
                        Gestione Utenti e Permessi Piattaforma
                    </p>
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
                                                <span>{u.role}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1">
                                            {AGENTS.map(a => (
                                                <div key={a.slug}
                                                    className={`w-2.5 h-2.5 rounded-full transition-all ${u.permissions.some(p => p.agent_slug === a.slug) ? `bg-${a.color} shadow-[0_0_6px]` : 'bg-white/10'}`} />
                                            ))}
                                        </div>
                                        {expandedUser === u.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                    </div>
                                </div>

                                {/* Expanded: Permissions */}
                                {expandedUser === u.id && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-white/5 p-5 bg-black/20">

                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Permessi Agenti</div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                                            {AGENTS.map(a => {
                                                const hasAccess = u.permissions.some(p => p.agent_slug === a.slug);
                                                return (
                                                    <button
                                                        key={a.slug}
                                                        onClick={() => toggleAgent(u.id, a.slug)}
                                                        className={`p-3 rounded-lg border text-sm font-bold transition-all text-center ${hasAccess
                                                            ? `bg-${a.color}/10 border-${a.color}/40 text-${a.color} shadow-[0_0_10px_rgba(255,255,255,0.05)]`
                                                            : 'bg-black/30 border-white/5 text-slate-500 hover:border-white/20'
                                                            }`}
                                                    >
                                                        {a.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={() => savePermissions(u.id)}
                                                disabled={saving === u.id}
                                                className="px-4 py-2 bg-gradient-to-r from-neon-green/80 to-neon-blue/80 rounded-lg text-sm font-bold flex items-center gap-2 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
                                            >
                                                {saving === u.id ? (
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <Save size={16} />
                                                )}
                                                Salva Permessi
                                            </button>

                                            {u.id !== user?.id && (
                                                <button
                                                    onClick={() => deleteUser(u.id)}
                                                    className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-bold flex items-center gap-2 hover:bg-red-500/20 transition-all"
                                                >
                                                    <Trash2 size={16} /> Elimina
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
