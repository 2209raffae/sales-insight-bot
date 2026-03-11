import { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, ShieldAlert, User, Briefcase, GraduationCap, Star } from 'lucide-react';

interface CVResult {
    candidate_name: string;
    years_of_experience: number;
    top_skills: string[];
    education_summary: string;
    match_score: number | null;
    match_reasoning: string;
    red_flags: string[];
}

const TalentScreeningPage = () => {
    const [cvText, setCvText] = useState('');
    const [jdText, setJdText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<CVResult | null>(null);
    const [errorMSG, setErrorMSG] = useState('');

    const handleAnalyze = async () => {
        if (!cvText.trim()) {
            setErrorMSG("Inserisci il testo del CV da analizzare.");
            return;
        }
        setErrorMSG('');
        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/hr/screening', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cv_text: cvText,
                    job_description: jdText.trim() ? jdText : null
                })
            });

            if (!response.ok) {
                throw new Error("Errore durante l'analisi del CV");
            }

            const data = await response.json();
            setResult(data.result);
        } catch (err: any) {
            setErrorMSG(err.message || 'Errore di connessione');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 pb-20 mt-4 sm:mt-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-['Space_Grotesk'] text-white flex items-center gap-3">
                    <Briefcase className="text-neon-purple" size={32} />
                    Talent <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-blue">Screening AI</span>
                </h1>
                <p className="text-slate-400 mt-2">Analizza CV estraendo skill, esperienza e valuta il match con la Job Description.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Input Form */}
                <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-3xl" />

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                            <User size={16} className="text-neon-cyan" />
                            Testo del Curriculum (CV) *
                        </label>
                        <textarea
                            className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all font-mono resize-none"
                            placeholder="Incolla qui il testo del CV del candidato..."
                            value={cvText}
                            onChange={(e) => setCvText(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                            <FileText size={16} className="text-neon-pink" />
                            Job Description (Opzionale)
                        </label>
                        <textarea
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-neon-pink focus:ring-1 focus:ring-neon-pink/50 transition-all font-mono resize-none disabled:opacity-50"
                            placeholder="Incolla la Job Description per ottenere un Match Score..."
                            value={jdText}
                            onChange={(e) => setJdText(e.target.value)}
                        />
                    </div>

                    {errorMSG && (
                        <div className="text-red-400 text-sm flex items-center gap-2 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            <AlertTriangle size={16} /> {errorMSG}
                        </div>
                    )}

                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !cvText.trim()}
                        className="mt-2 w-full py-3 px-4 bg-gradient-to-r from-neon-purple/80 to-neon-blue/80 hover:from-neon-purple hover:to-neon-blue rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <UploadCloud size={20} />
                                Analizza Candidato
                            </>
                        )}
                    </button>
                </div>

                {/* Results Panel */}
                <div className="glass-panel rounded-2xl p-6 border border-white/5 relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 blur-3xl" />

                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-neon-green" />
                        Risultati Analisi AI
                    </h2>

                    {!result && !isLoading && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
                            <Bot size={48} className="opacity-20" />
                            <p className="text-sm">Avvia l'analisi per visualizzare i risultati</p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex-1 flex flex-col items-center justify-center text-neon-purple gap-4 animate-pulse">
                            <Bot size={48} />
                            <p className="text-sm font-semibold tracking-widest uppercase">Elaborazione reti neurali...</p>
                        </div>
                    )}

                    {result && !isLoading && (
                        <div className="flex-1 overflow-y-auto pr-2 space-y-6">

                            {/* Header Info */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-white">{result.candidate_name}</h3>
                                    <div className="flex items-center gap-2 text-neon-cyan text-sm mt-1">
                                        <Briefcase size={14} />
                                        <span>~{result.years_of_experience} anni di esperienza</span>
                                    </div>
                                </div>
                                {result.match_score !== null && (
                                    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 ${result.match_score >= 80 ? 'border-neon-green text-neon-green shadow-[0_0_15px_rgba(16,185,129,0.3)]' : result.match_score >= 50 ? 'border-neon-amber text-neon-amber' : 'border-red-500 text-red-500'}`}>
                                        <span className="text-xl font-bold">{result.match_score}</span>
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Match</span>
                                    </div>
                                )}
                            </div>

                            {/* Education */}
                            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <GraduationCap size={14} className="text-neon-pink" />
                                    Formazione
                                </h4>
                                <p className="text-sm text-slate-200 leading-relaxed">{result.education_summary}</p>
                            </div>

                            {/* Top Skills */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Star size={14} className="text-neon-blue" />
                                    Competenze Chiave (Estrazione AI)
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {result.top_skills.length > 0 ? result.top_skills.map((skill, i) => (
                                        <span key={i} className="px-3 py-1 bg-neon-purple/10 border border-neon-purple/30 text-neon-purple rounded-full text-xs font-semibold">
                                            {skill}
                                        </span>
                                    )) : (
                                        <span className="text-sm text-slate-500">Nessuna competenza rilevata</span>
                                    )}
                                </div>
                            </div>

                            {/* Match Reasoning */}
                            {result.match_reasoning && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Valutazione Match JD</h4>
                                    <p className="text-sm text-slate-300 italic p-3 border-l-2 border-neon-amber bg-neon-amber/5 rounded-r-lg">
                                        "{result.match_reasoning}"
                                    </p>
                                </div>
                            )}

                            {/* Red Flags */}
                            {result.red_flags && result.red_flags.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <ShieldAlert size={14} />
                                        Attenzioni / Red Flags
                                    </h4>
                                    <ul className="space-y-2">
                                        {result.red_flags.map((flag, i) => (
                                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2 bg-red-500/5 p-2 rounded border border-red-500/10">
                                                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                                <span>{flag}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Mock lucide-react Bot se manca nell'import
import { Bot } from 'lucide-react';

export default TalentScreeningPage;
