import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = 'http://127.0.0.1:4000/api';

const UploadModule = ({
    title,
    endpoint,
    icon: Icon,
    onSuccess
}: {
    title: string,
    endpoint: string,
    icon: React.ElementType,
    onSuccess?: () => void
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setMessage('Sincronizzazione dati in corso...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setStatus('success');
                setMessage(`Trasferimento completato. Record elaborati: ${result.rows_inserted || result.total_inserted || 0}`);
                if (onSuccess) {
                    onSuccess();
                }
            } else {
                setStatus('error');
                setMessage(result.detail || 'Errore di sincronizzazione.');
            }
        } catch (error: any) {
            setStatus('error');
            setMessage(error.message || 'Errore di rete. Impossibile raggiungere il server orbitale.');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-xl border-t border-t-neon-blue/30 relative"
        >
            <div className="absolute top-0 right-0 w-20 h-20 bg-neon-blue/10 blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue shadow-[0_0_15px_rgba(0,242,254,0.3)]">
                    <Icon size={28} />
                </div>
                <h2 className="text-2xl font-bold tracking-wider uppercase text-white/90">{title}</h2>
            </div>

            <div className="space-y-6">
                <div className="relative border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-neon-blue/50 transition-colors bg-black/40 group">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center gap-4 text-gray-400 group-hover:text-neon-blue transition-colors">
                        <motion.div
                            animate={file ? { y: [0, -5, 0] } : {}}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            {file ? <FileText size={48} className="text-neon-blue" /> : <Upload size={48} />}
                        </motion.div>

                        {file ? (
                            <div>
                                <p className="text-neon-blue font-medium">{file.name}</p>
                                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <div>
                                <p className="font-medium text-lg text-white">Trascina il CSV qui per avviare il linkuplink</p>
                                <p className="text-sm mt-1">Formato supportato: .csv (UTF-8)</p>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleUpload}
                    disabled={!file || status === 'uploading'}
                    className={`w-full py-4 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2
            ${!file
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : status === 'uploading'
                                ? 'bg-neon-blue/50 text-white cursor-wait'
                                : 'bg-neon-blue text-black hover:bg-white hover:shadow-[0_0_20px_#00f2fe]'
                        }
          `}
                >
                    {status === 'uploading' ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                            <RefreshCw size={20} />
                        </motion.div>
                    ) : (
                        <Upload size={20} />
                    )}
                    {status === 'uploading' ? 'Trasmissione...' : 'Avvia Trasferimento'}
                </button>

                <AnimatePresence>
                    {status !== 'idle' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`p-4 rounded-lg border ${status === 'success'
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : status === 'uploading'
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {status === 'success' && <CheckCircle className="mt-0.5 shrink-0" size={18} />}
                                {status === 'error' && <AlertCircle className="mt-0.5 shrink-0" size={18} />}
                                {status === 'uploading' && <RefreshCw className="mt-0.5 shrink-0 animate-spin" size={18} />}
                                <p className="text-sm">{message}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default UploadModule;
