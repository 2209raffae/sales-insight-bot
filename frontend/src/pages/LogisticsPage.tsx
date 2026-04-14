
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Truck, ClipboardList,
  MapPin, Plus, Search, ChevronRight, Zap, Box, ArrowRight,
  Layers, ArrowLeft, User, Globe, FileText, RefreshCw, Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  qty: number;
  price: number;
  product_location?: string;
}

interface Order {
  id: number;
  customer_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  shipping_address?: string;
  phone_number?: string;
  shipping_fee: number;
  lead_id?: number;
  status: string;
  channel: string;
  total: number;
  created_at: string;
  // AI-persisted fields from DB
  ai_packaging?: string;
  ai_reason?: string;
  ai_analyzed: boolean;
  picking_index?: number;
  items: OrderItem[];
  shipment?: {
    courier: string | null;
    tracking: string | null;
    status: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  'Da Preparare':    'bg-amber-500/20 text-amber-400',
  'In Preparazione': 'bg-indigo-500/20 text-indigo-400',
  'Pronto':          'bg-violet-500/20 text-violet-400',
  'Spedito':         'bg-emerald-500/20 text-emerald-400',
  'Completato':      'bg-emerald-500/20 text-emerald-400',
};
const LogisticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'picking'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [generatingLabel, setGeneratingLabel] = useState<number | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.is_admin === 1;

  // New Order Form states
  const [products, setProducts] = useState<any[]>([]);
  const [newOrderForm, setNewOrderForm] = useState({
    first_name: '', last_name: '', email: '', phone_number: '', 
    shipping_street: '', shipping_city: '', shipping_zip: '', shipping_province: '', shipping_country: 'Italia',
    order_channel: 'Fisico', shipping_fee: 0,
    items: [{ product_id: 0, quantity: 1, unit_price: 0 }]
  });

  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get('/api/warehouse/products');
      setProducts(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      console.log('LogisticsPage: Fetching orders...');
      const res = await axios.get('/api/logistics/orders');
      console.log('LogisticsPage: Response received:', res.data);
      if (Array.isArray(res.data)) {
        setOrders(res.data);
      } else {
        console.error('LogisticsPage: Expected array but received:', res.data);
        setOrders([]);
      }
    } catch (err) { 
      console.error('LogisticsPage: Fetch error:', err); 
      setOrders([]);
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { 
    fetchOrders(); 
    fetchProducts();
  }, [fetchOrders, fetchProducts]);

  // Poll for AI results every 4s when on picking tab and there are unanalyzed orders
  useEffect(() => {
    if (activeTab !== 'picking') return;
    const hasUnanalyzed = orders.some(
      o => !o.ai_analyzed && (o.status === 'Da Preparare' || o.status === 'In Preparazione')
    );
    if (!hasUnanalyzed) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get('/api/logistics/orders');
        if (Array.isArray(res.data)) {
          setOrders(res.data);
          const stillPending = res.data.some(
            (o: Order) => !o.ai_analyzed && (o.status === 'Da Preparare' || o.status === 'In Preparazione')
          );
          if (!stillPending) clearInterval(interval);
        }
      } catch (err) {
        console.error('LogisticsPage: Polling error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTab, orders]);

  const triggerAIAnalysis = async () => {
    try {
      setAnalyzingAI(true);
      await axios.post('/api/logistics/ai/analyze-pending');
      // Poll until analysis is done
      setTimeout(fetchOrders, 3000);
      setTimeout(fetchOrders, 7000);
    } catch (err) { console.error(err); } finally {
      setTimeout(() => setAnalyzingAI(false), 8000);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      await axios.patch(`/api/logistics/orders/${orderId}/status?status=${status}`);
      // Optimistic update — only update status, keep AI data intact
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    } catch (err) { console.error(err); }
  };

  const generateLabel = async (orderId: number) => {
    try {
      setGeneratingLabel(orderId);
      const res = await axios.post(`/api/logistics/orders/${orderId}/generate-label`);
      // Update the specific order to reflect new tracking
      fetchOrders();
      alert(res.data.message + '\nTracking: ' + res.data.tracking_code);
    } catch (err) { console.error(err); } finally { setGeneratingLabel(null); }
  };

  const stats = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const total = safeOrders.length;
    const pending = safeOrders.filter(o => o.status === 'Da Preparare').length;
    const delivered = safeOrders.filter(o => ['Completato', 'Consegnato', 'Spedito'].includes(o.status)).length;
    const unanalyzed = safeOrders.filter(o => !o.ai_analyzed && (o.status === 'Da Preparare' || o.status === 'In Preparazione')).length;
    return { total, pending, delivered, unanalyzed };
  }, [orders]);

  const ordersToPrepare = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    return safeOrders
      .filter(o => o.status === 'Da Preparare' || o.status === 'In Preparazione')
      .sort((a, b) => {
        return (a.picking_index ?? 9999) - (b.picking_index ?? 9999);
      });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    let result = safeOrders;
    
    // Testo di ricerca
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(o =>
        (o.customer_name || "").toLowerCase().includes(q) ||
        String(o.id).includes(q) ||
        (o.shipment?.tracking && o.shipment.tracking.toLowerCase().includes(q)) ||
        (o.shipping_address && o.shipping_address.toLowerCase().includes(q))
      );
    }
    
    // Filtro per data
    if (filterDate) {
      result = result.filter(o => o.created_at && o.created_at.startsWith(filterDate));
    }
    
    // Ordinamento: sempre i più recenti in cima
    return [...result].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [orders, searchQuery, filterDate]);

  return (
    <div className="p-6 space-y-6 relative z-10 font-sans text-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl"><Truck className="w-8 h-8 text-indigo-400" /></div>
            Logistics &amp; Order Hub
          </h1>
          <p className="text-slate-400 mt-1">Gestione intelligente degli ordini fisici e online</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all font-medium flex items-center gap-2 shadow-lg shadow-indigo-900/20"
        >
          <Plus className="w-4 h-4" /> Nuovo Ordine
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'orders' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Gestione Ordini ({stats.total})</div>
        </button>
        <button
          onClick={() => setActiveTab('picking')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'picking' ? 'border-amber-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" /> Sequencing Picking
            {stats.unanalyzed > 0 && (
              <span className="bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{stats.unanalyzed}</span>
            )}
          </div>
        </button>
      </div>

      {/* ========== ORDERS TAB ========== */}
      {activeTab === 'orders' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Da Preparare</p>
              <h4 className="text-3xl font-black text-amber-400">{stats.pending}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Fatturato Ordini</p>
              <h4 className="text-3xl font-black text-white">€{orders.reduce((a, o) => a + o.total, 0).toLocaleString()}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Consegne Completate</p>
              <h4 className="text-3xl font-black text-emerald-400">{stats.delivered}</h4>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 flex items-center gap-4 bg-slate-900/50 rounded-xl px-4 py-2 border border-slate-800 focus-within:border-indigo-500/50 transition-colors">
                <Search className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cerca per cliente, #ordine, tracking, indirizzo…"
                  className="bg-transparent border-none text-sm outline-none text-white flex-1 placeholder:text-slate-600 h-9"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white text-xs font-bold px-2">✕</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="bg-slate-900/50 border border-slate-800 text-slate-300 text-sm rounded-xl px-4 py-2 outline-none focus:border-indigo-500/50 h-13"
                  style={{ colorScheme: 'dark' }}
                />
                {(searchQuery || filterDate) && (
                  <button onClick={() => { setSearchQuery(''); setFilterDate(''); }} className="text-[10px] text-slate-500 hover:text-white font-bold uppercase underline">Reset</button>
                )}
                <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap bg-slate-800/40 px-3 py-1.5 rounded-lg">{filteredOrders.length} ordini</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4 text-slate-500">
                  <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-widest">Caricamento ordini...</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Data Ordine</th>
                      <th className="px-6 py-4">Ordine</th>
                      <th className="px-6 py-4">Canale</th>
                      <th className="px-6 py-4">Cliente / Indirizzo</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Tracking</th>
                      <th className="px-6 py-4 text-right">Totale</th>
                      <th className="px-6 py-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-800/20 transition-all cursor-pointer" onClick={() => setSelectedOrder(o)}>
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{new Date(o.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">#{o.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {o.channel === 'Online' ? <Globe className="w-3 h-3 text-cyan-400" /> : <MapPin className="w-3 h-3 text-indigo-400" />}
                            <span className="text-xs uppercase font-bold text-slate-400">{o.channel}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-200">{o.customer_name}</div>
                          {o.shipping_address && <div className="text-[10px] text-slate-500 mt-0.5">{o.shipping_address}</div>}
                          {o.phone_number && <div className="text-[10px] text-slate-500">{o.phone_number}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${STATUS_COLORS[o.status] || 'bg-slate-800 text-slate-400'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {o.shipment?.tracking
                            ? <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">{o.shipment.tracking}</span>
                            : <span className="text-slate-700 text-[10px]">—</span>
                          }
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-white">€{o.total.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={e => { e.stopPropagation(); setSelectedOrder(o); }} className="p-2 hover:bg-slate-800 rounded-lg">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-slate-600 font-bold">
                          Nessun risultato per "{searchQuery}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========== PICKING TAB ========== */
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900 border border-indigo-500/20 p-6 rounded-3xl shadow-[0_0_50px_-12px_rgba(99,102,241,0.1)]">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-md font-bold text-white">Logistics Engine v5</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Il sistema utilizza un **algoritmo deterministico** per calcolare l'imballaggio ideale (3D Box) e per **sequenziare gli ordini** in base agli articoli comuni, massimizzando l'efficienza di prelievo.
                </p>

                {stats.unanalyzed > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 p-2 rounded-lg animate-pulse">
                      <Zap className="w-3 h-3" /> {stats.unanalyzed} ordini da sequenziare
                    </div>
                    <button
                      onClick={triggerAIAnalysis}
                      disabled={analyzingAI}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    >
                      {analyzingAI
                        ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Elaborazione…</>
                        : <><Zap className="w-4 h-4" /> Ottimizza Sequenza</>
                      }
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 p-2 rounded-lg">
                    <Zap className="w-3 h-3" /> Tutti gli ordini sequenziati
                  </div>
                )}

                <button
                  onClick={fetchOrders}
                  className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Aggiorna ordini
                </button>
              </div>

              {/* Next in queue sidebar */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Prossimi in coda</h3>
                <div className="space-y-3">
                  {orders.filter(o => o.status === 'Da Preparare').slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl hover:bg-slate-800 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-white">#{o.id} - {o.customer_name}</div>
                        {o.ai_packaging && (
                          <div className="text-[9px] text-indigo-400 mt-0.5 flex items-center gap-1">
                            <Box className="w-2.5 h-2.5" /> {o.ai_packaging}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main picking queue */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Box className="w-6 h-6 text-indigo-400" /> Coda Preparazione
              </h2>

              {ordersToPrepare.length === 0 ? (
                <div className="p-20 text-center bg-slate-900/40 border border-slate-800 rounded-3xl border-dashed">
                  <Zap className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest">Nessun ordine in attesa</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {ordersToPrepare.map((o, i) => (
                    <div
                      key={o.id}
                      className={`bg-slate-900/60 border ${o.status === 'In Preparazione' ? 'border-indigo-500/40' : 'border-slate-800'} p-6 rounded-3xl space-y-5 shadow-xl hover:border-indigo-500/30 transition-all relative`}
                    >
                      {/* Position badge */}
                      <div className="absolute -left-3 top-6 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                        {i + 1}
                      </div>

                      {/* Header */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl flex-shrink-0 mt-1 ${o.status === 'In Preparazione' ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                            <ClipboardList className={`w-5 h-5 ${o.status === 'In Preparazione' ? 'text-white' : 'text-indigo-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <h4 className="text-base font-black text-white">Ordine #{o.id} — {o.customer_name}</h4>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${o.channel === 'Online' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-indigo-500/20 text-indigo-400'}`}>{o.channel}</span>
                            </div>
                            <div className="mt-1.5 space-y-0.5">
                              {o.shipping_address && (
                                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-600 flex-shrink-0" />{o.shipping_address}
                                </div>
                              )}
                              {o.phone_number && (
                                <div className="text-[11px] text-slate-400">📞 {o.phone_number}</div>
                              )}
                              {o.ai_reason && (
                                <div className="text-[10px] text-indigo-300 font-bold flex items-center gap-1 pt-0.5">
                                  <Zap className="w-3 h-3" /> {o.ai_reason}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Packaging badge */}
                        <div className={`px-6 py-4 border rounded-2xl shadow-xl min-w-[170px] text-center flex-shrink-0 transition-all ${o.ai_packaging ? 'bg-cyan-600 border-cyan-400 shadow-cyan-900/40 scale-105' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
                          <p className={`text-[10px] font-black uppercase mb-2 ${o.ai_packaging ? 'text-white' : 'text-slate-500'}`}>Imballaggio consigliato</p>
                          <div className="flex items-center justify-center gap-3">
                            <Box className={`w-6 h-6 ${o.ai_packaging && o.ai_packaging !== 'Nessun imballaggio adatto' ? 'text-white' : 'text-slate-600'}`} />
                            <span className={`text-sm md:text-md font-black ${o.ai_packaging && o.ai_packaging !== 'Nessun imballaggio adatto' ? 'text-white' : 'text-slate-400'}`}>
                              {o.ai_packaging || (o.ai_analyzed ? '—' : '…')}
                            </span>
                          </div>
                          {!o.ai_analyzed && (
                            <p className="text-[9px] text-indigo-300 mt-1">In attesa AI</p>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(o.items || []).map((p, idx) => (
                          <div key={idx} className="bg-slate-800/40 p-3 rounded-xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center text-[9px] font-bold text-slate-500">{idx + 1}</div>
                              <span className="text-xs font-bold text-slate-200">
                                {p.product_name} <span className="text-slate-500 text-[10px] font-mono">[{p.product_sku}]</span>
                              </span>
                              {p.product_location && (
                                <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-md border border-cyan-500/20 font-bold">
                                  <MapPin className="w-2.5 h-2.5 inline mr-1" /> {p.product_location}
                                </span>
                              )}
                            </div>
                            <span className="font-black text-white text-lg">×{p.qty}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="pt-4 border-t border-slate-800 space-y-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black text-slate-500 uppercase mr-1">Status:</span>
                          {['Da Preparare', 'In Preparazione', 'Pronto', 'Spedito'].map(st => (
                            <button
                              key={st}
                              onClick={() => updateOrderStatus(o.id, st)}
                              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${o.status === st ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-700'}`}
                            >
                              {st === 'Da Preparare' ? 'To Prep' : st === 'In Preparazione' ? 'Prep' : st === 'Pronto' ? 'Pronto' : '✅ Spedito'}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          {o.shipment?.tracking ? (
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                              <Zap className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] text-emerald-400 font-bold">Tracking:</span>
                              <span className="font-mono text-xs text-white font-black">{o.shipment.tracking}</span>
                            </div>
                          ) : <div />}
                          <button
                            onClick={() => generateLabel(o.id)}
                            disabled={generatingLabel === o.id}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border-indigo-500/20 shadow-lg"
                          >
                            {generatingLabel === o.id
                              ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <FileText className="w-4 h-4" />
                            }
                            {o.shipment?.tracking ? 'Rigenera Etichetta' : 'Genera Etichetta'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full p-8 overflow-y-auto animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black flex items-center gap-3 text-white">
                <button onClick={() => setSelectedOrder(null)}><ArrowLeft className="w-5 h-5 text-slate-500 hover:text-white" /></button>
                Ordine #{selectedOrder.id}
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_COLORS[selectedOrder.status] || 'bg-slate-800 text-slate-400'}`}>
                {selectedOrder.status}
              </span>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <InfoRow icon={<User className="w-4 h-4 text-indigo-400" />} label="Cliente" value={`${selectedOrder.first_name || ''} ${selectedOrder.last_name || ''}`.trim() || selectedOrder.customer_name} />
                </div>
                <InfoRow icon={<Mail className="w-4 h-4 text-indigo-400" />} label="Email" value={selectedOrder.email || '—'} />
                <InfoRow icon={<Globe className="w-4 h-4 text-indigo-400" />} label="Canale" value={selectedOrder.channel} />
                <InfoRow icon={<MapPin className="w-4 h-4 text-indigo-400" />} label="Indirizzo" value={selectedOrder.shipping_address || '—'} small />
                <InfoRow icon={<User className="w-4 h-4 text-indigo-400" />} label="Telefono" value={selectedOrder.phone_number || '—'} />
                {selectedOrder.channel === 'Online' && (
                  <InfoRow icon={<Truck className="w-4 h-4 text-indigo-400" />} label="Spedizione" value={`€${selectedOrder.shipping_fee.toFixed(2)}`} />
                )}
                {selectedOrder.ai_packaging && (
                  <InfoRow icon={<Box className="w-4 h-4 text-cyan-400" />} label="Imballaggio Consigliato" value={selectedOrder.ai_packaging} accent />
                )}
                {selectedOrder.shipment?.tracking && (
                  <InfoRow icon={<Zap className="w-4 h-4 text-emerald-400" />} label="Tracking" value={selectedOrder.shipment.tracking} accent green />
                )}
              </div>

              <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50 text-center">
                <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">Totale Ordine</p>
                <h3 className="text-3xl font-black text-white">€{selectedOrder.total.toLocaleString()}</h3>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Box className="w-4 h-4" /> Articoli
                </h3>
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-700/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center font-bold text-indigo-400">{item.qty}</div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.product_name}</p>
                        <p className="text-[10px] text-slate-500">{item.product_sku}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-white">€{(item.qty * item.price).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-slate-800 space-y-3">
                <p className="text-xs text-slate-500">Azioni rapide:</p>
                <div className="grid grid-cols-2 gap-3">
                  {selectedOrder.status === 'Da Preparare' && (
                    <button onClick={() => updateOrderStatus(selectedOrder.id, 'In Preparazione')} className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-sm transition-all">
                      Inizia Preparazione
                    </button>
                  )}
                  {selectedOrder.status === 'In Preparazione' && (
                    <button onClick={() => updateOrderStatus(selectedOrder.id, 'Pronto')} className="py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl text-sm transition-all">
                      Segna Pronto
                    </button>
                  )}
                  {(selectedOrder.status === 'In Preparazione' || selectedOrder.status === 'Pronto') && (
                    <button onClick={() => updateOrderStatus(selectedOrder.id, 'Spedito')} className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm transition-all">
                      Spedisci
                    </button>
                  )}
                  <button
                    onClick={() => generateLabel(selectedOrder.id)}
                    disabled={generatingLabel === selectedOrder.id}
                    className="py-3 bg-slate-800 hover:bg-indigo-600/20 border border-slate-700 hover:border-indigo-500/30 text-slate-300 hover:text-indigo-400 font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    {selectedOrder.shipment?.tracking ? 'Rigenera Etichetta' : 'Genera Etichetta'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW ORDER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-400" /> Nuovo Ordine Rapido</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white font-bold px-2 py-1">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome</label>
                  <input type="text" value={newOrderForm.first_name} onChange={e => setNewOrderForm({...newOrderForm, first_name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none" placeholder="Es. Mario" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Cognome</label>
                  <input type="text" value={newOrderForm.last_name} onChange={e => setNewOrderForm({...newOrderForm, last_name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none" placeholder="Es. Rossi" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Telefono</label>
                  <input type="text" value={newOrderForm.phone_number} onChange={e => setNewOrderForm({...newOrderForm, phone_number: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none" placeholder="Es. 3331112222" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Email {newOrderForm.order_channel === 'Fisico' && '(Facoltativa)'}</label>
                  <input type="email" value={newOrderForm.email} onChange={e => setNewOrderForm({...newOrderForm, email: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none" placeholder="mario@esempio.it" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Canale di Vendita</label>
                <select value={newOrderForm.order_channel} onChange={e => setNewOrderForm({...newOrderForm, order_channel: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none">
                  <option value="Fisico">Ritiro Fisico in Negozio</option>
                  <option value="Online">Online / Da Spedire</option>
                </select>
              </div>

              {newOrderForm.order_channel === 'Online' && (
                <>
                  <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-2xl space-y-4">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                       <MapPin className="w-3 h-3"/> Indirizzo di Spedizione (Obbligatorio)
                    </p>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Via e Numero Civico</label>
                      <input type="text" value={newOrderForm.shipping_street} onChange={e => setNewOrderForm({...newOrderForm, shipping_street: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none" placeholder="Es. Via Roma 12" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Città</label>
                        <input type="text" value={newOrderForm.shipping_city} onChange={e => setNewOrderForm({...newOrderForm, shipping_city: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Milano" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">CAP</label>
                        <input type="text" value={newOrderForm.shipping_zip} onChange={e => setNewOrderForm({...newOrderForm, shipping_zip: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="20100" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Provincia</label>
                        <input type="text" maxLength={2} value={newOrderForm.shipping_province} onChange={e => setNewOrderForm({...newOrderForm, shipping_province: e.target.value.toUpperCase()})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none text-center" placeholder="MI" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Stato</label>
                      <input type="text" value={newOrderForm.shipping_country} onChange={e => setNewOrderForm({...newOrderForm, shipping_country: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Italia" />
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block flex items-center gap-2">
                       <Truck className="w-3 h-3"/> Tariffa Spedizione (€) {!isAdmin && <span className="text-slate-500 font-normal">(Sola lettura)</span>}
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly={!isAdmin}
                      value={newOrderForm.shipping_fee} 
                      onChange={e => setNewOrderForm({...newOrderForm, shipping_fee: parseFloat(e.target.value) || 0})} 
                      className={`w-32 bg-slate-800 border ${isAdmin ? 'border-indigo-500/50' : 'border-slate-700'} rounded-xl px-4 py-2 text-sm text-white outline-none`} 
                    />
                  </div>
                </>
              )}

              <div className="mt-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Aggiungi Prodotti</label>
                {newOrderForm.items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-end">
                    <div className="flex-1">
                      <label className="text-[8px] font-bold text-slate-500 uppercase mb-1 block">Prodotto</label>
                      <select 
                        value={it.product_id} 
                        onChange={e => {
                          const pid = parseInt(e.target.value);
                          const p = products.find(prod => prod.id === pid);
                          const newItems = [...newOrderForm.items];
                          newItems[idx].product_id = pid;
                          if (p) newItems[idx].unit_price = p.selling_price || 0;
                          setNewOrderForm({...newOrderForm, items: newItems});
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-[11px] text-white focus:border-indigo-500 outline-none"
                      >
                        <option value={0}>Seleziona prodotto...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - disp. {p.quantity}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-[8px] font-bold text-slate-500 uppercase mb-1 block">Q.tà</label>
                      <input 
                        type="number" min="1" max="999" 
                        value={it.quantity} 
                        onChange={e => {
                          const newItems = [...newOrderForm.items];
                          newItems[idx].quantity = parseInt(e.target.value) || 1;
                          setNewOrderForm({...newOrderForm, items: newItems});
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-indigo-500 outline-none text-center"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-[8px] font-bold text-slate-500 uppercase mb-1 block">Prezzo (€)</label>
                      <input 
                        type="number" step="0.01"
                        readOnly={!isAdmin}
                        value={it.unit_price} 
                        onChange={e => {
                          const newItems = [...newOrderForm.items];
                          newItems[idx].unit_price = parseFloat(e.target.value) || 0;
                          setNewOrderForm({...newOrderForm, items: newItems});
                        }}
                        className={`w-full bg-slate-800 border ${isAdmin ? 'border-indigo-500/30' : 'border-slate-700'} rounded-xl px-3 py-2.5 text-sm text-white outline-none text-right`}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const newItems = newOrderForm.items.filter((_, i) => i !== idx);
                        setNewOrderForm({...newOrderForm, items: newItems});
                      }}
                      className="text-red-400 hover:bg-red-500/20 px-3 py-2.5 rounded-xl transition-colors font-bold"
                    >✕</button>
                  </div>
                ))}
                <button 
                  onClick={() => setNewOrderForm({...newOrderForm, items: [...newOrderForm.items, { product_id: 0, quantity: 1, unit_price: 0 }]})}
                  className="text-xs text-indigo-400 font-bold hover:underline py-1 mt-1 block"
                >+ Aggiungi altra riga</button>
              </div>

            </div>
            
            <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="text-left">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Totale Stimato</p>
                <p className="text-xl font-black text-white">
                  €{(newOrderForm.items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0) + (newOrderForm.order_channel === 'Online' ? newOrderForm.shipping_fee : 0)).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2.5 bg-transparent border border-slate-600 rounded-xl font-bold text-slate-300 hover:bg-slate-800"
                >
                  Annulla
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const validItems = newOrderForm.items.filter(i => i.product_id > 0 && i.quantity > 0);
                      if (validItems.length === 0) return alert('Seleziona almeno un prodotto.');
                      if (!newOrderForm.first_name || !newOrderForm.last_name) return alert('Inserisci nome e cognome.');
                      
                      if (newOrderForm.order_channel === 'Online') {
                        const required = ['shipping_street', 'shipping_city', 'shipping_zip', 'shipping_province', 'shipping_country'];
                        const missing = required.filter(f => !newOrderForm[f as keyof typeof newOrderForm]);
                        if (missing.length > 0) {
                          return alert('Per ordini online, l\'indirizzo deve essere completo (Via, Città, CAP, Provincia, Stato).');
                        }
                      }

                      const payload = {
                        ...newOrderForm,
                        items: validItems
                      };
                      
                      await axios.post('/api/logistics/orders', payload);
                      fetchOrders();
                      setShowAddModal(false);
                      setNewOrderForm({ 
                        first_name: '', last_name: '', email: '', phone_number: '', 
                        shipping_street: '', shipping_city: '', shipping_zip: '', shipping_province: '', shipping_country: 'Italia',
                        order_channel: 'Fisico', shipping_fee: 0,
                        items: [{ product_id: 0, quantity: 1, unit_price: 0 }] 
                      });
                    } catch(e: any) { alert('Errore: ' + (e.response?.data?.detail || e.message)); }
                  }}
                  className="px-6 py-2.5 bg-indigo-600 rounded-xl font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/30"
                >
                  Crea ed Emetti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Small helper component for the drawer info rows
const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
  accent?: boolean;
  green?: boolean;
}> = ({ icon, label, value, small, accent, green }) => (
  <div className="flex items-center gap-3">
    <div className={`p-2 rounded-xl flex-shrink-0 ${green ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>{icon}</div>
    <div>
      <p className={`text-[9px] font-bold uppercase ${green ? 'text-emerald-500' : 'text-slate-500'}`}>{label}</p>
      <p className={`font-bold ${small ? 'text-xs' : 'text-sm'} ${accent && !green ? 'text-indigo-300' : green ? 'font-mono text-white' : 'text-white'}`}>{value}</p>
    </div>
  </div>
);

export default LogisticsPage;
