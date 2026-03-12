import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, Eye, EyeOff, AlertTriangle, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 via-transparent to-neon-purple/5 pointer-events-none" />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md glass-panel rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-neon-blue/10 rounded-full blur-3xl" />

                <div className="text-center mb-8 relative z-10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-white/10 flex items-center justify-center">
                        <Zap size={28} className="text-neon-blue" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-white">Nexus Hub</h1>
                    <p className="text-sm text-slate-400 mt-1">Accedi alla piattaforma</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 transition-all"
                            placeholder="la.tua@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 transition-all"
                                placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(0,210,255,0.3)] transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><LogIn size={18} /> Accedi</>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500 relative z-10">
                    Non hai un account?{' '}
                    <Link to="/register" className="text-neon-blue hover:text-neon-cyan transition-colors font-semibold">Registrati</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
