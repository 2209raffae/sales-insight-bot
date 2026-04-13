import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Mail, Zap, ChevronRight, CheckCircle2, History, MapPin, Search } from 'lucide-react';
import Editor from 'react-simple-wysiwyg';

interface Customer {
  id: number;
  phone_number: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  address: string | null;
  total_spent: number;
  orders_count: number;
  last_purchase_date: string | null;
  created_at: string;
}

interface Automation {
  id: number;
  campaign_name: string;
  prompt_used: string;
  email_content: string;
  sent_count: number;
  status: string;
  created_at: string;
}

interface EmailRule {
  id: number;
  name: string;
  subject: string;
  trigger_event: string;
  delay_hours: number;
  prompt_template: string;
  resend_template_id: string | null;
  is_active: boolean;
  created_at: string;
}

const CRMPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'marketing'>('customers');
  const [marketingSubTab, setMarketingSubTab] = useState<'broadcast' | 'flows'>('flows');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Broadcast state
  const [marketingPrompt, setMarketingPrompt] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [generating, setGenerating] = useState(false);

  // Flows state
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [newRule, setNewRule] = useState({ 
    name: '', 
    subject: '', 
    trigger_event: 'ORDER_CREATED', 
    delay_hours: 0, 
    prompt_template: '',
    resend_template_id: '' 
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [custRes, autoRes, rulesRes] = await Promise.all([
        axios.get('/api/crm/customers'),
        axios.get('/api/crm/automations'),
        axios.get('/api/crm/rules')
      ]);
      setCustomers(custRes.data);
      setAutomations(autoRes.data);
      setRules(rulesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRule.name || !newRule.subject) return alert('Compila nome e oggetto.');
    if (!newRule.prompt_template && !newRule.resend_template_id) return alert('Inserisci un template o un ID Template Resend.');
    try {
      await axios.post('/api/crm/rules', newRule);
      setFlowModalOpen(false);
      setNewRule({ 
        name: '', 
        subject: '', 
        trigger_event: 'ORDER_CREATED', 
        delay_hours: 0, 
        prompt_template: '',
        resend_template_id: ''
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Errore crezione regola.');
    }
  };

  const handleToggleRule = async (id: number) => {
    try {
      await axios.put(`/api/crm/rules/${id}/toggle`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Eliminare questa automazione?')) return;
    try {
      await axios.delete(`/api/crm/rules/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!campaignName || !marketingPrompt) return alert('Compila nome campagna e prompt.');
    setGenerating(true);
    try {
      await axios.post('/api/crm/automations', {
        campaign_name: campaignName,
        prompt: marketingPrompt
      });
      alert('Campagna generata e inviata!');
      setCampaignName('');
      setMarketingPrompt('');
      fetchData();
      setActiveTab('marketing'); // Stai su marketing per vedere il resoconto
    } catch (err) {
      console.error(err);
      alert('Errore durante la generazione della campagna.');
    } finally {
      setGenerating(false);
    }
  };

  const totalSpent = customers.reduce((acc, c) => acc + c.total_spent, 0);
  const avgSpent = customers.length ? totalSpent / customers.length : 0;
  const repeatCustomers = customers.filter(c => c.orders_count > 1).length;

  const filteredCustomers = customers.filter(c => {
    const s = searchTerm.toLowerCase();
    const fullName = `${c.first_name || ''} ${c.last_name || ''} ${c.name || ''}`.toLowerCase();
    return fullName.includes(s) || c.phone_number?.includes(s);
  });

  return (
    <div className="p-6 space-y-6 relative z-10 font-sans text-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-xl"><Users className="w-8 h-8 text-rose-400" /></div>
            CRM & Clienti
          </h1>
          <p className="text-slate-400 mt-1">Anagrafiche unificate, storico e LTV (Lifetime Value)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'customers' ? 'border-rose-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Anagrafiche ({customers.length})</div>
        </button>
        <button
          onClick={() => setActiveTab('marketing')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'marketing' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> Marketing Automation</div>
        </button>
      </div>

      {/* CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Clienti Totali</p>
              <h4 className="text-3xl font-black text-rose-400">{customers.length}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">LTV Medio (Lifetime Value)</p>
              <h4 className="text-3xl font-black text-emerald-400">€{avgSpent.toLocaleString()}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Clienti Ricorrenti</p>
              <div className="flex items-end gap-2">
                <h4 className="text-3xl font-black text-white">{repeatCustomers}</h4>
                <span className="text-xs text-slate-500 mb-1">({customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0}%)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 bg-slate-900/40">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Cerca per nome o numero..." 
                  className="w-full bg-slate-800 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none text-white focus:ring-2 focus:ring-rose-500/50 transition-all font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Contatto</th>
                    <th className="px-6 py-4 text-center">Ordini Multipli</th>
                    <th className="px-6 py-4">Ultimo acquisto</th>
                    <th className="px-6 py-4 text-right">LTV (Speso)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {filteredCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/20 transition-all cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-rose-400 border border-rose-500/20">
                            {(c.first_name ? c.first_name[0] : c.name[0])}{(c.last_name ? c.last_name[0] : (c.name.split(' ')[1] ? c.name.split(' ')[1][0] : '')).toUpperCase()}
                          </div>
                          <div>
                            <div>{c.first_name ? `${c.first_name} ${c.last_name}` : c.name}</div>
                            {c.email && <div className="text-[10px] text-slate-500 flex items-center gap-1 font-normal"><Mail className="w-3 h-3"/> {c.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-slate-300 text-xs">{c.phone_number}</div>
                        {c.address && <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3"/> {c.address}</div>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${c.orders_count > 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-500'}`}>
                          {c.orders_count} ordini
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-400">
                        €{c.total_spent.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-slate-600 font-bold">
                        {searchTerm ? "Nessun cliente corrispondente alla ricerca." : "Nessun cliente registrato."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MARKETING TAB */}
      {activeTab === 'marketing' && (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
          <div className="flex gap-4 pb-2">
            <button
               onClick={() => setMarketingSubTab('flows')}
               className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${marketingSubTab === 'flows' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              Flussi di Automazione (Flows)
            </button>
            <button
               onClick={() => setMarketingSubTab('broadcast')}
               className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${marketingSubTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              Campagne Broadcast (Una Tantum)
            </button>
          </div>

          {/* FLOWS UI */}
          {marketingSubTab === 'flows' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Zap className="text-indigo-400 w-5 h-5" /> Regole Attive
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Configura l'IA per mandare email automatiche agli eventi selezionati.</p>
                </div>
                <button 
                  onClick={() => setFlowModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                >
                  + Crea Automazione
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl border-dashed">
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nessuna regola di automazione attiva</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.isArray(rules) && rules.map(r => (
                    <div key={r.id} className={`p-5 rounded-2xl border transition-all ${r.is_active ? 'bg-slate-900/80 border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.1)]' : 'bg-slate-900/40 border-slate-800 opacity-70'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-white text-base">{r.name}</h4>
                        <button 
                          onClick={() => handleToggleRule(r.id)}
                          className={`relative w-10 h-5 rounded-full transition-all duration-300 flex items-center ${r.is_active ? 'bg-indigo-500' : 'bg-slate-700'}`}
                        >
                          <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${r.is_active ? 'translate-x-5.5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400">
                          <span className="bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">T: {r.trigger_event}</span>
                          <span className="bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">+ {r.delay_hours}h</span>
                        </div>
                        {r.resend_template_id ? (
                          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-2 flex items-center gap-2">
                            <Mail size={12} className="text-indigo-400" />
                            <span className="text-[10px] text-indigo-300 font-bold uppercase">Resend Template: {r.resend_template_id}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 line-clamp-2 italic">"{r.prompt_template}"</p>
                        )}
                      </div>

                      <div className="flex justify-end pt-3 border-t border-slate-800/50">
                        <button onClick={() => handleDeleteRule(r.id)} className="text-rose-400 hover:text-rose-300 text-[10px] uppercase font-bold tracking-wider">
                          Elimina Disabilitando Entità
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Crea Modale */}
              {flowModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative">
                    <button onClick={() => setFlowModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">X</button>
                    <h3 className="text-lg font-bold text-white mb-6">Nuova Automazione Visuale</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome Evento (Es: Email Ritorno Cliente)</label>
                        <input className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none" value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Oggetto Email (Usa le variabili: es. Benvenuto {"{{cliente.nome_cognome}}"})</label>
                        <input placeholder="Es: Novità dal tuo ultimo acquisto!" className="w-full bg-slate-800 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors shadow-inner" value={newRule.subject} onChange={e => setNewRule({...newRule, subject: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Trigger</label>
                          <select className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none" value={newRule.trigger_event} onChange={e => setNewRule({...newRule, trigger_event: e.target.value})}>
                            <option value="ORDER_CREATED">Ordine Creato</option>
                            <option value="ACCOUNT_CREATED">Account Creato</option>
                            <option value="IDLE_1_MONTH">1 Mese Inattivo</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Ritardo (Ore)</label>
                          <input type="number" min="0" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none" value={newRule.delay_hours} onChange={e => setNewRule({...newRule, delay_hours: parseInt(e.target.value) || 0})} />
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                        <label className="text-[10px] font-bold text-indigo-300 uppercase mb-1 block">ID Template Resend (Opzionale)</label>
                        <input 
                          placeholder="Es: order-confirmation-v1" 
                          className="w-full bg-slate-800 border border-indigo-500/30 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-white outline-none transition-colors" 
                          value={newRule.resend_template_id} 
                          onChange={e => setNewRule({...newRule, resend_template_id: e.target.value})} 
                        />
                        <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                          Se inserisci un ID Template da Resend Dashboard, l'editor interno verrà ignorato e verranno mappate le variabili standard come {"{{{ordine_id}}}"}.
                        </p>
                      </div>

                      <div className={newRule.resend_template_id ? 'opacity-40 pointer-events-none' : ''}>
                        <div className="flex items-center justify-between mb-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase">Editor Interno {newRule.resend_template_id && '(Disabilitato)'}</label>
                           
                           {/* Toolbar Variabili */}
                           <div className="flex flex-wrap gap-1">
                             <button onClick={() => setNewRule({...newRule, prompt_template: newRule.prompt_template + ' {{cliente.nome_cognome}}'})} className="bg-slate-800 border border-slate-700 hover:border-indigo-500 text-[10px] px-2 py-1 rounded text-slate-300 transition-colors">
                               + Nome
                             </button>
                             <button onClick={() => setNewRule({...newRule, prompt_template: newRule.prompt_template + ' {{cliente.email}}'})} className="bg-slate-800 border border-slate-700 hover:border-indigo-500 text-[10px] px-2 py-1 rounded text-slate-300 transition-colors">
                               + Email
                             </button>
                             <button onClick={() => setNewRule({...newRule, prompt_template: newRule.prompt_template + ' {{ordine.totale}}'})} className="bg-slate-800 border border-slate-700 hover:border-indigo-500 text-[10px] px-2 py-1 rounded text-slate-300 transition-colors">
                               + Totale Ordine
                             </button>
                             <button onClick={() => setNewRule({...newRule, prompt_template: newRule.prompt_template + ' {{ordine.id}}'})} className="bg-slate-800 border border-slate-700 hover:border-indigo-500 text-[10px] px-2 py-1 rounded text-slate-300 transition-colors">
                               + ID Ordine
                             </button>
                           </div>
                        </div>

                        <div className="bg-white text-black rounded-xl overflow-hidden border border-slate-700">
                            <Editor 
                                value={newRule.prompt_template} 
                                onChange={e => setNewRule({...newRule, prompt_template: e.target.value})}
                                containerProps={{ style: { height: '240px', overflowY: 'auto' } }}
                            />
                        </div>
                      </div>
                    </div>
                    <div className="mt-6">
                      <button onClick={handleCreateRule} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all">Salva ed Attiva</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BROADCAST UI */}
          {marketingSubTab === 'broadcast' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-24 h-24 text-indigo-400"/></div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <Mail className="text-indigo-400" />
                      AI Broadcast
                    </h3>
                    <p className="text-xs text-slate-400 mb-6">Invia una comunicazione una-tantum a tutti i tuoi contatti CRM ({customers.length} lead).</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome Campagna</label>
                        <input 
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none"
                          placeholder="Es: Promo Black Friday"
                          value={campaignName}
                          onChange={e => setCampaignName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Task per l'IA Copywriter</label>
                        <textarea 
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none resize-none h-32"
                          placeholder="Es: Scrivi un'email per offrire il 20% di sconto..."
                          value={marketingPrompt}
                          onChange={e => setMarketingPrompt(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={handleLaunchCampaign}
                        disabled={generating}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/40 mt-4"
                      >
                        {generating ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"/> : <ChevronRight className="w-4 h-4" />}
                        Invia a {customers.length} Contatti
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" /> Storico Campagne
                </h2>
                {automations.length === 0 ? (
                  <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl border-dashed">
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nessuna campagna passata</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {automations.map(a => (
                      <div key={a.id} className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-base font-bold text-white">{a.campaign_name}</h4>
                            <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                              Inviata il: {new Date(a.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400">Inviata ({a.sent_count})</span>
                          </div>
                        </div>
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                          <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Prompt utilizzato</p>
                          <p className="text-xs text-slate-300 italic">" {a.prompt_used} "</p>
                        </div>
                        <div className="bg-white text-black p-6 rounded-xl overflow-hidden shadow-inner text-sm relative">
                          <div dangerouslySetInnerHTML={{ __html: a.email_content }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default CRMPage;
