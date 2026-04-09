import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Package, Plus, Search, TrendingUp, Edit3, Sparkles, Eye, EyeOff, Trash2, 
  ChevronDown, ChevronUp, X, History, Layers, CheckSquare, Square, 
  Upload, Download, ArrowLeft
} from 'lucide-react';

interface WarehouseProduct {
  id: number;
  sku: string;
  name: string;
  category: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  status: string;
  metadata: any;
  days_in_stock: number;
  sync_status: number;
  is_visible: number;
  margin_pct: number | null;
  is_low_stock: boolean;
  reorder_point: number;
  ecommerce_url?: string;
  updated_at: string;
  location?: string;
  width: number;
  height: number;
  depth: number;
  is_packaging: number;
}

interface Movement {
  id: number;
  type: string;
  delta: number;
  old: number | null;
  new: number | null;
  notes: string;
  at: string;
  by: string;
}

const COLORS = ['#22d3ee', '#34d399', '#818cf8', '#fbbf24', '#f87171', '#a78bfa', '#fb7185'];

const WarehousePage: React.FC = () => {
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [minQty, setMinQty] = useState('');
  const [sortBy, setSortBy] = useState<'none' | 'price-asc' | 'price-desc' | 'qty-asc' | 'qty-desc' | 'margin-asc' | 'margin-desc'>('none');
  
  const [aiStrategy, setAiStrategy] = useState<string | null>(null);
  const [aiBundles, setAiBundles] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<WarehouseProduct | null>(null);
  const [newProduct, setNewProduct] = useState({ 
    sku: '', name: '', category: '', purchase_price: 0, 
    selling_price: 0, quantity: 0, reorder_point: 3,
    location: '', width: 0, height: 0, depth: 0, is_packaging: 0
  });
  
  const [showMovements, setShowMovements] = useState<WarehouseProduct | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ product: WarehouseProduct, recommendation: any } | null>(null);
  const [movementsData, setMovementsData] = useState<Movement[]>([]);
  const [chartData, setChartData] = useState<{category: string, value: number}[]>([]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const [pRes, cRes] = await Promise.all([
        axios.get('/api/warehouse/products'),
        axios.get('/api/warehouse/stats/charts')
      ]);
      setProducts(pRes.data);
      setChartData(cRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchAiStrategy = async () => {
    try {
      setLoadingStrategy(true);
      const [sRes, bRes] = await Promise.all([
        axios.get('/api/warehouse/ai/strategy'),
        axios.get('/api/warehouse/ai/bundles')
      ]);
      setAiStrategy(sRes.data.strategy);
      setAiBundles(bRes.data.bundles);
    } catch (err) { console.error(err); } finally { setLoadingStrategy(false); }
  };

  useEffect(() => {
    fetchProducts();
    fetchAiStrategy();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/warehouse/products', newProduct);
      setShowAddModal(false);
      setNewProduct({ 
        sku: '', name: '', category: '', purchase_price: 0, 
        selling_price: 0, quantity: 0, reorder_point: 3,
        location: '', width: 0, height: 0, depth: 0, is_packaging: 0
      });
      fetchProducts();
    } catch (err: any) { alert(err.response?.data?.detail || "Errore inserimento"); }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const res = await axios.patch(`/api/warehouse/products/${editingProduct.id}`, editingProduct);
      setProducts(products.map(p => p.id === editingProduct.id ? res.data : p));
      setEditingProduct(null);
    } catch (err) { console.error(err); }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("/api/warehouse/import", formData);
      alert(res.data.message);
      fetchProducts();
    } catch (err) { alert("Errore caricamento CSV"); }
  };

  const downloadTemplate = async () => {
     window.location.href = "/api/warehouse/template";
  };

  const handleBulkAction = async (action: string) => {
    if (!selectedIds.length) return;
    try {
      await axios.post('/api/warehouse/products/bulk', { ids: selectedIds, action });
      fetchProducts();
      setSelectedIds([]);
    } catch (err) { console.error(err); }
  };

  const toggleVisibility = async (id: number, currentVisible: number) => {
    try {
      const newVal = currentVisible === 1 ? 0 : 1;
      await axios.patch(`/api/warehouse/products/${id}/visibility`, { is_visible: newVal });
      setProducts(products.map(p => p.id === id ? { ...p, is_visible: newVal } : p));
    } catch (err) { console.error(err); }
  };

  const optimizePrice = async (p: WarehouseProduct) => {
    try {
      const res = await axios.get(`/api/warehouse/ai/optimize-price/${p.id}`);
      if (res.data && res.data.suggested_price) {
        setAiSuggestion({ product: p, recommendation: res.data });
      } else {
        alert("L'AI non ha prodotto un suggerimento valido per questo articolo.");
      }
    } catch (err) { 
      console.error(err);
      alert("Errore durante l'analisi AI.");
    }
  };

  const applyAiPrice = async () => {
    if (!aiSuggestion) return;
    try {
      await axios.patch(`/api/warehouse/products/${aiSuggestion.product.id}`, { 
        selling_price: aiSuggestion.recommendation.suggested_price 
      });
      fetchProducts();
      setAiSuggestion(null);
    } catch (err) { console.error(err); }
  };

  const sortedProducts = useMemo(() => {
    let res = products.filter(p => {
      const ms = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const mc = categoryFilter === 'all' || p.category === categoryFilter;
      const mqty = minQty === '' || p.quantity >= parseInt(minQty);
      return ms && mc && mqty;
    });
    if (sortBy.includes('price')) res.sort((a,b) => sortBy.includes('asc') ? a.selling_price-b.selling_price : b.selling_price-a.selling_price);
    if (sortBy.includes('qty')) res.sort((a,b) => sortBy.includes('asc') ? a.quantity-b.quantity : b.quantity-a.quantity);
    if (sortBy.includes('margin')) res.sort((a,b) => sortBy.includes('asc') ? (a.margin_pct||0)-(b.margin_pct||0) : (b.margin_pct||0)-(a.margin_pct||0));
    return res;
  }, [products, searchTerm, categoryFilter, sortBy, minQty]);

  const stats = useMemo(() => ({
    totalStock: products.reduce((a,p) => a+p.quantity, 0),
    totalPurchase: products.reduce((a,p) => a + (p.purchase_price * p.quantity), 0),
    available: products.filter(p => p.quantity > 0).length
  }), [products]);

  return (
    <div className="p-6 space-y-6 relative z-10 font-sans text-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-cyan-400" />
            Warehouse Intelligence PRO v2
          </h1>
          <p className="text-slate-400 mt-1">Gestione scorte avanzata con importazione CSV e tracking utente</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={downloadTemplate}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Template CSV
          </button>
          <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all font-medium flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> Import CSV
            <input type="file" className="hidden" accept=".csv" onChange={handleCsvImport} />
          </label>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all font-medium shadow-lg shadow-cyan-900/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nuovo
          </button>
        </div>
      </div>

      {/* DASHBOARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 min-h-[350px]">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" /> Valore Stock per Categoria (€)
          </h3>
          <div className="h-64 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="category" type="category" stroke="#64748b" fontSize={11} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#22d3ee' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-6 backdrop-blur-md">
          <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4" /> AI Bundle Suggeriti
          </h3>
          <div className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {loadingStrategy ? "Generazione kit bundle..." : (aiBundles || "Nessun bundle suggerito.")}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setAiCollapsed(!aiCollapsed)}>
          <div className="flex items-center gap-4">
             <div className="p-2 bg-cyan-500/10 rounded-lg"><Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" /></div>
             <h3 className="text-md font-bold text-white">Consulenza Strategica AI</h3>
          </div>
          {aiCollapsed ? <ChevronDown className="text-slate-500" /> : <ChevronUp className="text-slate-500" />}
        </div>
        {!aiCollapsed && <div className="mt-4 text-sm text-slate-400 border-t border-slate-800 pt-4 whitespace-pre-wrap">{loadingStrategy ? "Interpretando i dati..." : aiStrategy}</div>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Valore Acquisto</p>
          <h4 className="text-xl font-bold text-emerald-400">€{stats.totalPurchase.toLocaleString('it-IT')}</h4>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Articoli Disponibili</p>
          <h4 className="text-xl font-bold text-white">{stats.available}</h4>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {selectedIds.length > 0 && (
          <div className="bg-cyan-600 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-lg">
            <span className="font-bold text-white">{selectedIds.length} Selezionati</span>
            <div className="flex gap-2">
              <button onClick={() => handleBulkAction('show')} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-bold text-white">Mostra</button>
              <button onClick={() => handleBulkAction('hide')} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-bold text-white">Nascondi</button>
              <button onClick={() => handleBulkAction('delete')} className="px-3 py-1 bg-red-400/20 hover:bg-red-400/30 rounded text-xs font-bold text-red-100">Elimina</button>
              <X className="w-4 h-4 cursor-pointer ml-3" onClick={() => setSelectedIds([])} />
            </div>
          </div>
        )}

        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center gap-4 bg-slate-900/40">
          <div className="relative flex-grow min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" placeholder="Cerca SKU..." className="bg-slate-800 border-none rounded-lg py-2 pl-10 w-full text-sm outline-none text-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="bg-slate-800 rounded-lg py-2 px-3 text-sm outline-none text-slate-300" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Tutte le Categorie</option>
            {Array.from(new Set(products.map(p => p.category))).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold uppercase">Qtà Minima:</span>
            <input type="number" className="bg-slate-800 rounded-lg py-2 px-3 text-sm w-20 text-white outline-none" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </div>
          <select className="bg-slate-800 rounded-lg py-2 px-3 text-sm outline-none text-slate-300" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="none">Ordina per...</option>
            <option value="price-desc">Prezzo Mas.</option>
            <option value="price-asc">Prezzo Min.</option>
            <option value="margin-desc">Margine Mas.</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-800/40 text-slate-400 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 w-10">
                   <button onClick={() => setSelectedIds(selectedIds.length === products.length ? [] : products.map(p => p.id))}>
                    {selectedIds.length === products.length ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4" />}
                   </button>
                </th>
                <th className="px-6 py-4 font-bold">Articolo/SKU</th>
                <th className="px-6 py-4 font-bold text-center">Posizione</th>
                <th className="px-6 py-4 font-bold text-center">E-Comm</th>
                <th className="px-6 py-4 font-bold text-right">Acquisto</th>
                <th className="px-6 py-4 font-bold text-right">Vendita</th>
                <th className="px-6 py-4 font-bold text-center">Margine</th>
                <th className="px-6 py-4 font-bold text-center">Qtà</th>
                <th className="px-6 py-4 font-bold text-center">Giacenza</th>
                <th className="px-6 py-4 font-bold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? <tr><td colSpan={9} className="h-40 animate-pulse bg-slate-800" /></tr> : sortedProducts.map(p => (
                <tr key={p.id} className={`hover:bg-slate-800/30 transition-all ${selectedIds.includes(p.id) ? 'bg-cyan-500/5' : ''}`}>
                  <td className="px-6 py-4">
                     <button onClick={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}>
                      {selectedIds.includes(p.id) ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4" />}
                     </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-white">
                      {p.name}
                      {p.is_packaging === 1 && <span className="ml-2 text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded">PACK</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-xs font-mono text-cyan-500 bg-cyan-500/5 px-2 py-1 rounded inline-block border border-cyan-500/10">
                      {p.location || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => toggleVisibility(p.id, p.is_visible)} className={`p-2 rounded-lg ${p.is_visible ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-500 bg-slate-800'}`}>
                      {p.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-medium text-slate-400">€{p.purchase_price.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-bold text-white">€{p.selling_price.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${p.margin_pct && p.margin_pct > 25 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.margin_pct}%</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`text-sm font-bold ${p.is_low_stock || p.quantity === 0 ? 'text-red-500' : 'text-white'}`}>{p.quantity}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`text-xs ${p.days_in_stock > 60 ? 'text-amber-400 font-bold underline' : 'text-slate-500'}`}>{p.days_in_stock} gg</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={() => optimizePrice(p)} className="p-1.5 bg-slate-800 text-emerald-400 hover:bg-emerald-400/10 rounded" title="AI Discount Tool"><TrendingUp className="w-4 h-4" /></button>
                       <button onClick={() => { setShowMovements(p); axios.get(`/api/warehouse/products/${p.id}/movements`).then(res => setMovementsData(res.data)); }} className="p-1.5 bg-slate-800 text-slate-400 hover:text-cyan-400 rounded" title="Cronologia"><History className="w-4 h-4" /></button>
                       <button onClick={() => setEditingProduct(p)} className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded"><Edit3 className="w-4 h-4" /></button>
                       <button onClick={async () => { if(confirm('Eliminare prodotto?')) { await axios.delete(`/api/warehouse/products/${p.id}`); fetchProducts(); } }} className="p-1.5 bg-slate-800 text-slate-400 hover:text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showMovements && (
         <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-8 overflow-y-auto animate-in slide-in-from-right duration-500">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold flex items-center gap-3 text-white">
                    <button onClick={() => setShowMovements(null)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
                     Cronologia {showMovements.sku}
                  </h2>
               </div>
               <div className="space-y-6">
                  {movementsData.map(m => (
                    <div key={m.id} className="relative pl-6 border-l border-slate-800 pb-6 last:pb-0">
                       <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-cyan-500" />
                       <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-[9px] uppercase font-bold text-cyan-400 px-1.5 py-0.5 bg-cyan-400/10 rounded">{m.type}</span>
                             <span className="text-[10px] text-slate-500">{new Date(m.at).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-slate-200">{m.notes}</div>
                          <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center text-[10px]">
                             <span className="text-slate-500 font-bold">Account: <span className="text-slate-300 font-normal">{m.by}</span></span>
                             {m.delta !== 0 && <span className={`font-bold ${m.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</span>}
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
               <button onClick={() => setShowMovements(null)} className="w-full mt-10 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                 <ArrowLeft className="w-4 h-4" /> Torna al Magazzino
               </button>
            </div>
         </div>
      )}

      {/* AI Suggestion Modal */}
      {aiSuggestion && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl w-full max-w-sm p-8 shadow-[0_0_50px_-12px_rgba(6,182,212,0.5)]">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-500/10 rounded-lg"><Sparkles className="w-5 h-5 text-cyan-400" /></div>
                <h2 className="text-xl font-bold text-white">Analisi Prezzo AI</h2>
             </div>
             
             <div className="space-y-4 mb-8">
                <div>
                   <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">PRODOTTO</p>
                   <p className="text-sm text-white font-medium">{aiSuggestion.product.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">ATTUALE</p>
                      <p className="text-lg text-slate-400 line-through">€{aiSuggestion.product.selling_price}</p>
                   </div>
                   <div>
                      <p className="text-[10px] text-cyan-500 uppercase font-bold mb-1">SUGGERITO</p>
                      <p className="text-2xl text-white font-black">€{aiSuggestion.recommendation.suggested_price}</p>
                   </div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                   <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">MOTIVAZIONE AI</p>
                   <p className="text-xs text-slate-300 leading-relaxed italic">"{aiSuggestion.recommendation.reason}"</p>
                   <div className="mt-3 flex items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400`}>
                        STRATEGIA: {aiSuggestion.recommendation.action?.toUpperCase()}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-400`}>
                        URGENZA: {aiSuggestion.recommendation.urgency?.toUpperCase()}
                      </span>
                   </div>
                </div>
             </div>

             <div className="flex flex-col gap-3">
                <button 
                  onClick={applyAiPrice}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-900/40 transition-all flex items-center justify-center gap-2"
                >
                  <CheckSquare className="w-4 h-4" /> Applica Nuovo Prezzo
                </button>
                <button 
                  onClick={() => setAiSuggestion(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3 rounded-xl transition-all"
                >
                  Annulla
                </button>
             </div>
          </div>
        </div>
      )}

      {(showAddModal || editingProduct) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-8 shadow-2xl relative">
             <button onClick={() => { setShowAddModal(false); setEditingProduct(null); }} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X /></button>
             <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-3">
               {editingProduct ? <Edit3 className="text-cyan-400" /> : <Plus className="text-cyan-400" />}
               {editingProduct ? `Modifica ${editingProduct.sku}` : "Nuovo Articolo"}
             </h2>
             <form onSubmit={editingProduct ? handleEditSave : handleAddProduct} className="space-y-4">
                {!editingProduct && <input type="text" placeholder="SKU (Codice Univoco)" required className="w-full bg-slate-800 p-3 rounded-xl outline-none border border-slate-700 text-sm text-white" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} />}
                <input type="text" placeholder="Nome Prodotto" required className="w-full bg-slate-800 p-3 rounded-xl outline-none border border-slate-700 text-sm text-white" value={editingProduct ? editingProduct.name : newProduct.name} onChange={e => editingProduct ? setEditingProduct({...editingProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})} />
                <input type="text" placeholder="Categoria" required className="w-full bg-slate-800 p-3 rounded-xl outline-none border border-slate-700 text-sm text-white" value={editingProduct ? editingProduct.category : newProduct.category} onChange={e => editingProduct ? setEditingProduct({...editingProduct, category: e.target.value}) : setNewProduct({...newProduct, category: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Acquisto (€)</label>
                      <input type="number" step="0.01" className="w-full bg-slate-800 p-3 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.purchase_price : newProduct.purchase_price} onChange={e => editingProduct ? setEditingProduct({...editingProduct, purchase_price: parseFloat(e.target.value)}) : setNewProduct({...newProduct, purchase_price: parseFloat(e.target.value)})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Vendita (€)</label>
                      <input type="number" step="0.01" className="w-full bg-slate-800 p-3 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.selling_price : newProduct.selling_price} onChange={e => editingProduct ? setEditingProduct({...editingProduct, selling_price: parseFloat(e.target.value)}) : setNewProduct({...newProduct, selling_price: parseFloat(e.target.value)})} />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Quantità</label>
                      <input type="number" className="w-full bg-slate-800 p-3 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.quantity : newProduct.quantity} onChange={e => editingProduct ? setEditingProduct({...editingProduct, quantity: parseInt(e.target.value)}) : setNewProduct({...newProduct, quantity: parseInt(e.target.value)})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Min Stock</label>
                      <input type="number" className="w-full bg-slate-800 p-3 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.reorder_point : newProduct.reorder_point} onChange={e => editingProduct ? setEditingProduct({...editingProduct, reorder_point: parseInt(e.target.value)}) : setNewProduct({...newProduct, reorder_point: parseInt(e.target.value)})} />
                   </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Posizione Scaffale</label>
                    <input type="text" placeholder="Es: A-12-3" className="w-full bg-slate-800 p-3 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.location : newProduct.location} onChange={e => editingProduct ? setEditingProduct({...editingProduct, location: e.target.value}) : setNewProduct({...newProduct, location: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                       <label className="text-[10px] text-slate-500 font-bold uppercase">Larg. (cm)</label>
                       <input type="number" step="0.1" className="w-full bg-slate-800 p-2 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.width : newProduct.width} onChange={e => editingProduct ? setEditingProduct({...editingProduct, width: parseFloat(e.target.value)}) : setNewProduct({...newProduct, width: parseFloat(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] text-slate-500 font-bold uppercase">Alt. (cm)</label>
                       <input type="number" step="0.1" className="w-full bg-slate-800 p-2 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.height : newProduct.height} onChange={e => editingProduct ? setEditingProduct({...editingProduct, height: parseFloat(e.target.value)}) : setNewProduct({...newProduct, height: parseFloat(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] text-slate-500 font-bold uppercase">Prof. (cm)</label>
                       <input type="number" step="0.1" className="w-full bg-slate-800 p-2 rounded-xl outline-none text-sm text-white border border-slate-700" value={editingProduct ? editingProduct.depth : newProduct.depth} onChange={e => editingProduct ? setEditingProduct({...editingProduct, depth: parseFloat(e.target.value)}) : setNewProduct({...newProduct, depth: parseFloat(e.target.value)})} />
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-2">
                       <Package className={`w-4 h-4 ${(editingProduct ? editingProduct.is_packaging : newProduct.is_packaging) ? 'text-purple-400' : 'text-slate-500'}`} />
                       <span className="text-xs font-bold text-slate-300 uppercase">Articolo di Imballaggio</span>
                    </div>
                    <button 
                       type="button" 
                       onClick={() => editingProduct ? setEditingProduct({...editingProduct, is_packaging: editingProduct.is_packaging ? 0 : 1}) : setNewProduct({...newProduct, is_packaging: newProduct.is_packaging ? 0 : 1})}
                       className={`w-10 h-5 rounded-full relative transition-colors ${ (editingProduct ? editingProduct.is_packaging : newProduct.is_packaging) ? 'bg-purple-600' : 'bg-slate-700' }`}
                    >
                       <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${ (editingProduct ? editingProduct.is_packaging : newProduct.is_packaging) ? 'left-6' : 'left-1' }`} />
                    </button>
                 </div>
                 <button type="submit" className="w-full bg-cyan-600 font-bold py-3 mt-4 rounded-xl text-white shadow-lg shadow-cyan-900/30">
                  {editingProduct ? "Salva Modifiche" : "Crea Prodotto"}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehousePage;
