import React from 'react';
import { 
  Play, Clock, Database, Search, Shield, Zap, AlertCircle, 
  Terminal, BarChart2, Activity, ChevronRight, Layout,
  RefreshCw, PlusCircle, Bot, AlertTriangle, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Company {
  id: number;
  name: string;
}

interface HistoryItem {
  query: string;
  company_id: number;
  timestamp: string;
}

export const QueryForm = ({ 
  companies = [], 
  onRun, 
  onCreateDemo,
  loading, 
  creatingDemo,
  currentCompany, 
  setCurrentCompany, 
  query, 
  setQuery,
  onRefreshCompanies
}: any) => {
  const isCompaniesArray = Array.isArray(companies);
  const noCompanies = isCompaniesArray && companies.length === 0;

  return (
    <div className="glass-panel p-6 rounded-xl space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-neon-amber" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/80">Setup Richiesta</h3>
        </div>
        {noCompanies && (
           <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onCreateDemo}
            disabled={creatingDemo}
            className="text-[10px] bg-neon-blue/20 hover:bg-neon-blue/40 text-neon-blue border border-neon-blue/30 px-3 py-1 rounded-full flex items-center gap-1.5 font-bold transition-all uppercase"
           >
             {creatingDemo ? <RefreshCw size={10} className="animate-spin" /> : <PlusCircle size={10} />}
             Crea azienda demo
           </motion.button>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block ml-1">Seleziona Company</label>
          <select 
            value={currentCompany}
            onChange={(e) => setCurrentCompany(e.target.value)}
            className={`w-full bg-black/40 border ${noCompanies ? 'border-neon-amber/40' : 'border-white/10'} rounded-lg px-4 py-2 text-sm text-white focus:border-neon-amber/50 outline-none transition-all`}
          >
            <option value="">-- Seleziona Azienda --</option>
            {isCompaniesArray && companies.map((company: any) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          {noCompanies && (
            <div className="mt-3 p-3 bg-neon-amber/10 border border-neon-amber/20 rounded-lg">
              <p className="text-[10px] text-neon-amber flex items-center gap-1.5 font-medium leading-relaxed">
                <AlertTriangle size={12} /> ⚠️ Nessuna azienda disponibile. Usa il tasto sopra per inizializzare un ambiente di test.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block ml-1">Domanda per l'AI</label>
          <textarea 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Esegui una query di testing..."
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-neon-amber/50 outline-none transition-all min-h-[120px] resize-none"
          />
        </div>

        <button 
          onClick={onRun}
          className={`w-full py-3 bg-gradient-to-r from-neon-amber to-neon-pink rounded-lg text-black font-black uppercase tracking-widest text-xs hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <><Play size={14} fill="currentColor" /> Esegui Query</>
          )}
        </button>
      </div>
    </div>
  );
};

export const AgentResultCard = ({ agent, result }: { agent: string, result: any }) => {
  const isError = result.status === 'error';
  return (
    <div className={`p-4 rounded-xl border ${isError ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'} transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${isError ? 'bg-red-500/20 text-red-400' : 'bg-neon-blue/20 text-neon-blue'}`}>
            <Bot size={14} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-white">{agent}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <Clock size={10} /> {result.metadata?.execution_time_seconds || '0'}s
        </div>
      </div>
      <p className={`text-xs leading-relaxed ${isError ? 'text-red-300' : 'text-slate-300'}`}>
        {result.summary}
      </p>
      {result.warnings?.length > 0 && (
         <div className="mt-2 space-y-1">
           {result.warnings.map((w: string, idx: number) => (
             <div key={idx} className="text-[9px] text-neon-amber flex items-center gap-1 opacity-80 italic">
               <AlertCircle size={8} /> {w}
             </div>
           ))}
         </div>
      )}
    </div>
  );
};

export const ResponseCard = ({ result, loading, onRunAgain, showDebug }: any) => {
  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center gap-4 border border-white/5 shadow-2xl">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin" />
          <Bot size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-neon-blue animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-xs text-white/80 uppercase tracking-widest font-black mb-1">Nexus sta ragionando</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Coordinamento agenti in corso...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass-panel p-12 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-600 bg-black/20">
        <div className="p-4 bg-white/5 rounded-full mb-6">
          <Zap size={48} className="opacity-20 text-neon-blue" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest italic mb-6">Pronto per il testing</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl px-4 text-center">
            {['Perché le vendite sono calate?', 'Abbiamo problemi di stock?', 'Analizza performance'].map(s => (
               <div key={s} className="p-3 bg-white/5 border border-white/5 rounded-lg text-[10px] uppercase font-bold text-slate-500 hover:text-white transition-colors cursor-default">
                 {s}
               </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-0 rounded-xl overflow-hidden flex flex-col h-full border border-white/10 shadow-3xl">
      <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-blue/10 rounded-lg">
            <Bot size={24} className="text-neon-blue" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tighter">Aggregated Response</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-neon-blue uppercase flex items-center gap-1">
                <Activity size={10} /> {result.intent}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 border-l border-white/10 pl-3">
                <Clock size={10} /> {result.metadata?.execution_time_seconds}s
              </span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={onRunAgain}
          className="p-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 text-slate-400 hover:text-neon-blue transition-all"
          title="Riesegui query"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {/* Agent Level Results */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={14} className="text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Output per Agente</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(result.raw_results || {}).map(([slug, res]: [string, any]) => (
              <AgentResultCard key={slug} agent={slug} result={res} />
            ))}
          </div>
        </div>

        {/* Final Conclusion */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-neon-pink" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Conclusione Orchestratore</span>
          </div>
          <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-6 rounded-2xl text-slate-200 text-sm leading-relaxed shadow-xl ring-1 ring-inset ring-white/5">
            {result.final_response}
          </div>
        </div>
      </div>
      
      {showDebug && (
        <div className="bg-neon-blue/5 border-t border-neon-blue/20 p-4">
          <div className="flex items-center justify-between gap-4">
             <div className="flex items-center gap-4">
               <div className="text-[10px] font-bold uppercase text-neon-blue">Debug Active</div>
               <div className="h-4 w-[1px] bg-neon-blue/20"></div>
               <div className="text-[10px] font-mono text-slate-400">Confidence: {(result.metadata?.confidence * 100).toFixed(1)}%</div>
             </div>
             <div className="text-[10px] font-mono text-slate-500">{result.metadata?.timestamp}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export const DebugPanel = ({ result, requestPayload, localTimestamp, selectedCompany }: any) => {
  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="glass-panel p-6 rounded-xl border-l-4 border-l-neon-purple shadow-2xl flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-neon-purple" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/80">Payload Inspection</h3>
          </div>
          <span className="text-[9px] font-mono text-slate-500 px-2 py-0.5 bg-black/40 rounded border border-white/5">
            {localTimestamp}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
             <div className="text-[9px] uppercase font-bold text-slate-500 pl-1">Target Entity</div>
             <div className="px-3 py-2 bg-black/60 rounded-lg border border-white/5 text-[10px] font-mono text-neon-blue truncate">
               {selectedCompany?.name || 'ID: ' + requestPayload?.company_id}
             </div>
          </div>
          <div className="space-y-1">
             <div className="text-[9px] uppercase font-bold text-slate-500 pl-1">Intent / Confidence</div>
             <div className="px-3 py-2 bg-black/60 rounded-lg border border-white/5 text-[10px] font-mono text-neon-amber">
               {result?.intent} ({(result?.metadata?.confidence * 100).toFixed(1)}%)
             </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="text-[10px] text-neon-purple font-bold uppercase mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-purple shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
              Request Payload
            </div>
            <div className="flex-1 bg-black/80 p-4 rounded-xl border border-white/10 overflow-y-auto custom-scrollbar font-mono text-[10px] text-slate-300">
              <pre>{JSON.stringify(requestPayload, null, 2)}</pre>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="text-[10px] text-neon-amber font-bold uppercase mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-amber shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
              API JSON Response
            </div>
            <div className="flex-1 bg-black/80 p-4 rounded-xl border border-white/10 overflow-y-auto custom-scrollbar font-mono text-[10px] text-slate-400">
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const HistoryPanel = ({ history, onLoad, companies }: any) => {
  const getCompanyName = (id: number) => {
    return companies?.find((c: any) => c.id === id)?.name || `ID: ${id}`;
  };

  return (
    <div className="glass-panel p-6 rounded-xl overflow-hidden flex flex-col bg-black/30 border border-white/5">
       <div className="flex items-center gap-2 mb-5">
        <Clock size={16} className="text-slate-400" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/80">Recent Lab Tests</h3>
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[500px]">
        {history.map((item: HistoryItem, i: number) => (
          <button
            key={i}
            onClick={() => onLoad(item)}
            className="w-full text-left bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 hover:border-white/20 transition-all group"
          >
            <div className="text-xs text-white font-bold line-clamp-2 mb-2 group-hover:text-neon-blue transition-colors leading-tight">
              {item.query}
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-2">
              <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                <Database size={8} /> {getCompanyName(item.company_id)}
              </span>
              <span className="text-[9px] font-mono text-slate-600">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </button>
        ))}
        {history.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center opacity-30 grayscale">
            <BarChart2 size={32} className="mb-2" />
            <div className="text-[10px] uppercase font-bold tracking-widest italic">Nessun record</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const QuickActions = ({ onSelect, currentCompany }: any) => {
  const tests = [
    { label: 'Sales analysis', query: 'Come stanno andando le vendite questo mese?', color: 'text-neon-blue', variant: 'blue' },
    { label: 'Stock check', query: 'Quali sono i prodotti sotto scorta nel magazzino?', color: 'text-neon-amber', variant: 'amber' },
    { label: 'Cross-Agent', query: 'Perché le vendite calano nonostante il magazzino sia pieno?', color: 'text-neon-pink', variant: 'pink' },
    { label: 'General', query: 'Fammi un riepilogo generale delle performance aziendali.', color: 'text-slate-400', variant: 'slate' }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tests.map(t => (
        <button
          key={t.label}
          onClick={() => onSelect(t.query)}
          className="flex items-center gap-3 px-4 py-2.5 bg-black/40 border border-white/5 rounded-xl hover:border-white/20 transition-all group relative overflow-hidden"
        >
          <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700`} />
          <Zap size={14} className={`${t.color} group-hover:scale-110 transition-transform`} />
          <div className="text-left">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.label}</div>
          </div>
          <ChevronRight size={14} className="ml-auto text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </button>
      ))}
    </div>
  );
};
