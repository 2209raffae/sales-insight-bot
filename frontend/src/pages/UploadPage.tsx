import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, FileSpreadsheet, Trash2, Clock } from 'lucide-react';
import axios from 'axios';
import UploadModule from '../components/UploadModule';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const UploadPage = () => {
    const [uploads, setUploads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUploads = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/uploads`);
            setUploads(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUploads();
    }, []);

    const deleteUpload = async (id: string) => {
        if (!window.confirm("Sei sicuro di voler rimuovere questo caricamento? I dati associati ad esso verranno rimossi dal database.")) return;
        try {
            await axios.delete(`${API_BASE_URL}/uploads/${id}`);
            fetchUploads();
        } catch (e: any) {
            alert(`Errore nella rimozione: ${e.message}`);
        }
    };

    return (
        <div className="pt-24 pb-12 min-h-screen relative z-10 w-full animate-in fade-in zoom-in duration-500 flex flex-col items-center">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-16"
            >
                <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-neon-blue via-neon-cyan to-neon-purple text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(0,242,254,0.3)] tracking-tighter uppercase">
                    Nexus Ingestion Point
                </h1>
                <p className="mt-4 text-neon-blue/80 text-xl font-light tracking-widest uppercase mb-6">
                    <Database className="inline-block mr-2 mb-1" size={20} />
                    Sincronizzazione Dati Modulari
                </p>
                <div className="w-24 h-1 bg-gradient-to-r from-neon-blue to-neon-purple mx-auto mt-6 rounded-full shadow-[0_0_10px_#00f2fe]"></div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl w-full px-4 mb-16">
                {/* Upload Leads */}
                <UploadModule
                    title="Leads Raw Data"
                    endpoint="/leads/upload"
                    icon={Database}
                    onSuccess={fetchUploads}
                />

                {/* Upload Spend */}
                <UploadModule
                    title="Campaign Spend"
                    endpoint="/spend/upload"
                    icon={FileSpreadsheet}
                    onSuccess={fetchUploads}
                />
            </div>

            {/* Upload History Table */}
            <div className="w-full max-w-5xl px-4 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    <Clock className="text-neon-purple drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" size={28} />
                    <h2 className="text-2xl font-black text-white/90 uppercase tracking-widest text-shadow-sm">Archivio Sincronizzazioni</h2>
                </div>

                <div className="glass-panel p-0 rounded-xl overflow-hidden relative min-h-[200px]">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 backdrop-blur-sm">
                            <Clock size={32} className="text-neon-purple animate-spin" />
                        </div>
                    )}

                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-black/80 backdrop-blur-md">
                                <tr>
                                    <th className="p-4 text-neon-purple font-bold uppercase text-xs border-b border-white/10 w-32">Caricamento</th>
                                    <th className="p-4 text-neon-purple font-bold uppercase text-xs border-b border-white/10">Dataset</th>
                                    <th className="p-4 text-neon-purple font-bold uppercase text-xs border-b border-white/10 hidden md:table-cell">File d'origine</th>
                                    <th className="p-4 text-neon-purple font-bold uppercase text-xs border-b border-white/10 text-right">Elementi</th>
                                    <th className="p-4 text-neon-purple font-bold uppercase text-xs border-b border-white/10 text-center w-24">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {uploads.map((u, i) => (
                                        <motion.tr
                                            key={u.upload_id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <td className="p-4 font-mono text-gray-400 text-xs">
                                                {new Date(u.uploaded_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                                            </td>
                                            <td className="p-4 uppercase font-bold text-xs tracking-wider text-gray-200">
                                                <span className={`px-2 py-1 rounded bg-white/10 border ${u.dataset === 'leads' ? 'border-neon-blue/40 text-neon-blue' : 'border-neon-cyan/40 text-neon-cyan'}`}>
                                                    {u.dataset}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-400 font-mono text-xs hidden md:table-cell truncate max-w-[200px]" title={u.filename}>
                                                {u.filename}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-mono text-white text-sm">+{u.rows_new} Inseriti</span>
                                                    {(u.rows_updated > 0 || u.rows_skipped > 0) && (
                                                        <span className="text-xs text-gray-500 font-mono">
                                                            {u.rows_updated > 0 ? `~${u.rows_updated} Agg.` : ''} {u.rows_skipped > 0 ? `Skipped: ${u.rows_skipped}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 flex justify-center items-center">
                                                <button
                                                    onClick={() => deleteUpload(u.upload_id)}
                                                    className="p-2 text-red-500/80 hover:text-red-400 hover:bg-red-500/20 bg-red-500/10 rounded transition-all focus:outline-none"
                                                    title="Rimuovi caricamento e dati associati"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                                {!loading && uploads.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-gray-500 italic">
                                            Nessuna sincronizzazione registrata.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Decorative Grid Background for this specific page */}
            <div
                className="fixed inset-0 pointer-events-none z-[-1] opacity-10"
                style={{
                    backgroundImage: `linear-gradient(rgba(0, 242, 254, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 242, 254, 0.1) 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            ></div>
        </div>
    );
};

export default UploadPage;
