import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Bot, Database, Home, ChevronLeft, Users, DollarSign, Target, FileText } from 'lucide-react';
import React from 'react';
import UploadPage from './pages/UploadPage';
import LeadsPage from './pages/LeadsPage';
import SpendPage from './pages/SpendPage';
import BudgetsPage from './pages/BudgetsPage';
import ReportPage from './pages/ReportPage';
import ChatPage from './pages/ChatPage';

// Componente Planet (Rotante)
const Planet = ({
  icon: Icon,
  label,
  pathNum,
  to
}: {
  icon: React.ElementType,
  label: string,
  pathNum: number,
  to: string
}) => {
  return (
    <div className={`planet-path path-${pathNum}`}>
      <div className="planet-wrapper" style={{ animationDuration: `${20 + (pathNum * 15)}s` }}>
        <Link to={to} className={`planet planet-${pathNum}`} style={{ animationDuration: `${20 + (pathNum * 15)}s` }}>
          <Icon size={24} />
          <span className="planet-label" style={{ color: 'white' }}>{label}</span>
        </Link>
      </div>
    </div>
  );
}

// Menu Sistema Solare
const SolarSystemMenu = () => {
  return (
    <div className="fixed inset-0 z-0 bg-cyber-bg overflow-hidden flex items-center justify-center w-screen h-screen">
      {/* Sfondo spaziale */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at center, #22222a 0%, #050505 100%)' }}></div>

      <div className="orbit-container scale-75 md:scale-90">
        <Link to="/" className="sun-center hover:scale-110 transition-transform cursor-pointer">
          <div className="text-center">
            <span className="block font-black text-xl tracking-widest text-shadow-xl shadow-cyan-500/50">NEXUS</span>
          </div>
        </Link>
        <Planet icon={Home} label="Hub Principale" pathNum={1} to="/" />
        <Planet icon={Database} label="Upload Dati" pathNum={2} to="/upload" />
        <Planet icon={Users} label="KPI Leads" pathNum={3} to="/leads" />
        <Planet icon={DollarSign} label="KPI Spese" pathNum={4} to="/spend" />
        <Planet icon={Target} label="Budget" pathNum={5} to="/budgets" />
        <Planet icon={FileText} label="Report" pathNum={6} to="/report" />
        <Planet icon={Bot} label="AI Copilot" pathNum={7} to="/chat" />
      </div>
    </div>
  );
};

// Layout Principale
const LayoutContent = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen w-full overflow-x-hidden text-white font-sans selection:bg-neon-purple/30 relative">
      <SolarSystemMenu />

      {!isHome && (
        <Link to="/" className="fixed top-6 left-6 z-50 flex items-center gap-2 text-neon-blue hover:text-white transition-colors bg-black/50 px-4 py-2 rounded-full border border-neon-blue/30 backdrop-blur-md cursor-pointer shadow-[0_0_15px_rgba(0,242,254,0.3)] pointer-events-auto">
          <ChevronLeft size={20} />
          <span className="font-bold tracking-widest uppercase text-sm">Torna al Nexus</span>
        </Link>
      )}

      <div className={`absolute inset-0 z-10 flex w-full min-h-screen pointer-events-none ${!isHome ? 'bg-black/70 backdrop-blur-md' : ''}`}>
        <div className="flex-1 transition-all duration-500 ease-in-out w-full max-w-full">
          <main className="w-full h-full pointer-events-none">
            {/* Rendi i link pass-through per il content layer vuoto, ma attivi per le card interne */}
            <div className={`h-full w-full max-w-7xl mx-auto ${isHome ? 'pointer-events-none' : 'pointer-events-auto overflow-y-auto overflow-x-hidden'}`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

// Applicazione React Vite
const App = () => {
  return (
    <BrowserRouter>
      <LayoutContent>
        <Routes>
          <Route path="/" element={<div />} /> {/* La home mostra solo il sistema solare */}
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/spend" element={<SpendPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </LayoutContent>
    </BrowserRouter>
  );
};

export default App;
