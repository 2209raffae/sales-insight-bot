/**
 * AgentConfigPanel
 * Renders a full dynamic configuration form for a single agent,
 * driven by the schema returned from GET /api/admin/companies/:id/config/:slug.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, RotateCcw, Loader2, CheckCircle2, AlertCircle,
  ChevronDown, Code, EyeOff, Info, Zap, User, Calendar,
} from 'lucide-react';
import axios from 'axios';

// ── Types ──────────────────────────────────────────────────────────────────────

type FieldType = 'slider' | 'toggle' | 'select' | 'text';

interface SelectOption { value: string; label: string }

interface SchemaField {
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  impact_hint?: string;    // what changes when you modify this value
  placeholder?: string;
  // slider
  min?: number;
  max?: number;
  step?: number;
  // select
  options?: SelectOption[];
}

interface ConfigSchema { fields: SchemaField[] }

interface AuditMeta {
  updated_at: string | null;
  updated_by: string | null;
}

interface ConfigResponse {
  agent_slug: string;
  config: Record<string, unknown>;
  defaults: Record<string, unknown>;
  schema: ConfigSchema;
  has_overrides: boolean;
  audit: AuditMeta;
}

interface Props {
  companyId: string | number;
  agentSlug: string;
  agentLabel: string;
  agentAccent: string;
  token: string;
  onSaveSuccess?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const formatValue = (value: unknown, field: SchemaField): string => {
  if (field.type === 'slider' && field.step && field.step < 1) {
    return Number(value).toFixed(2);
  }
  return String(value);
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── Shared sub-components ─────────────────────────────────────────────────────

/** "Default" / "Personalizzato" status chip */
const StatusPill = ({ isDefault }: { isDefault: boolean }) => (
  <span
    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
    style={isDefault
      ? { color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)' }
      : { color: '#00d2ff', background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.25)' }
    }
  >
    {isDefault ? 'Default' : 'Personalizzato'}
  </span>
);

/** Impact hint — shown below description when field has impact_hint */
const ImpactHint = ({ text }: { text: string }) => (
  <div className="flex items-start gap-1.5 mt-1.5">
    <Zap size={9} className="text-neon-amber/60 flex-shrink-0 mt-0.5" />
    <p className="text-[10px] text-neon-amber/60 leading-snug italic">{text}</p>
  </div>
);

// ── Field renderers ───────────────────────────────────────────────────────────

const SliderField = ({
  field, value, defaultValue, onChange, error,
}: {
  field: SchemaField;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
  error?: string;
}) => {
  const pct = field.min !== undefined && field.max !== undefined
    ? ((value - field.min) / (field.max - field.min)) * 100
    : 0;
  const isDefault = value === defaultValue;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{field.label}</span>
          <StatusPill isDefault={isDefault} />
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <span className="text-[10px] text-slate-500 line-through">{formatValue(defaultValue, field)}</span>
          )}
          <span
            className="text-sm font-bold tabular-nums px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}
          >
            {formatValue(value, field)}
          </span>
        </div>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/8" />
        <div
          className="absolute left-0 h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00d2ff 0%, #a855f7 100%)' }}
        />
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={value}
          onChange={e => onChange(field.step && field.step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
          className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
        />
        {/* Thumb */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none transition-all"
          style={{ left: `calc(${pct}% - 8px)`, background: '#00d2ff', boxShadow: '0 0 8px rgba(0,210,255,0.6)' }}
        />
      </div>
      {field.description && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{field.description}</p>}
      {field.impact_hint && <ImpactHint text={field.impact_hint} />}
      {error && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={10} />{error}</p>}
    </div>
  );
};

const ToggleField = ({
  field, value, defaultValue, onChange,
}: {
  field: SchemaField;
  value: boolean;
  defaultValue: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4 py-0.5">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-white">{field.label}</span>
        <StatusPill isDefault={value === defaultValue} />
      </div>
      {field.description && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{field.description}</p>}
      {field.impact_hint && <ImpactHint text={field.impact_hint} />}
    </div>
    <button
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all duration-200 focus:outline-none mt-0.5"
      style={{
        background: value ? '#00d2ff' : 'rgba(255,255,255,0.1)',
        boxShadow: value ? '0 0 10px rgba(0,210,255,0.4)' : 'none',
      }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
        style={{ left: value ? 'calc(100% - 18px)' : '2px' }}
      />
    </button>
  </div>
);

const SelectField = ({
  field, value, defaultValue, onChange, error,
}: {
  field: SchemaField;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
  error?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = field.options?.find(o => o.value === value);
  const isDefault = value === defaultValue;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{field.label}</span>
          <StatusPill isDefault={isDefault} />
        </div>
        {!isDefault && (
          <span className="text-[10px] text-slate-500">
            default: {field.options?.find(o => o.value === defaultValue)?.label ?? defaultValue}
          </span>
        )}
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/15 transition-colors text-sm text-white"
        >
          <span>{selected?.label ?? value}</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-[#0f1117] shadow-xl overflow-hidden"
            >
              {field.options?.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/6 ${
                    opt.value === value ? 'text-[#00d2ff] bg-white/4' : 'text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {field.description && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{field.description}</p>}
      {field.impact_hint && <ImpactHint text={field.impact_hint} />}
      {error && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={10} />{error}</p>}
    </div>
  );
};

const TextField = ({
  field, value, defaultValue, onChange, error,
}: {
  field: SchemaField;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
  error?: string;
}) => (
  <div>
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-sm font-medium text-white">{field.label}</span>
      <StatusPill isDefault={value === defaultValue} />
    </div>
    <input
      type="text"
      value={value}
      placeholder={field.placeholder ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/15 focus:border-[#00d2ff]/50 focus:outline-none text-sm text-white placeholder:text-slate-600 transition-colors"
    />
    {field.description && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{field.description}</p>}
    {field.impact_hint && <ImpactHint text={field.impact_hint} />}
    {error && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={10} />{error}</p>}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

export const AgentConfigPanel = ({
  companyId, agentSlug, agentLabel, agentAccent, token, onSaveSuccess,
}: Props) => {
  const [response, setResponse] = useState<ConfigResponse | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDebug, setShowDebug] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin/companies/${companyId}/config/${agentSlug}`, { headers });
      setResponse(res.data);
      setValues(res.data.config);
    } catch (err) {
      console.error('[AgentConfigPanel] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, agentSlug, token]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const isDirty = response ? !deepEqual(values, response.config) : false;

  const validate = (): boolean => {
    if (!response) return false;
    const errs: Record<string, string> = {};
    for (const field of response.schema.fields) {
      const v = values[field.key];
      if (field.type === 'slider') {
        const n = Number(v);
        if (field.min !== undefined && n < field.min) errs[field.key] = `Minimo: ${field.min}`;
        if (field.max !== undefined && n > field.max) errs[field.key] = `Massimo: ${field.max}`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !isDirty) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      await axios.post(`/api/admin/companies/${companyId}/config/${agentSlug}`, { config: values }, { headers });
      await fetchConfig();
      setSaveStatus('success');
      onSaveSuccess?.();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (response) setValues({ ...response.defaults });
  };

  const handleFieldChange = (key: string, value: unknown) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const e = { ...prev }; delete e[key]; return e; });
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-6 py-12 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 size={22} className="animate-spin" />
        <p className="text-xs">Caricamento configurazione...</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="px-6 py-8 text-center text-slate-500 text-sm">
        <AlertCircle size={22} className="mx-auto mb-2 text-red-400" />
        Impossibile caricare la configurazione
      </div>
    );
  }

  const { schema, defaults } = response;
  const audit = response.audit ?? { updated_at: null, updated_by: null };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Dirty banner */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-6 mb-0 mt-3 px-3 py-2 rounded-lg bg-neon-amber/[0.08] border border-neon-amber/25 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-amber animate-pulse flex-shrink-0" />
              <span className="text-[11px] text-neon-amber font-medium">Modifiche non salvate</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fields */}
      <div className="px-6 py-5 space-y-6">
        {schema.fields.map(field => {
          const value = values[field.key];
          const defVal = defaults[field.key];

          if (field.type === 'slider') return (
            <SliderField
              key={field.key}
              field={field}
              value={value as number}
              defaultValue={defVal as number}
              onChange={v => handleFieldChange(field.key, v)}
              error={errors[field.key]}
            />
          );

          if (field.type === 'toggle') return (
            <ToggleField
              key={field.key}
              field={field}
              value={value as boolean}
              defaultValue={defVal as boolean}
              onChange={v => handleFieldChange(field.key, v)}
            />
          );

          if (field.type === 'select') return (
            <SelectField
              key={field.key}
              field={field}
              value={value as string}
              defaultValue={defVal as string}
              onChange={v => handleFieldChange(field.key, v)}
              error={errors[field.key]}
            />
          );

          if (field.type === 'text') return (
            <TextField
              key={field.key}
              field={field}
              value={value as string}
              defaultValue={defVal as string}
              onChange={v => handleFieldChange(field.key, v)}
              error={errors[field.key]}
            />
          );

          return null;
        })}

        {schema.fields.length === 0 && (
          <div className="text-center py-4 text-slate-600 text-sm flex flex-col items-center gap-2">
            <Info size={18} />
            Nessun parametro configurabile disponibile
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-6 pb-4 flex items-center gap-2 flex-wrap border-t border-white/5 pt-4">
        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            isDirty && !saving
              ? 'text-white hover:opacity-90'
              : 'opacity-30 cursor-not-allowed text-slate-400 bg-white/5'
          }`}
          style={isDirty && !saving ? {
            background: `linear-gradient(135deg, ${agentAccent}, ${agentAccent}aa)`,
            boxShadow: `0 0 16px ${agentAccent}40`,
          } : {}}
        >
          {saving
            ? <Loader2 size={14} className="animate-spin" />
            : saveStatus === 'success'
              ? <CheckCircle2 size={14} className="text-green-300" />
              : <Save size={14} />
          }
          {saving ? 'Salvataggio...' : saveStatus === 'success' ? 'Salvato!' : 'Salva configurazione'}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          disabled={deepEqual(values, defaults)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 bg-white/5 border border-white/8 hover:bg-white/8 hover:text-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw size={12} />
          Ripristina default
        </button>

        {/* Error state */}
        <AnimatePresence>
          {saveStatus === 'error' && (
            <motion.span
              initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="text-xs text-red-400 flex items-center gap-1"
            >
              <AlertCircle size={12} /> Errore nel salvataggio
            </motion.span>
          )}
        </AnimatePresence>

        {/* Debug toggle */}
        <button
          onClick={() => setShowDebug(p => !p)}
          className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          <Code size={11} />
          {showDebug ? 'Nascondi JSON' : 'Debug JSON'}
        </button>
      </div>

      {/* Audit metadata footer */}
      {(audit.updated_at || audit.updated_by) && (
        <div className="px-6 pb-4 flex items-center gap-4 flex-wrap border-t border-white/[0.04] pt-2.5">
          {audit.updated_by && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <User size={9} className="text-slate-700" />
              <span>{audit.updated_by}</span>
            </div>
          )}
          {audit.updated_at && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <Calendar size={9} className="text-slate-700" />
              <span>{formatDate(audit.updated_at)}</span>
            </div>
          )}
        </div>
      )}

      {/* Debug panel */}
      <AnimatePresence>
        {showDebug && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-6 mb-5 rounded-lg bg-black/40 border border-white/8 overflow-auto">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">raw config (read-only)</span>
                <EyeOff size={11} className="text-slate-600" />
              </div>
              <pre className="px-4 py-3 text-[11px] text-green-300/80 font-mono overflow-auto max-h-48">
                {JSON.stringify(values, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
