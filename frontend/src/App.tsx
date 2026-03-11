import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  Bot, Database, ChevronLeft, Users, DollarSign, Target, FileText,
  ArrowRight, Activity, Zap, Box, Headset, Scale, Megaphone, Briefcase
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

// Pagina Agenti Esistenti
import UploadPage from './pages/UploadPage';
import LeadsPage from './pages/LeadsPage';
import SpendPage from './pages/SpendPage';
import BudgetsPage from './pages/BudgetsPage';
import ReportPage from './pages/ReportPage';
import ChatPage from './pages/ChatPage';

// Pagine Agenti HR
import TalentScreeningPage from './pages/TalentScreeningPage';
import PerformanceRadarPage from './pages/PerformanceRadarPage';
import PolicyBotPage from './pages/PolicyBotPage';

// ─── Particles Canvas ────────────────────────────────────────────────────────
const ParticleCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number };
    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,210,255,${p.alpha})`;
        ctx.fill();
      });
      // lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,210,255,${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />;
};

// ─── Shared UI Components ─────────────────────────────────────────────────────
interface NavItem {
  icon: React.ElementType;
  label: string;
  desc: string;
  to: string;
  accent: string;
  glow: string;
  badge?: string;
  disabled?: boolean;
}

const ModuleCard = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;
  const content = (
    <>
      <div className="card-top-bar" />
      <div className="card-inner">
        <div className="card-icon-wrap">
          <Icon size={22} />
        </div>
        {item.badge && (
          <span className={`card-badge ${item.badge === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/40' : ''}`}>{item.badge}</span>
        )}
        <div className="card-text">
          <h3 className="card-title">{item.label}</h3>
          <p className="card-desc">{item.desc}</p>
        </div>
        {!item.disabled && (
          <div className="card-arrow">
            <ArrowRight size={16} />
          </div>
        )}
      </div>
      <div className="card-glow-overlay" />
    </>
  );

  if (item.disabled) {
    return (
      <div className="module-card group disabled opacity-60 cursor-not-allowed" style={{ '--accent': item.accent, '--glow': item.glow } as React.CSSProperties}>
        {content}
      </div>
    );
  }

  return (
    <Link to={item.to} className="module-card group" style={{ '--accent': item.accent, '--glow': item.glow } as React.CSSProperties}>
      {content}
    </Link>
  );
};

const MenuGrid = ({ title, subtitle, items, tag }: { title: React.ReactNode, subtitle: string, items: NavItem[], tag?: string }) => (
  <div className="home-root">
    <header className="home-header">
      <div className="logo-chip">
        <Zap size={14} />
        <span>NEXUS PLATFORM</span>
      </div>
      <div className="hero-titles">
        <h1 className="hero-h1">{title}</h1>
        <p className="hero-sub">{subtitle}</p>
      </div>
      {tag && (
        <div className="live-chip mt-2">
          <span className="live-dot" />
          <Activity size={12} />
          <span>{tag}</span>
        </div>
      )}
    </header>

    <div className="hero-divider">
      <div className="divider-line" />
      <span className="divider-label">MODULI DISPONIBILI</span>
      <div className="divider-line" />
    </div>

    <div className="modules-grid mx-auto px-4 w-full">
      {items.map(item => <ModuleCard key={item.label} item={item} />)}
    </div>

    <footer className="home-footer text-center pb-8">
      <span>© 2025 Nexus Platform — Enterprise AI Hub</span>
      <span className="footer-sep">|</span>
      <span>v3.0.0</span>
    </footer>
  </div>
);

// ─── Data & Views ─────────────────────────────────────────────────────────────
const NEXUS_AGENTS: NavItem[] = [
  { icon: Activity, label: 'Sales Insight', desc: 'Intelligence commerciale e previsioni vendite', to: '/sales-insight', accent: '#00d2ff', glow: 'rgba(0,210,255,0.35)', badge: 'ACTIVE' },
  { icon: Users, label: 'HR & Talent Copilot', desc: 'Performance dipendenti, CV screening, policy bot', to: '/hr-copilot', accent: '#a855f7', glow: 'rgba(168,85,247,0.35)', badge: 'NEW' },
  { icon: Box, label: 'Supply Chain AI', desc: 'Ottimizzazione magazzino e logistica predittiva', to: '#', disabled: true, accent: '#10b981', glow: 'rgba(16,185,129,0.35)', badge: 'SOON' },
  { icon: Headset, label: 'Customer Sentinel', desc: 'Analisi ticket e assistenza L1 automatizzata', to: '#', disabled: true, accent: '#f59e0b', glow: 'rgba(245,158,11,0.35)', badge: 'SOON' },
  { icon: Scale, label: 'Legal Radar', desc: 'Scansione contratti e compliance normativa', to: '#', disabled: true, accent: '#ef4444', glow: 'rgba(239,68,68,0.35)', badge: 'SOON' },
  { icon: Megaphone, label: 'Marketing Agent', desc: 'Analisi ROI campagne e generazione creativa', to: '#', disabled: true, accent: '#ff007f', glow: 'rgba(255,0,127,0.35)', badge: 'SOON' },
];

const SALES_MODULES: NavItem[] = [
  { icon: Database, label: 'Upload Dati', desc: 'Importa CSV per leads e spese', to: '/sales-insight/upload', accent: '#00d2ff', glow: 'rgba(0,210,255,0.35)' },
  { icon: Users, label: 'KPI Leads', desc: 'Analisi performance commerciale', to: '/sales-insight/leads', accent: '#a855f7', glow: 'rgba(168,85,247,0.35)' },
  { icon: DollarSign, label: 'KPI Spese', desc: 'Monitor budget & investimenti', to: '/sales-insight/spend', accent: '#10b981', glow: 'rgba(16,185,129,0.35)' },
  { icon: Target, label: 'Budget', desc: 'Pianifica obiettivi finanziari', to: '/sales-insight/budgets', accent: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  { icon: FileText, label: 'Report', desc: 'Genera report esecutivi PDF', to: '/sales-insight/report', accent: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
  { icon: Bot, label: 'AI Copilot', desc: 'Assistente GPT-4 sui tuoi dati', to: '/sales-insight/chat', accent: '#ff007f', glow: 'rgba(255,0,127,0.35)', badge: 'AI' },
];

const HR_MODULES: NavItem[] = [
  { icon: Briefcase, label: 'Talent Screening', desc: 'Analisi automatica e classificazione CV', to: '/hr-copilot/screening', accent: '#a855f7', glow: 'rgba(168,85,247,0.35)' },
  { icon: Activity, label: 'Performance Radar', desc: 'KPI dipendenti e mappa del rendimento', to: '/hr-copilot/performance', accent: '#00d2ff', glow: 'rgba(0,210,255,0.35)' },
  { icon: Bot, label: 'Policy & Leave Bot', desc: 'Assistente ferie e policy aziendali', to: '/hr-copilot/chat', accent: '#ff007f', glow: 'rgba(255,0,127,0.35)', badge: 'AI' },
];

// ─── Pages ────────────────────────────────────────────────────────────────────
const NexusHub = () => (
  <MenuGrid
    title={<>Nexus<span className="hero-accent">Hub</span></>}
    subtitle="Ecosistema di intelligenza artificiale aziendale: seleziona il tuo agente."
    items={NEXUS_AGENTS}
  />
);

const SalesInsightHub = () => (
  <MenuGrid
    title={<>Sales<span className="hero-accent">Insight</span></>}
    subtitle="Intelligence commerciale in tempo reale — analizza, prevedi, decidi."
    items={SALES_MODULES}
    tag="Agente Attivo"
  />
);

const HRCopilotHub = () => (
  <MenuGrid
    title={<>HR <span className="hero-accent">Copilot</span></>}
    subtitle="Ottimizzazione delle risorse umane, screening intelligente e gestione talenti."
    items={HR_MODULES}
    tag="Agente Attivo"
  />
);

// Unused placeholders rimossi per non bloccare Typescript


// ─── App Shell ────────────────────────────────────────────────────────────────
const LayoutContent = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const path = location.pathname;

  // Logic to determine where the "Back" button should go, and if it should show
  let backTo = '';
  let backLabel = '';

  if (path.startsWith('/sales-insight/')) {
    backTo = '/sales-insight';
    backLabel = 'Torna all\'Agente';
  } else if (path.startsWith('/hr-copilot/')) {
    backTo = '/hr-copilot';
    backLabel = 'Torna all\'Agente HR';
  } else if (path === '/sales-insight' || path === '/hr-copilot') {
    backTo = '/';
    backLabel = 'Nexus Hub';
  }

  // Se siamo in un "interno" (non su un hub), aggiungiamo padding e sfondo scuro
  const isAgentHub = path === '/' || path === '/sales-insight' || path === '/hr-copilot';

  return (
    <div className="min-h-screen w-full text-white font-sans relative overflow-x-hidden pt-2 pb-16">
      <ParticleCanvas />

      {/* dark grid texture */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, backgroundImage: 'linear-gradient(rgba(0,210,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,210,255,0.03) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

      {backTo && (
        <Link
          to={backTo}
          className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-2 text-[#00d2ff] hover:text-white transition-all bg-black/60 px-4 py-2 rounded-full border border-[#00d2ff]/20 backdrop-blur-md shadow-[0_0_18px_rgba(0,210,255,0.25)] pointer-events-auto"
        >
          <ChevronLeft size={18} />
          <span className="font-bold tracking-widest uppercase text-[10px] sm:text-xs">{backLabel}</span>
        </Link>
      )}

      {/* page content */}
      <div className={`relative z-10 w-full min-h-screen flex flex-col items-center ${!isAgentHub ? 'bg-black/60 backdrop-blur-md pt-20 px-4' : 'pt-10'}`}>
        <div className={`w-full ${isAgentHub ? 'max-w-5xl' : 'max-w-7xl'} mx-auto`}>
          <main className="w-full flex justify-center">{children}</main>
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <LayoutContent>
      <Routes>
        {/* Hub Principale */}
        <Route path="/" element={<NexusHub />} />

        {/* Agente: Sales Insight */}
        <Route path="/sales-insight" element={<SalesInsightHub />} />
        <Route path="/sales-insight/upload" element={<UploadPage />} />
        <Route path="/sales-insight/leads" element={<LeadsPage />} />
        <Route path="/sales-insight/spend" element={<SpendPage />} />
        <Route path="/sales-insight/budgets" element={<BudgetsPage />} />
        <Route path="/sales-insight/report" element={<ReportPage />} />
        <Route path="/sales-insight/chat" element={<ChatPage />} />

        {/* Agente: HR Copilot (Attivo) */}
        <Route path="/hr-copilot" element={<HRCopilotHub />} />
        <Route path="/hr-copilot/screening" element={<TalentScreeningPage />} />
        <Route path="/hr-copilot/performance" element={<PerformanceRadarPage />} />
        <Route path="/hr-copilot/chat" element={<PolicyBotPage />} />

        {/* Fallback origin pointer */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LayoutContent>
  </BrowserRouter>
);

export default App;
