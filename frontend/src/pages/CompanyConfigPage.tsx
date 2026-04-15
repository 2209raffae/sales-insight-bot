import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, ChevronLeft, Building2, Layers, Users, Activity, Target,
  Shield, Package, Truck, AlertTriangle, Loader2, SlidersHorizontal,
  ChevronRight, CheckCircle2, Star, Lock, XCircle, Link2, Sparkles,
  Clock, UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NEXUS_AGENTS } from '../config/agents';
import { AgentConfigPanel } from '../components/AgentConfigPanel';
import axios from 'axios';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompanyDetail {
  id: number;
  name: string;
  description: string | null;
  industry: string | null;
  company_size: string | null;
  channels: string[];
  needs: string[];
  complexity_level: string | null;
  suggested_agents: string[];
}

interface AgentEntry {
  slug: string;
  label: string;
  desc: string;
  accent: string;
  glow: string;
  icon: React.ElementType;
  isActive: boolean;
  isRecommended: boolean;
  isLocked: boolean;
  activationSource: 'manual' | 'ai_suggested' | null; // null = never activated
  activatedAt: string | null;
  toggling: boolean;
  recentlyActivated: boolean; // flash highlight after toggle ON
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ── Static knowledge base ─────────────────────────────────────────────────────

// Synergies: outcome sentence + relationship type
const AGENT_SYNERGIES: Record<string, { slug: string; outcome: string; relationship: 'works_best' | 'requires' }[]> = {
  'sales-insight': [
    { slug: 'crm', outcome: 'Sales Insight + CRM → previsioni di vendita collegate ai clienti reali', relationship: 'works_best' },
    { slug: 'competitor-radar', outcome: 'Sales Insight + Competitor Radar → quota di mercato monitorata in tempo reale', relationship: 'works_best' },
  ],
  'crm': [
    { slug: 'sales-insight', outcome: 'CRM + Sales Insight → pipeline commerciale con storico cliente integrato', relationship: 'works_best' },
    { slug: 'logistics-hub', outcome: 'CRM + Logistics Hub → stato spedizioni visibile nel profilo cliente', relationship: 'works_best' },
  ],
  'warehouse-intelligence': [
    { slug: 'logistics-hub', outcome: 'Warehouse + Logistics → previsioni di consegna più rapide grazie allo stock in tempo reale', relationship: 'works_best' },
    { slug: 'sales-insight', outcome: 'Warehouse + Sales Insight → riordini automatici basati sulla domanda prevista', relationship: 'works_best' },
  ],
  'logistics-hub': [
    { slug: 'warehouse-intelligence', outcome: 'Logistics + Warehouse → zero rotture di stock durante la preparazione ordini', relationship: 'requires' },
    { slug: 'crm', outcome: 'Logistics + CRM → notifiche di spedizione collegate al profilo cliente', relationship: 'works_best' },
  ],
  'competitor-radar': [
    { slug: 'sales-insight', outcome: 'Competitor Radar + Sales Insight → strategie di prezzo aggiornate sulla concorrenza', relationship: 'works_best' },
  ],
  'hr-copilot': [
    { slug: 'task-force', outcome: 'HR Copilot + Task Force → assegnazione automatica dei task in base alle competenze', relationship: 'works_best' },
  ],
  'task-force': [
    { slug: 'hr-copilot', outcome: 'Task Force + HR Copilot → visibilità sulla disponibilità e carico di lavoro del team', relationship: 'works_best' },
  ],
};

// Structured impact items — estimatedGain is null until real data is available
interface ImpactItem { label: string; estimatedGain: string | null; }
const AGENT_IMPACTS: Record<string, ImpactItem[]> = {
  'sales-insight': [
    { label: 'Dashboard vendite con KPI aggiornati quotidianamente', estimatedGain: null },
    { label: 'Forecasting ricavi con modello predittivo AI', estimatedGain: null },
    { label: 'Report lead-to-close per ogni commerciale', estimatedGain: null },
  ],
  'warehouse-intelligence': [
    { label: 'Monitoraggio stock in tempo reale con soglie di riordino', estimatedGain: null },
    { label: 'Alerting automatico su prodotti sotto scorta minima', estimatedGain: null },
    { label: 'Suggerimenti di ottimizzazione picking e layout magazzino', estimatedGain: null },
  ],
  'logistics-hub': [
    { label: 'Cruscotto ordini con stato spedizione live', estimatedGain: null },
    { label: 'Notifiche automatiche su ritardi o anomalie', estimatedGain: null },
    { label: 'Storico consegne e analisi performance vettori', estimatedGain: null },
  ],
  'crm': [
    { label: 'Anagrafica clienti unificata con storico interazioni', estimatedGain: null },
    { label: 'Segmentazione automatica del portfolio clienti', estimatedGain: null },
    { label: 'Campagne email e follow-up suggeriti dall\'AI', estimatedGain: null },
  ],
  'competitor-radar': [
    { label: 'Monitoraggio prezzi e offerte dei competitor in tempo reale', estimatedGain: null },
    { label: 'Battle card automatiche generate dall\'AI per ogni competitor', estimatedGain: null },
    { label: 'Alert su nuovi movimenti di mercato rilevanti', estimatedGain: null },
  ],
  'hr-copilot': [
    { label: 'Screening CV automatizzato con ranking candidati', estimatedGain: null },
    { label: 'Dashboard performance dipendenti con obiettivi e KPI', estimatedGain: null },
    { label: 'Chatbot policy aziendale sempre disponibile al team', estimatedGain: null },
  ],
  'task-force': [
    { label: 'Gestione task critici con priorità e scadenze AI-assistite', estimatedGain: null },
    { label: 'Aggiornamenti di progetto generati e inviati per email', estimatedGain: null },
    { label: 'Visibilità sullo stato di ogni task in un\'unica vista', estimatedGain: null },
  ],
};

// Context-aware recommendation reasons based on company profile
const buildRecommendationReason = (
  slug: string,
  company: CompanyDetail
): string[] => {
  const industry = (company.industry ?? '').toLowerCase();
  const needs = (company.needs ?? []).map(n => n.toLowerCase());
  const channels = (company.channels ?? []).map(c => c.toLowerCase());
  const size = (company.company_size ?? '').toLowerCase();
  const reasons: string[] = [];

  if (slug === 'warehouse-intelligence') {
    if (industry.includes('retail') || industry.includes('distribu'))
      reasons.push(`Settore ${company.industry} richiede controllo continuo dello stock`);
    if (channels.some(c => c.includes('e-commerce') || c.includes('ecommerce')))
      reasons.push('Canale e-commerce attivo: lo stock deve restare sincronizzato in tempo reale');
    if (needs.some(n => n.includes('inventor') || n.includes('stock') || n.includes('warehouse')))
      reasons.push('Gestione magazzino identificata tra i bisogni operativi');
  }

  if (slug === 'sales-insight') {
    if (needs.some(n => n.includes('forecast') || n.includes('revenue') || n.includes('sales')))
      reasons.push('Forecasting vendite è tra le priorità dichiarate');
    if (industry.includes('retail') || industry.includes('commerce') || industry.includes('b2b'))
      reasons.push(`Azienda ${company.industry}: reportistica commerciale avanzata è critica`);
    if (size.includes('medium') || size.includes('large') || size.includes('enterprise'))
      reasons.push('Dimensione aziendale elevata — KPI aggregati per ogni area commerciale');
  }

  if (slug === 'crm') {
    if (needs.some(n => n.includes('customer') || n.includes('client') || n.includes('crm')))
      reasons.push('Gestione attiva del portfolio clienti tra i bisogni dichiarati');
    if (channels.some(c => c.includes('direct') || c.includes('retail') || c.includes('client')))
      reasons.push('Vendita diretta rilevata: anagrafica unificata evita duplicati e dispersione dati');
  }

  if (slug === 'hr-copilot') {
    if (size.includes('medium') || size.includes('large') || size.includes('enterprise'))
      reasons.push('Con un team strutturato, lo screening manuale dei CV è un collo di bottiglia');
    if (needs.some(n => n.includes('hr') || n.includes('talent') || n.includes('hiring')))
      reasons.push('Recruiting e gestione performance dichiarati come priorità HR');
  }

  if (slug === 'logistics-hub') {
    if (channels.some(c => c.includes('e-commerce') || c.includes('ecommerce')))
      reasons.push('E-commerce attivo: tracciamento ordini e spedizioni è fondamentale');
    if (needs.some(n => n.includes('logistic') || n.includes('shipping') || n.includes('delivery')))
      reasons.push('Logistica identificata come area operativa primaria');
    if (industry.includes('distribu') || industry.includes('wholesale'))
      reasons.push(`Distribuzione ${company.industry}: hub logistico riduce errori di evasione ordini`);
  }

  if (slug === 'competitor-radar') {
    if (needs.some(n => n.includes('market') || n.includes('competitor') || n.includes('pricing')))
      reasons.push('Analisi di mercato e pricing tra le priorità strategiche dichiarate');
    if (industry.includes('retail') || industry.includes('ecommerce') || industry.includes('saas'))
      reasons.push(`Mercato ${company.industry} ad alta competitività — monitoraggio concorrenza riduce il rischio di perdita quota`);
  }

  if (slug === 'task-force') {
    if (needs.some(n => n.includes('project') || n.includes('task') || n.includes('deadline')))
      reasons.push('Gestione progetti critici identificata tra i bisogni operativi');
    if (size.includes('medium') || size.includes('large') || size.includes('enterprise'))
      reasons.push('Team distribuito: visibilità centralizzata sui task riduce il rischio di blocchi');
  }

  return reasons;
};

// Agent priority based on company profile
type Priority = 'high' | 'medium' | 'optional';


const buildPriority = (slug: string, company: CompanyDetail): Priority => {
  const industry = (company.industry ?? '').toLowerCase();
  const needs = (company.needs ?? []).map(n => n.toLowerCase());
  const channels = (company.channels ?? []).map(c => c.toLowerCase());
  const size = (company.company_size ?? '').toLowerCase();
  const hasEcomm = channels.some(c => c.includes('e-commerce') || c.includes('ecommerce'));
  const isRetail = industry.includes('retail') || industry.includes('distribu') || industry.includes('commerce');
  const isLarge = size.includes('medium') || size.includes('large') || size.includes('enterprise');

  if (slug === 'sales-insight') {
    if (isRetail || needs.some(n => n.includes('sales') || n.includes('forecast') || n.includes('revenue'))) return 'high';
    return 'medium';
  }
  if (slug === 'crm') {
    if (isRetail || needs.some(n => n.includes('customer') || n.includes('crm'))) return 'high';
    return 'medium';
  }
  if (slug === 'warehouse-intelligence') {
    if (isRetail || hasEcomm || needs.some(n => n.includes('stock') || n.includes('inventor'))) return 'high';
    return 'optional';
  }
  if (slug === 'logistics-hub') {
    if (hasEcomm || needs.some(n => n.includes('logistic') || n.includes('shipping'))) return 'high';
    if (isRetail) return 'medium';
    return 'optional';
  }
  if (slug === 'competitor-radar') {
    if (needs.some(n => n.includes('market') || n.includes('competitor') || n.includes('pric'))) return 'medium';
    return 'optional';
  }
  if (slug === 'hr-copilot') {
    if (isLarge || needs.some(n => n.includes('hr') || n.includes('talent'))) return 'medium';
    return 'optional';
  }
  if (slug === 'task-force') {
    if (needs.some(n => n.includes('project') || n.includes('task'))) return 'medium';
    return 'optional';
  }
  return 'optional';
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  high:     { label: 'Alta priorità',   color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)' },
  medium:   { label: 'Media priorità',  color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.25)' },
  optional: { label: 'Opzionale',       color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
};


const ICON_MAP: Record<string, React.ElementType> = {
  'sales-insight': Activity,
  'hr-copilot': Users,
  'competitor-radar': Target,
  'task-force': Shield,
  'warehouse-intelligence': Package,
  'logistics-hub': Truck,
  'crm': Users,
};

// ── Toast System ──────────────────────────────────────────────────────────────

const ToastContainer = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) => (
  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-80">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: 60, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 60, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-sm font-medium ${
            t.type === 'success'
              ? 'bg-green-950/90 border-green-500/40 text-green-200'
              : 'bg-red-950/90 border-red-500/40 text-red-200'
          }`}
        >
          {t.type === 'success'
            ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
            : <XCircle size={16} className="text-red-400 flex-shrink-0" />}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-white/30 hover:text-white/70">✕</button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ── Toggle Switch ─────────────────────────────────────────────────────────────

const ToggleSwitch = ({
  checked, loading, locked, accent, onChange,
}: {
  checked: boolean; loading: boolean; locked: boolean; accent: string; onChange: () => void;
}) => (
  <button
    onClick={(e) => { e.stopPropagation(); if (!locked) onChange(); }}
    disabled={loading || locked}
    title={locked ? 'Agente essenziale — non può essere disattivato' : undefined}
    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-300 focus:outline-none ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
    style={{
      background: checked ? accent : 'rgba(255,255,255,0.08)',
      boxShadow: checked && !locked ? `0 0 12px ${accent}55` : 'none',
    }}
  >
    {loading ? (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 size={12} className="animate-spin text-white/60" />
      </div>
    ) : (
      <div
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300"
        style={{ left: checked ? 'calc(100% - 20px)' : '4px' }}
      />
    )}
  </button>
);

// ── Main Component ────────────────────────────────────────────────────────────

const CompanyConfigPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const headers = { Authorization: `Bearer ${token}` };

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setPageLoading(true);
    setPageError(null);
    try {
      const [companyRes, activeRes] = await Promise.all([
        axios.get(`/api/admin/companies/${id}`, { headers }),
        axios.get(`/api/admin/companies/${id}/active-agents`, { headers }),
      ]);

      const companyData: CompanyDetail = companyRes.data;
      setCompany(companyData);

      type ActiveRow = { agent_slug: string; activation_reason: string | null; activated_at: string | null };
      const activeMap = new Map<string, ActiveRow>();
      (activeRes.data as ActiveRow[]).forEach(a => activeMap.set(a.agent_slug, a));

      const suggestedSet = new Set<string>(Array.isArray(companyData.suggested_agents) ? companyData.suggested_agents : []);
      console.log('[CompanyConfig] Active:', [...activeMap.keys()]);
      console.log('[CompanyConfig] Suggested:', [...suggestedSet]);

      const merged: AgentEntry[] = NEXUS_AGENTS.filter(a => a.slug).map(a => {
        const row = activeMap.get(a.slug!);
        const isAI = row?.activation_reason?.includes('Nexus AI') ?? false;
        return {
          slug: a.slug!,
          label: a.label,
          desc: a.desc,
          accent: a.accent,
          glow: a.glow,
          icon: ICON_MAP[a.slug!] ?? Activity,
          isActive: !!row,
          isRecommended: suggestedSet.has(a.slug!),
          isLocked: LOCKED_SLUGS.has(a.slug!),
          activationSource: row ? (isAI ? 'ai_suggested' : 'manual') : null,
          activatedAt: row?.activated_at ?? null,
          toggling: false,
          recentlyActivated: false,
        };
      });

      setAgents(merged);
    } catch (err: any) {
      setPageError(err.response?.data?.detail ?? 'Errore nel caricamento dei dati.');
    } finally {
      setPageLoading(false);
    }
  }, [id, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Sorted list: active first → recommended → inactive ──────────────────────

  const sortedAgents = [...agents].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  // ── Toggle ──────────────────────────────────────────────────────────────────

  const handleToggle = async (slug: string) => {
    const agent = agents.find(a => a.slug === slug);
    if (!agent || agent.toggling || agent.isLocked) return;

    const willActivate = !agent.isActive;
    const isRecommended = agent.isRecommended;
    console.log(`[CompanyConfig] Toggle ${slug}: ${agent.isActive ? 'ON→OFF' : 'OFF→ON'}`);

    setAgents(prev => prev.map(a => a.slug === slug ? { ...a, toggling: true } : a));

    try {
      if (willActivate) {
        await axios.post(
          `/api/admin/companies/${id}/active-agents`,
          {
            agent_slug: slug,
            activation_source: isRecommended ? 'ai_suggested' : 'manual',
          },
          { headers }
        );
      } else {
        await axios.delete(`/api/admin/companies/${id}/active-agents/${slug}`, { headers });
      }

      console.log(`[CompanyConfig] ${slug} → ${willActivate ? 'ACTIVE' : 'INACTIVE'} ✓`);

      setAgents(prev => prev.map(a =>
        a.slug === slug ? {
          ...a,
          isActive: willActivate,
          toggling: false,
          recentlyActivated: willActivate,
          activationSource: willActivate
            ? (isRecommended ? 'ai_suggested' : 'manual')
            : null,
          activatedAt: willActivate ? new Date().toISOString() : null,
        } : a
      ));

      addToast(
        'success',
        willActivate
          ? `✓ ${agent.label} attivato${isRecommended ? ' (consigliato da Nexus AI)' : ''}`
          : `${agent.label} disattivato`
      );

      // Clear highlight after 5s
      if (willActivate) {
        setTimeout(() => {
          setAgents(prev => prev.map(a => a.slug === slug ? { ...a, recentlyActivated: false } : a));
        }, 5000);
      }
    } catch (err: any) {
      console.error(`[CompanyConfig] Toggle failed for ${slug}:`, err);
      setAgents(prev => prev.map(a => a.slug === slug ? { ...a, toggling: false } : a));
      addToast('error', err.response?.data?.detail ?? `Errore nel toggle di ${agent.label}`);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedAgent = agents.find(a => a.slug === selectedSlug) ?? null;
  const activeCount = agents.filter(a => a.isActive).length;

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (!user || user.is_admin !== 1) {
    return (
      <div className="pt-24 pb-12 w-full flex items-center justify-center min-h-screen">
        <div className="glass-panel p-8 rounded-xl text-center max-w-sm">
          <Shield size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Accesso Negato</h2>
          <p className="text-slate-400 mt-2 text-sm">Solo gli amministratori possono accedere.</p>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="pt-24 pb-12 w-full flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="text-neon-blue animate-spin" />
          <p className="text-slate-400 text-sm uppercase tracking-widest">Caricamento configurazione...</p>
        </div>
      </div>
    );
  }

  if (pageError && !company) {
    return (
      <div className="pt-24 pb-12 w-full flex items-center justify-center min-h-screen">
        <div className="glass-panel p-8 rounded-xl text-center max-w-sm">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Errore</h2>
          <p className="text-slate-400 text-sm">{pageError}</p>
          <Link to="/admin" className="mt-6 inline-block text-neon-blue hover:underline text-xs">← Torna al pannello admin</Link>
        </div>
      </div>
    );
  }

  if (!company) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="pt-24 pb-16 w-full min-h-screen px-4 max-w-7xl mx-auto animate-in fade-in duration-500">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 uppercase tracking-widest">
            <Link to="/admin" className="hover:text-neon-blue transition-colors flex items-center gap-1">
              <ChevronLeft size={14} /> Admin Panel
            </Link>
            <span>/</span>
            <span className="text-slate-300">{company.name}</span>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black bg-gradient-to-r from-neon-blue to-neon-pink text-transparent bg-clip-text tracking-tighter uppercase">
                <SlidersHorizontal size={28} className="text-neon-blue flex-shrink-0" />
                Configurazione Agenti
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Attiva e gestisci ogni agente per <span className="text-white font-medium">{company.name}</span>
              </p>
            </div>
            <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-2 text-xs">
              <Layers size={14} className="text-neon-blue" />
              <span className="text-slate-400">{activeCount} / {agents.length} attivi</span>
            </div>
          </div>
        </motion.div>

        {/* ── Company Info Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-panel rounded-2xl p-5 mb-6 border border-white/5"
        >
          <div className="flex items-start gap-5 flex-wrap">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10"
              style={{ background: 'linear-gradient(135deg, rgba(0,210,255,0.15), rgba(168,85,247,0.15))' }}
            >
              <Building2 size={26} className="text-neon-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">{company.name}</h2>
                {company.company_size && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-blue/10 border border-neon-blue/30 text-neon-blue uppercase font-bold tracking-widest">
                    {company.company_size}
                  </span>
                )}
              </div>
              {company.description && <p className="text-slate-400 text-sm mt-1">{company.description}</p>}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {company.industry && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-amber" />{company.industry}
                  </div>
                )}
                {company.complexity_level && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-pink" />Complessità: {company.complexity_level}
                  </div>
                )}
                {company.channels?.map(ch => (
                  <div key={ch} className="text-xs text-slate-500 bg-white/5 border border-white/5 px-3 py-1 rounded-full">{ch}</div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── System Overview Panel ── */}
        {(() => {
          const count = activeCount;
          const level = count <= 2 ? 'basic' : count <= 5 ? 'intermediate' : 'advanced';
          const LEVELS = [
            { key: 'basic',        label: 'Base',          desc: '1–2 agenti attivi',  color: '#64748b', pct: 33  },
            { key: 'intermediate', label: 'Intermedio',    desc: '3–5 agenti attivi',  color: '#fb923c', pct: 66  },
            { key: 'advanced',     label: 'Avanzato',      desc: '6+ agenti attivi',   color: '#10b981', pct: 100 },
          ] as const;
          const current = LEVELS.find(l => l.key === level)!;
          return (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="glass-panel rounded-xl px-5 py-3 mb-4 border border-white/5 flex items-center gap-5 flex-wrap"
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-2 h-2 rounded-full" style={{ background: current.color }} />
                <span className="text-xs font-bold text-white">Sistema {current.label}</span>
                <span className="text-xs text-slate-500">— {current.desc}</span>
              </div>
              {/* Progress bar across levels */}
              <div className="flex-1 min-w-36 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${current.pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, #00d2ff, ${current.color})` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{count}/{agents.length}</span>
              </div>
              {/* Level chips */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {LEVELS.map(l => (
                  <span
                    key={l.key}
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                    style={{
                      background: l.key === level ? `${l.color}20` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${l.key === level ? l.color + '50' : 'rgba(255,255,255,0.06)'}`,
                      color: l.key === level ? l.color : '#475569',
                    }}
                  >
                    {l.label}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })()}

        {/* ── Two-column layout ── */}
        <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">

          {/* ── LEFT: Agent List ── */}
          <motion.div
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            {sortedAgents.some(a => a.isActive) && (
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 pt-1">Attivi</div>
            )}

            {sortedAgents.map((agent, idx) => {
              const Icon = agent.icon;
              const isSelected = selectedSlug === agent.slug;
              const showInactiveLabel = idx > 0 && !agent.isActive && sortedAgents[idx - 1]?.isActive;

              return (
                <div key={agent.slug}>
                  {showInactiveLabel && (
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1 pt-3 pb-1">Non attivi</div>
                  )}

                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + idx * 0.03, layout: { duration: 0.25 } }}
                    onClick={() => setSelectedSlug(isSelected ? null : agent.slug)}
                    className={`relative w-full text-left p-4 rounded-xl border transition-all duration-300 flex items-center gap-3 overflow-hidden cursor-pointer ${
                      isSelected ? 'bg-black/40' : agent.isActive ? 'border-white/8 bg-white/[0.03] hover:bg-white/5' : 'border-white/5 bg-white/[0.015] hover:bg-white/3 opacity-70 hover:opacity-90'
                    }`}
                    style={isSelected ? { borderColor: agent.accent + '55', boxShadow: `0 0 22px ${agent.accent}12` } : {}}
                  >
                    {/* Recently activated: subtle left border highlight only */}
                    {agent.recentlyActivated && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                        style={{ background: `linear-gradient(to bottom, ${agent.accent}, ${agent.accent}44)` }}
                      />
                    )}

                    {/* Accent strip */}
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: agent.accent }} />}

                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!agent.isActive ? 'grayscale-[60%]' : ''}`}
                      style={{ background: `${agent.accent}18`, border: `1px solid ${agent.accent}35` }}
                    >
                      <Icon size={16} style={{ color: agent.accent }} />
                    </div>

                    {/* Label + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-white leading-tight">{agent.label}</span>
                        {agent.isRecommended && (
                          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-neon-amber/15 border border-neon-amber/35 text-neon-amber font-bold">
                            <Star size={8} className="fill-neon-amber" /> Consigliato
                          </span>
                        )}
                        {agent.isLocked && (
                          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/50 text-slate-400 font-bold">
                            <Lock size={8} /> Core
                          </span>
                        )}
                        {agent.recentlyActivated && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-bold"
                          >
                            <Clock size={8} /> Recente
                          </motion.span>
                        )}
                      </div>
                      {/* Priority + desc row */}
                      {(() => {
                        const p = company ? buildPriority(agent.slug, company) : 'optional';
                        const pc = PRIORITY_CONFIG[p];
                        return (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ color: pc.color, background: pc.bg, border: `1px solid ${pc.border}` }}
                            >
                              {pc.label}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate leading-tight">{agent.desc}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Inline flash */}
                    <AnimatePresence>
                      {agent.recentlyActivated && !agent.toggling && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute right-16 flex items-center gap-1 text-[10px] font-bold text-green-400"
                        >
                          <CheckCircle2 size={11} /> Attivato
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ToggleSwitch
                        checked={agent.isActive}
                        loading={agent.toggling}
                        locked={agent.isLocked}
                        accent={agent.accent}
                        onChange={() => handleToggle(agent.slug)}
                      />
                      <ChevronRight size={14} className={`transition-transform duration-200 ${isSelected ? 'rotate-90 text-slate-300' : 'text-slate-600'}`} />
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </motion.div>

          {/* ── RIGHT: Detail Panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="sticky top-28 space-y-3"
          >
            <AnimatePresence mode="wait">
              {selectedAgent ? (() => {
                const live = agents.find(a => a.slug === selectedAgent.slug)!;
                const synergies = AGENT_SYNERGIES[selectedAgent.slug] ?? [];
                const recReasons = company ? buildRecommendationReason(selectedAgent.slug, company) : [];

                return (
                  <motion.div
                    key={selectedAgent.slug}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="glass-panel rounded-2xl overflow-hidden border"
                    style={{ borderColor: selectedAgent.accent + '30' }}
                  >
                    {/* Header */}
                    <div
                      className="px-6 py-5 border-b border-white/5 flex items-center gap-4"
                      style={{ background: `linear-gradient(135deg, ${selectedAgent.accent}12, transparent)` }}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${!live?.isActive ? 'grayscale-[40%]' : ''}`}
                        style={{ background: `${selectedAgent.accent}20`, border: `1px solid ${selectedAgent.accent}40` }}
                      >
                        <selectedAgent.icon size={22} style={{ color: selectedAgent.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-white text-lg leading-tight">{selectedAgent.label}</h3>
                          {selectedAgent.isRecommended && (
                            <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-neon-amber/15 border border-neon-amber/35 text-neon-amber font-bold uppercase">
                              <Star size={8} className="fill-neon-amber" /> Nexus AI
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">{selectedAgent.desc}</p>
                      </div>
                      {/* Live status */}
                      {live?.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Attivo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 font-bold flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Inattivo
                        </span>
                      )}
                    </div>

                    {/* ── Toggle + Activation source row ── */}
                    <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-white">Stato Attivazione</p>
                        {live?.isActive ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {live.activationSource === 'ai_suggested' ? (
                              <><Sparkles size={11} className="text-neon-amber" />
                              <span className="text-xs text-neon-amber/80">Attivato su suggerimento Nexus AI</span></>
                            ) : (
                              <><UserCheck size={11} className="text-slate-400" />
                              <span className="text-xs text-slate-400">Attivato manualmente dall'amministratore</span></>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-0.5">Non attivo — utilizza il toggle per abilitarlo</p>
                        )}
                      </div>
                      {live && (
                        <ToggleSwitch
                          checked={live.isActive}
                          loading={live.toggling}
                          locked={live.isLocked}
                          accent={selectedAgent.accent}
                          onChange={() => handleToggle(selectedAgent.slug)}
                        />
                      )}
                    </div>

                    {/* ── Recommendation explanation ── */}
                    {selectedAgent.isRecommended && recReasons.length > 0 && (
                      <div className="px-6 py-4 border-b border-white/5 bg-neon-amber/[0.04]">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Sparkles size={12} className="text-neon-amber" />
                          <span className="text-[10px] font-bold text-neon-amber uppercase tracking-wider">Perché è consigliato per {company.name}</span>
                        </div>
                        <ul className="space-y-1.5">
                          {recReasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                              <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0 bg-neon-amber/70" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* ── Impact preview ── */}
                    {(() => {
                      const impacts = AGENT_IMPACTS[selectedAgent.slug] ?? [];
                      if (impacts.length === 0) return null;
                      return (
                        <div className="px-6 py-4 border-b border-white/5">
                          <div className="flex items-center gap-2 mb-2.5">
                            <CheckCircle2 size={12} className="text-neon-blue" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {live?.isActive ? 'Funzionalità abilitate' : 'Si abilita se attivato'}
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {impacts.map((item, i) => (
                              <li key={i} className={`flex items-start gap-2 text-xs leading-snug transition-colors ${
                                live?.isActive ? 'text-slate-300' : 'text-slate-500'
                              }`}>
                                <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${
                                  live?.isActive ? 'bg-neon-blue/70' : 'bg-slate-600'
                                }`} />
                                <span className="flex-1">{item.label}</span>
                                {item.estimatedGain && (
                                  <span className="text-[10px] font-bold text-neon-blue/70 flex-shrink-0">{item.estimatedGain}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* ── Synergy panel ── */}
                    {synergies.length > 0 && (
                      <div className="px-6 py-4 border-b border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                          <Link2 size={12} className="text-neon-blue" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Combinazioni efficaci</span>
                        </div>
                        <div className="space-y-2">
                          {synergies.map(syn => {
                            const synAgent = agents.find(a => a.slug === syn.slug);
                            const SynIcon = ICON_MAP[syn.slug] ?? Activity;
                            return (
                              <div
                                key={syn.slug}
                                className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.025] border border-white/[0.06] cursor-pointer hover:bg-white/[0.05] transition-colors group"
                                onClick={(e) => { e.stopPropagation(); setSelectedSlug(syn.slug); }}
                              >
                                <div
                                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{
                                    background: synAgent ? `${synAgent.accent}18` : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${synAgent ? synAgent.accent + '35' : 'rgba(255,255,255,0.08)'}`,
                                  }}
                                >
                                  <SynIcon size={13} style={{ color: synAgent?.accent ?? '#64748b' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-300 leading-snug group-hover:text-white transition-colors">{syn.outcome}</p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                      style={{
                                        color: syn.relationship === 'requires' ? '#fb923c' : '#60a5fa',
                                        background: syn.relationship === 'requires' ? 'rgba(251,146,60,0.1)' : 'rgba(96,165,250,0.1)',
                                        border: `1px solid ${syn.relationship === 'requires' ? 'rgba(251,146,60,0.25)' : 'rgba(96,165,250,0.2)'}`,
                                      }}
                                    >
                                      {syn.relationship === 'requires' ? 'Richiede' : 'Funziona meglio con'}
                                    </span>
                                    {synAgent?.isActive ? (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-bold">Attivo</span>
                                    ) : (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/8 text-slate-500 font-bold">Non attivo</span>
                                    )}
                                    <span className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors">→ vedi agente</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Live Configuration Form ── */}
                    <div className="border-t border-white/5">
                      <div className="px-6 pt-4 pb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings size={13} style={{ color: selectedAgent.accent }} />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parametri di configurazione</span>
                        </div>
                      </div>
                      <AgentConfigPanel
                        companyId={id!}
                        agentSlug={selectedAgent.slug}
                        agentLabel={selectedAgent.label}
                        agentAccent={selectedAgent.accent}
                        token={token ?? ''}
                        onSaveSuccess={() => addToast('success', `Configurazione di ${selectedAgent.label} salvata`)}
                      />
                    </div>
                  </motion.div>
                );
              })() : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="glass-panel rounded-2xl p-16 flex flex-col items-center justify-center text-center border border-white/5 border-dashed"
                >
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 mb-5">
                    <SlidersHorizontal size={26} className="text-slate-600" />
                  </div>
                  <p className="text-slate-400 font-medium">Seleziona un agente</p>
                  <p className="text-slate-600 text-sm mt-2 max-w-xs">
                    Clicca su un agente per vedere dettagli, perché è consigliato e con quali agenti collabora.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </>
  );
};

export default CompanyConfigPage;
