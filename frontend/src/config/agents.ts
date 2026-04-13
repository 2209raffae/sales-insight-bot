import { Activity, Users, Target, Shield, Package, Truck } from 'lucide-react';
import React from 'react';

export interface NavItem {
  icon: React.ElementType;
  label: string;
  desc: string;
  to: string;
  accent: string;
  glow: string;
  slug?: string;
  badge?: string;
  disabled?: boolean;
}

export const NEXUS_AGENTS: NavItem[] = [
  { icon: Activity, label: 'Sales Insight', desc: 'Intelligence commerciale e previsioni vendite', to: '/sales-insight', accent: '#00d2ff', glow: 'rgba(0,210,255,0.35)', badge: 'ACTIVE', slug: 'sales-insight' },
  { icon: Users, label: 'HR & Talent Copilot', desc: 'Performance dipendenti, CV screening, policy bot', to: '/hr-copilot', accent: '#a855f7', glow: 'rgba(168,85,247,0.35)', badge: 'ACTIVE', slug: 'hr-copilot' },
  { icon: Target, label: 'Competitor Radar', desc: 'Analisi concorrenza AI e battle cards strategiche', to: '/competitor-radar', accent: '#f59e0b', glow: 'rgba(245,158,11,0.35)', badge: 'NEW', slug: 'competitor-radar' },
  { icon: Shield, label: 'Task Force Manager', desc: 'Gestione progetti critici e update email AI', to: '/task-force', accent: '#10b981', glow: 'rgba(16,185,129,0.35)', badge: 'NEW', slug: 'task-force' },
  { icon: Package, label: 'Warehouse Intelligence', desc: 'Analisi predittiva stock e sync e-commerce', to: '/warehouse', accent: '#00ffcc', glow: 'rgba(0,255,204,0.35)', badge: 'AI', slug: 'warehouse-intelligence' },
  { icon: Truck, label: 'Logistics & Order Hub', desc: 'Gestione ordini, spedizioni e cruscotto preparazione', to: '/logistics', accent: '#6366f1', glow: 'rgba(99,102,241,0.35)', badge: 'PRO', slug: 'logistics-hub' },
  { icon: Users, label: 'CRM & Clienti', desc: 'Anagrafiche unificate e Marketing AI', to: '/crm', accent: '#f43f5e', glow: 'rgba(244,63,94,0.35)', badge: 'CORE', slug: 'crm' },
];
