import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { UserPlus, Eye, EyeOff, AlertTriangle, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const RegisterPage = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: '', password: '', first_name: '', last_name: '', role: 'Utente'
    });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (form.password.length < 6) {
            setError('La password deve avere almeno 6 caratteri');
            return;
        }
        setLoading(true);
        try {
            await register(form);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Errore di registrazione');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 via-transparent to-neon-pink/5 pointer-events-none" />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md glass-panel rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple via-neon-pink to-neon-blue" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-neon-purple/10 rounded-full blur-3xl" />

                <div className="text-center mb-8 relative z-10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 border border-white/10 flex items-center justify-center">
                        <Zap size={28} className="text-neon-purple" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-white">Crea Account</h1>
                    <p className="text-sm text-slate-400 mt-1">Unisciti al Nexus Hub</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nome</label>
                            <input name="first_name" value={form.first_name} onChange={handleChange} required
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all"
                                placeholder="Mario" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Cognome</label>
                            <input name="last_name" value={form.last_name} onChange={handleChange} required
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all"
                                placeholder="Rossi" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Email</label>
                        <input type="email" name="email" value={form.email} onChange={handleChange} required
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all"
                            placeholder="la.tua@email.com" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Ruolo Aziendale</label>
                        <select name="role" value={form.role} onChange={handleChange}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all">
                            <option value="Utente">Utente</option>
                            <option value="Commerciale">Commerciale</option>
                            <option value="HR Manager">HR Manager</option>
                            <option value="Direttore">Direttore</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Amministratore">Amministratore</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Password</label>
                        <div className="relative">
                            <input type={showPw ? "text" : "password"} name="password" value={form.password} onChange={handleChange} required minLength={6}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 pr-12 text-sm text-white focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all"
                                placeholder="Min. 6 caratteri" />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-neon-purple to-neon-pink rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all disabled:opacity-50 mt-2">
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><UserPlus size={18} /> Registrati</>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500 relative z-10">
                    Hai già un account?{' '}
                    <Link to="/login" className="text-neon-purple hover:text-neon-pink transition-colors font-semibold">Accedi</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default RegisterPage;
