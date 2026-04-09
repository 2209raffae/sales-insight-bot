import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Mail, Zap, ChevronRight, CheckCircle2, History, MapPin } from 'lucide-react';

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

const CRMPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'marketing'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const [marketingPrompt, setMarketingPrompt] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [custRes, autoRes] = await Promise.all([
        axios.get('/api/crm/customers'),
        axios.get('/api/crm/automations')
      ]);
      setCustomers(custRes.data);
      setAutomations(autoRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
                  {customers.map(c => (
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
                  {customers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-slate-600 font-bold">
                        Nessun cliente registrato.
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Action Bar */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-24 h-24 text-indigo-400"/></div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Mail className="text-indigo-400" />
                    AI Marketing
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">Invia una comunicazione personalizzata a tutti i tuoi contatti CRM ({customers.length} lead) in un click.</p>
                  
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
                        placeholder="Es: Scrivi un'email per offrire il 20% di sconto su tutti i mouse gaming, usa un tono persuasivo..."
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

            {/* History List */}
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
        </div>
      )}

    </div>
  );
};

export default CRMPage;
