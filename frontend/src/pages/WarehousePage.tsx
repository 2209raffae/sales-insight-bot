import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Package, Plus, Upload, Search, AlertTriangle, 
  TrendingUp, FileText, RefreshCw, Edit3, CheckCircle,
  BrainCircuit, Sparkles, DollarSign
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
}

const WarehousePage: React.FC = () => {
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiStrategy, setAiStrategy] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'low-stock'>('all');

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/warehouse/products');
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiStrategy = async () => {
    try {
      setLoadingStrategy(true);
      const res = await axios.get('/api/warehouse/ai/strategy');
      setAiStrategy(res.data.strategy);
    } catch (err) {
      console.error("Error fetching AI strategy:", err);
    } finally {
      setLoadingStrategy(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchAiStrategy();
  }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      await axios.post('/api/warehouse/upload', formData);
      setShowUploadModal(false);
      fetchProducts();
      fetchAiStrategy();
    } catch (err) {
      alert("Errore durante il caricamento CSV.");
    } finally {
      setUploading(false);
    }
  };

  const generateDescription = async (id: number) => {
    try {
      const res = await axios.post(`/api/warehouse/ai/generate-description/${id}`);
      alert(res.data.description);
    } catch (err) {
      console.error(err);
    }
  };

  const optimizePrice = async (id: number) => {
    try {
      const res = await axios.get(`/api/warehouse/ai/optimize-price/${id}`);
      const { suggested_price, action, reason } = res.data;
      alert(`Consiglio AI: ${action.toUpperCase()}\nNuovo Prezzo: ${suggested_price}€\nMotivazione: ${reason}`);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'available') return matchesSearch && p.status === 'Disponibile';
    if (activeTab === 'low-stock') return matchesSearch && p.quantity < 3;
    return matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-cyan-400" />
            Warehouse Intelligence
          </h1>
          <p className="text-slate-400 mt-1">Gestione universale dello stock e analisi predittiva AI</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all font-medium"
          >
            <Upload className="w-4 h-4" />
            Importa CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all font-medium shadow-lg shadow-cyan-900/20">
            <Plus className="w-4 h-4" />
            Nuovo Prodotto
          </button>
        </div>
      </div>

      {/* AI Strategy Banner */}
      <div className="bg-slate-900/50 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <BrainCircuit className="w-24 h-24 text-cyan-400" />
        </div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
            <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white uppercase tracking-wider">AI Strategic Analysis</h3>
              <button onClick={fetchAiStrategy} className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${loadingStrategy ? 'animate-spin' : ''}`} />
                Aggiorna Analisi
              </button>
            </div>
            {loadingStrategy ? (
              <div className="h-20 flex items-center justify-center">
                <div className="animate-pulse text-slate-500">L'Agente sta analizzando stock e lead...</div>
              </div>
            ) : (
              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                {aiStrategy || "Nessun dato disponibile. Carica lo stock e i lead per generare una strategia."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Totale Stock', value: products.length, icon: Package, color: 'text-blue-400' },
          { label: 'Valore Acquisto', value: `${products.reduce((acc, p) => acc + (p.purchase_price * p.quantity), 0).toLocaleString()}€`, icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Disponibili', value: products.filter(p => p.status === 'Disponibile').length, icon: CheckCircle, color: 'text-cyan-400' },
          { label: 'In Giacenza >60gg', value: products.filter(p => p.days_in_stock > 60).length, icon: AlertTriangle, color: 'text-amber-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm font-medium">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white mt-1">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters & Grid */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-800/50 p-1 rounded-lg">
            {(['all', 'available', 'low-stock'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'all' ? 'Tutti' : tab === 'available' ? 'Disponibili' : 'Sottoscorta'}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Cerca per Nome o SKU..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800/30 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Prodotto</th>
                <th className="px-6 py-4 font-semibold text-center">Stato</th>
                <th className="px-6 py-4 font-semibold text-center">Quantità</th>
                <th className="px-6 py-4 font-semibold text-right">Prezzo Vendita</th>
                <th className="px-6 py-4 font-semibold text-center">Giacenza</th>
                <th className="px-6 py-4 font-semibold text-right">Azioni AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({length: 5}).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8 h-12 bg-slate-800/10 mb-2"></td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-500 italic">
                    Nessun prodotto trovato nel magazzino.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white group-hover:text-cyan-400 transition-colors">{product.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{product.sku} | {product.category}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        product.status === 'Disponibile' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        product.status === 'Prenotato' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                        'bg-slate-800 border-slate-700 text-slate-500'
                      }`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-white">{product.quantity}</td>
                    <td className="px-6 py-4 text-right font-semibold text-white">{product.selling_price.toLocaleString()}€</td>
                    <td className="px-6 py-4 text-center">
                      <div className={`text-sm font-medium ${product.days_in_stock > 60 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {product.days_in_stock} gg
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => generateDescription(product.id)}
                          title="Genera Descrizione AI"
                          className="p-2 bg-slate-800 hover:bg-cyan-600 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => optimizePrice(product.id)}
                          title="Ottimizza Prezzo AI"
                          className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Caricamento Massivo Magazzino</h2>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-cyan-500/50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".csv"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  {uploadFile ? uploadFile.name : 'Trascina qui il file CSV o clicca per selezionare'}
                </p>
              </div>
              <div className="text-xs text-slate-500 bg-slate-800/50 p-3 rounded-lg leading-relaxed">
                <strong>Requisiti CSV:</strong> Deve includere le colonne <code className="text-cyan-400">sku</code> e <code className="text-cyan-400">name</code>. Altre colonne verranno caricate automaticamente come metadati.
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-all"
                >
                  Annulla
                </button>
                <button 
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="flex-1 py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Caricamento...' : 'Conferma'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehousePage;
