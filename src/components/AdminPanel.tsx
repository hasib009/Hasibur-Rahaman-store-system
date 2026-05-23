import React, { useState, useEffect } from 'react';
import { User, Store, Product, Order, Message } from '../types.js';
import { Shield, Home, Users, Store as StoreIcon, ShoppingBag, Plus, Map, MapPin, Check, X, Phone, Edit, UploadCloud, Barcode, Search, ShoppingCart, Trash2, MessageCircle } from 'lucide-react';

interface AdminPanelProps {
  token: string | null;
  currentUser: User;
  activeTab?: 'stores' | 'users' | 'catalog' | 'orders' | 'delivery' | 'pos';
  onTabChange?: (tab: 'stores' | 'users' | 'catalog' | 'orders' | 'delivery' | 'pos') => void;
}

export default function AdminPanel({ token, currentUser, activeTab: propActiveTab, onTabChange }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [localActiveTab, setLocalActiveTab] = useState<'stores' | 'users' | 'catalog' | 'orders' | 'delivery' | 'pos'>(() => {
    if (currentUser.role === 'Store Staff' || currentUser.role === 'Store Owner') {
      return 'pos';
    }
    return 'stores';
  });

  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const [loading, setLoading] = useState(true);

  // Catalog Form / Edit State
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodBarcode, setProdBarcode] = useState('');

  // POS Selling Panel State
  const [posBarcodeIn, setPosBarcodeIn] = useState('');
  const [posSearch, setPosSearch] = useState('');
  const [posCart, setPosCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [posError, setPosError] = useState<string | null>(null);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);

  // Store Form State
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeAddr, setStoreAddr] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storePhoto, setStorePhoto] = useState('');
  const [storeFormError, setStoreFormError] = useState<string | null>(null);
  const [storeFormSuccess, setStoreFormSuccess] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Edit Store State
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  // Catalog Form State
  const [selectedCatalogStoreId, setSelectedCatalogStoreId] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodError, setProdError] = useState<string | null>(null);
  const [prodSuccess, setProdSuccess] = useState<string | null>(null);

  // Live order panel communication states
  const [chattingOrderId, setChattingOrderId] = useState<string | null>(null);
  const [activeOrderMessages, setActiveOrderMessages] = useState<Message[]>([]);
  const [adminChatText, setAdminChatText] = useState('');

  const syncOrderChatThread = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    try {
      const res = await fetch(`/api/chat/messages/${order.storeId}?customerId=${order.customerId}`);
      const data = await res.json();
      if (res.ok) {
        setActiveOrderMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Failed to sync order chat thread', e);
    }
  };

  useEffect(() => {
    if (!chattingOrderId) {
      setActiveOrderMessages([]);
      return;
    }
    syncOrderChatThread(chattingOrderId);
    const interval = setInterval(() => {
      syncOrderChatThread(chattingOrderId);
    }, 4500);
    return () => clearInterval(interval);
  }, [chattingOrderId, orders]);

  // Fetch telemetry logs
  const fetchAllData = async () => {
    try {
      // Fetch users
      const usersRes = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      if (usersRes.ok) setUsers(usersData.users || []);

      // Fetch stores
      const storesRes = await fetch('/api/stores');
      const storesData = await storesRes.json();
      if (storesRes.ok) {
        setStores(storesData.stores || []);
        if (storesData.stores?.length > 0 && !selectedCatalogStoreId) {
          setSelectedCatalogStoreId(storesData.stores[0].id);
        }
      }

      // Fetch products
      const pRes = await fetch('/api/products');
      const pData = await pRes.json();
      if (pRes.ok) setProducts(pData.products || []);

      // Fetch orders
      const oRes = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const oData = await oRes.json();
      if (oRes.ok) setOrders(oData.orders || []);

      // Fetch map locations
      const locRes = await fetch('/api/admin/locations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const locData = await locRes.json();
      if (locRes.ok) setLocations(locData.locations || []);

    } catch (e) {
      console.error('Failed to sync master admin telemetry', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token]);

  // S3 storagePut base64 simulated upload helper
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'store' | 'prod') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const response = await fetch('/api/admin/stores/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ base64Data: base64String, filename: file.name })
        });
        const uploadResult = await response.json();
        if (response.ok && uploadResult.success) {
          if (target === 'store') {
            setStorePhoto(uploadResult.url);
          } else {
            setProdImage(uploadResult.url);
          }
        }
      } catch (err) {
        console.error('Upload failed with buffer conversion', err);
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Create store slug & persist record
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreFormError(null);
    setStoreFormSuccess(null);

    if (!storeName || !storeDesc || !storeAddr || !storePhone) {
      setStoreFormError('Please specify all required properties.');
      return;
    }

    try {
      const method = editingStoreId ? 'PUT' : 'POST';
      const endpoint = editingStoreId ? `/api/admin/stores/${editingStoreId}` : '/api/admin/stores';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: storeName,
          description: storeDesc,
          address: storeAddr,
          phone: storePhone,
          photoUrl: storePhoto
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to persist store properties.');
      }

      setStoreFormSuccess(editingStoreId ? 'Store properties updated dynamically and saved permanently in database.' : 'New storefront provisioned with URL slug routing successfully.');
      setStoreName('');
      setStoreDesc('');
      setStoreAddr('');
      setStorePhone('');
      setStorePhoto('');
      setEditingStoreId(null);
      await fetchAllData();
    } catch (err: any) {
      setStoreFormError(err.message || 'Error executing action.');
    }
  };

  const startEditStore = (store: Store) => {
    setEditingStoreId(store.id);
    setStoreName(store.name);
    setStoreDesc(store.description);
    setStoreAddr(store.address);
    setStorePhone(store.phone);
    setStorePhoto(store.photoUrl);
    setStoreFormError(null);
    setStoreFormSuccess(null);
  };

  // User to Store workplace bounds mappings
  const handleMapUser = async (userId: string, storeId: string | null, role: string, approve?: boolean) => {
    try {
      const response = await fetch('/api/admin/users/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, storeId, role, approve })
      });
      if (response.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error('Failed user context bind maps', err);
    }
  };

  // Add / Edit catalog items
  const handleAddCatalogProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdError(null);
    setProdSuccess(null);

    const storeIdToUse = currentUser.role === 'Master Admin' ? selectedCatalogStoreId : currentUser.storeId;

    if (!storeIdToUse || !prodName || !prodPrice || !prodStock) {
      setProdError('Missing mandatory catalog options.');
      return;
    }

    try {
      const method = editingProductId ? 'PUT' : 'POST';
      const endpoint = editingProductId ? `/api/products/${editingProductId}` : '/api/products';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          storeId: storeIdToUse,
          name: prodName,
          description: prodDesc,
          price: Number(prodPrice),
          stock: Number(prodStock),
          imageUrl: prodImage,
          barcode: prodBarcode
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to compile catalog block.');
      }

      setProdSuccess(editingProductId ? 'Product details updated successfully!' : 'New product mapped to store catalog at strict base price.');
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdStock('');
      setProdImage('');
      setProdBarcode('');
      setEditingProductId(null);
      await fetchAllData();
    } catch (err: any) {
      setProdError(err.message || 'Error updating catalogue.');
    }
  };

  const startEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setSelectedCatalogStoreId(p.storeId);
    setProdName(p.name);
    setProdDesc(p.description || '');
    setProdPrice(String(p.price));
    setProdStock(String(p.stock));
    setProdImage(p.imageUrl || '');
    setProdBarcode(p.barcode || '');
    setProdError(null);
    setProdSuccess(null);
    // Scroll smoothly to input editor if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Are you absolutely sure you want to remove this catalog product permanently?')) return;
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setProdSuccess('Product deleted successfully from inventory.');
        await fetchAllData();
      } else {
        setProdError(data.error || 'Product delete call rejected.');
      }
    } catch (err: any) {
      setProdError(err.message || 'Error deleting product.');
    }
  };

  // ========== POS SELLING PANEL ACTIONS & HANDLERS ==========
  const addPosItem = (product: Product, qty: number = 1) => {
    setPosCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + qty);
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: nextQty } : item);
      }
      return [...prev, { product, quantity: Math.min(product.stock, qty) }];
    });
  };

  const updatePosCartQuantity = (productId: string, delta: number) => {
    setPosCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const nextQty = Math.max(0, Math.min(item.product.stock, item.quantity + delta));
        return { ...item, quantity: nextQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removePosCartItem = (productId: string) => {
    setPosCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleSendAdminChatMessage = async (e: React.FormEvent, order: Order) => {
    e.preventDefault();
    if (!adminChatText.trim()) return;

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: order.storeId,
          senderId: order.customerId,
          senderName: `${currentUser.username} (${currentUser.role})`,
          senderRole: currentUser.role,
          text: adminChatText
        })
      });

      if (response.ok) {
        setAdminChatText('');
        syncOrderChatThread(order.id);
      }
    } catch (err) {
      console.error('Core send message failed', err);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPosError(null);
    setPosSuccess(null);
    
    const code = posBarcodeIn.trim();
    if (!code) return;

    const storeIdToUse = currentUser.role === 'Master Admin' ? selectedCatalogStoreId : currentUser.storeId;
    if (!storeIdToUse) {
      setPosError('No active storefront bound to your staff account.');
      return;
    }

    const matched = products.find(p => p.storeId === storeIdToUse && p.barcode === code);
    if (matched) {
      if (matched.stock <= 0) {
        setPosError(`"${matched.name}" matches barcode [${code}] but is completely out of stock!`);
        return;
      }
      addPosItem(matched, 1);
      setPosSuccess(`Successfully added scanned item: "${matched.name}"`);
      setPosBarcodeIn('');
    } else {
      setPosError(`Unassigned Barcode: No product with barcode "${code}" exists for this store.`);
    }
  };

  const handlePosCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosError(null);
    setPosSuccess(null);

    if (posCart.length === 0) {
      setPosError('The POS sell basket is empty.');
      return;
    }

    const storeIdToUse = currentUser.role === 'Master Admin' ? selectedCatalogStoreId : currentUser.storeId;
    if (!storeIdToUse) {
      setPosError('No storefront selected.');
      return;
    }

    const items = posCart.map(it => ({
      productId: it.product.id,
      name: it.product.name,
      price: it.product.price,
      quantity: it.quantity
    }));

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          storeId: storeIdToUse,
          customerId: 'pos-' + Date.now(),
          customerName: 'Walk-in Customer (POS)',
          customerPhone: 'Walk-in',
          type: 'Pickup',
          timeSlot: 'Instant Sell (Completed)',
          items
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Enterprise queue error.');
      }

      // Automatically transition order to 'Completed' status
      if (data.order && data.order.id) {
        const statusRes = await fetch(`/api/orders/${data.order.id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'Completed' })
        });
        if (!statusRes.ok) {
          console.warn('Failed automated finality status.');
        }
      }

      setPosSuccess('POS Sale Completed! Digital receipt generated, stock deduction updated.');
      setPosCart([]);
      setPosSearch('');
      await fetchAllData();
    } catch (err: any) {
      setPosError(err.message || 'Transaction error.');
    }
  };

  // Moderate Store Owner signup requests
  const handleApproveOwner = async (userId: string, approve: boolean) => {
    // Role Store Owner approval toggles
    await handleMapUser(userId, undefined, 'Store Owner', approve);
  };

  // Handle Order status switches
  const handleOrderStatusOverride = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  // Filter list of users needing Store Owner signups approval
  const pendingOwners = users.filter(u => u.role === 'Store Owner' && !u.approved);

  return (
    <div className="space-y-6">
      {/* Absolute Admin Control Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-yellow-500 flex items-center justify-center text-slate-950 font-black shadow-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-white text-lg">
              Master Admin Control Suite
            </h3>
            <p className="text-xs text-slate-400">
              Generate independent layouts • Bind staff workplaces • Update map telemetry and catalog assets.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 font-mono font-bold uppercase">Workplace Scope Locked Control</p>
          <p className="text-xs font-semibold text-yellow-500 font-mono uppercase">{currentUser.role === 'Master Admin' ? 'Master Authority Area' : 'Local Workspace Area'}</p>
        </div>
      </div>

      {/* Dynamic contents switcher */}
      <div className="space-y-6">
        {/* ========== POS SELLING PANEL TAB ========== */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
            
            {/* Left columns: Scanners & Name query searches */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Box 1: Simulated Laser Barcode Scanner */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="font-sans font-bold text-white text-sm uppercase flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-yellow-500" />
                    Simulated Laser Barcode Scanner
                  </h4>
                  <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/45 px-2 py-0.5 rounded border border-emerald-800/30">
                    SCANNER READY
                  </span>
                </div>

                {posError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs p-3.5 rounded-lg font-mono">
                    ⚠ {posError}
                  </div>
                )}
                {posSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs p-3.5 rounded-lg font-mono">
                    ✓ {posSuccess}
                  </div>
                )}

                <form onSubmit={handleBarcodeSubmit} className="space-y-3">
                  <p className="text-xs text-slate-400 font-mono">
                    To simulate a physical barcode scan, type a barcode below or tap any of the quick-scan badges.
                  </p>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type barcode (e.g. 800111 or 800222) or scan input..."
                      value={posBarcodeIn}
                      onChange={(e) => setPosBarcodeIn(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-yellow-500 rounded-lg h-12 px-4 text-xs text-slate-200 outline-none font-mono"
                    />
                    <button
                      type="submit"
                      className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 text-xs px-5 h-12 rounded-lg font-bold uppercase shrink-0 transition-all cursor-pointer"
                    >
                      Scan Barcode
                    </button>
                  </div>
                </form>

                {/* Quick Simulation Help bar */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-500 font-mono uppercase block mb-1 font-sans">Simulated Barcodes for this Outlet:</span>
                  <div className="flex flex-wrap gap-2">
                    {products
                      .filter(p => currentUser.role === 'Master Admin' || p.storeId === currentUser.storeId)
                      .filter(p => p.barcode)
                      .slice(0, 6)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setPosBarcodeIn(p.barcode || '');
                            // Trigger immediately
                            setTimeout(() => {
                              setPosError(null);
                              setPosSuccess(null);
                              if (p.stock <= 0) {
                                setPosError(`"${p.name}" is completely out of stock!`);
                                return;
                              }
                              addPosItem(p, 1);
                              setPosSuccess(`Scanned Quick-Code "${p.barcode}" -> added "${p.name}" to tray.`);
                              setPosBarcodeIn('');
                            }, 50);
                          }}
                          className="bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-yellow-500/50 p-2 rounded-lg text-left text-xs transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div>
                            <p className="font-bold text-slate-300 leading-none">{p.name}</p>
                            <span className="font-mono text-[9px] text-yellow-500">Code: {p.barcode}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Box 2: Search catalog by name */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h4 className="font-sans font-bold text-white text-sm uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Search className="w-5 h-5 text-yellow-500" />
                  No Barcode? Search catalog by name
                </h4>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Search products by typing name here... (case-insensitive)"
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-yellow-500 rounded-lg h-11 px-4 text-xs text-slate-200 outline-none"
                  />

                  {/* Autocomplete or filtered matching products list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {products
                      .filter(p => currentUser.role === 'Master Admin' || p.storeId === currentUser.storeId)
                      .filter(p => !posSearch ? true : p.name.toLowerCase().includes(posSearch.toLowerCase()))
                      .map(p => (
                        <div key={p.id} className="bg-slate-950 border border-slate-850 p-2 rounded-xl flex items-center justify-between gap-3 text-left">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={p.imageUrl} alt={p.name} className="w-10 h-10 object-cover rounded bg-slate-900" />
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-bold text-white truncate leading-none">{p.name}</p>
                              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Price: €{p.price.toFixed(2)} • Stock: {p.stock}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              if (p.stock <= 0) {
                                setPosError(`"${p.name}" is completely out of stock!`);
                                return;
                              }
                              addPosItem(p, 1);
                              setPosSuccess(`Added matching item: "${p.name}"`);
                            }}
                            className="bg-[#FFFF00] hover:bg-yellow-400 text-slate-950 font-black text-[10px] py-1.5 px-3 rounded uppercase cursor-pointer transition-all"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: Cart tray & complete sale */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 h-fit sticky top-20">
                <h4 className="font-sans font-bold text-white text-sm uppercase flex items-center justify-between border-b border-slate-800 pb-3 font-display">
                  <span>🛍 POS Checkout basket</span>
                  <span className="font-mono text-xs bg-slate-950 px-2.5 py-0.5 rounded text-yellow-500 border border-white/5 font-bold">
                    {posCart.reduce((sum, item) => sum + item.quantity, 0)} Units
                  </span>
                </h4>

                {posCart.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 italic">
                    POS basket is empty.<br />Scan a barcode or click a product to initialize sale transaction.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {posCart.map(row => (
                        <div key={row.product.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between gap-3 text-left">
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-bold text-white truncate">{row.product.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">€{row.product.price.toFixed(2)} / unit</p>
                            <p className="text-[11px] font-mono font-bold text-yellow-500">€{(row.product.price * row.quantity).toFixed(2)}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border">
                              <button
                                onClick={() => updatePosCartQuantity(row.product.id, -1)}
                                className="w-5 h-5 bg-slate-950 hover:bg-slate-800 rounded text-slate-400 font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-mono text-white font-bold px-1 min-w-[15px] text-center">
                                {row.quantity}
                              </span>
                              <button
                                onClick={() => updatePosCartQuantity(row.product.id, 1)}
                                className="w-5 h-5 bg-slate-950 hover:bg-slate-800 rounded text-slate-400 font-bold flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() => removePosCartItem(row.product.id)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-3 space-y-2">
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <p>Subtotal Cost:</p>
                        <p className="font-mono text-slate-300">
                          €{posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <p>Sales Tax (V.A.T. 22% inclusive):</p>
                        <p className="font-mono text-slate-300">
                          €{(posCart.reduce((sum, idx) => sum + idx.product.price * idx.quantity, 0) * 0.22).toFixed(2)}
                        </p>
                      </div>
                      <div className="border-t border-slate-850 pt-2 flex justify-between items-center">
                        <h4 className="text-xs font-bold text-white uppercase">Gross Total Payable:</h4>
                        <span className="text-md font-mono font-black text-yellow-500">
                          €{posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handlePosCheckout}>
                      <button
                        type="submit"
                        className="w-full bg-[#FFFF00] hover:bg-yellow-400 text-slate-950 font-black h-12 rounded-xl text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Finalize Walk-in Sale (Receipt)
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}

        {/* STORES PROVISIONING */}
        {activeTab === 'stores' && currentUser.role === 'Master Admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
            {/* Create form */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
              <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-yellow-500" />
                {editingStoreId ? 'Modify Store Properties' : 'Provision Flagship Store'}
              </h4>

              {storeFormError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs p-3.5 rounded-lg mb-4 font-mono">
                  {storeFormError}
                </div>
              )}
              {storeFormSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs p-3.5 rounded-lg mb-4 font-mono">
                  {storeFormSuccess}
                </div>
              )}

              <form onSubmit={handleCreateStore} className="space-y-4">
                <div className="space-y-1 block">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Shop Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rome Central Café"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                  />
                </div>

                <div className="space-y-1 block">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Description Detail *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Charming coffee and pastry spot..."
                    value={storeDesc}
                    onChange={(e) => setStoreDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                  />
                </div>

                <div className="space-y-1 block">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Exact Address * (Integrated Maps Link)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Piazza Navona 4, Rome"
                    value={storeAddr}
                    onChange={(e) => setStoreAddr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                  />
                </div>

                <div className="space-y-1 block">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Store Contact Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +39 06 123456"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                  />
                </div>

                <div className="space-y-1 block">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Shop Photo (S3 StoragePut buffer)*</span>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="text"
                      placeholder="Custom link or upload"
                      value={storePhoto}
                      onChange={(e) => setStorePhoto(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                    />
                    <label className="bg-slate-800 hover:bg-slate-700 h-10 px-3.5 flex items-center justify-center shrink-0 border border-slate-700 rounded-lg text-xs cursor-pointer text-slate-300">
                      <UploadCloud className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'store')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold h-10 rounded-lg text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer"
                >
                  {uploadingImage ? 'Buffer Uploading...' : (editingStoreId ? 'Apply New Changes' : 'Initialize Active Store')}
                </button>

                {editingStoreId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStoreId(null);
                      setStoreName('');
                      setStoreDesc('');
                      setStoreAddr('');
                      setStorePhone('');
                      setStorePhoto('');
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-755 text-slate-300 h-10 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel Editing
                  </button>
                )}
              </form>
            </div>

            {/* Configured stores grid list */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3 flex items-center gap-2">
                <StoreIcon className="w-4 h-4 text-yellow-500" />
                Active Stores List ({stores.length})
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stores.map((s) => (
                  <div key={s.id} className="bg-slate-950/80 border border-slate-850 rounded-xl overflow-hidden shadow-md flex flex-col justify-between">
                    <div className="aspect-video w-full relative bg-slate-900">
                      <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur px-2.5 py-0.5 rounded text-[10px] font-mono font-bold text-yellow-500 border border-white/5">
                        {`/store/${s.slug}`}
                      </div>
                    </div>
                    <div className="p-4 space-y-2 text-left">
                      <h5 className="font-sans font-black text-white text-md tracking-tight leading-none">{s.name}</h5>
                      <p className="subtitle-desc text-slate-400 text-xs truncate leading-normal">{s.description}</p>
                      
                      <div className="space-y-1 text-[11px] font-mono text-slate-400 mt-2">
                        <p className="flex items-center gap-1.5 leading-normal">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`} target="_blank" rel="noreferrer" className="text-yellow-500 underline truncate hover:text-yellow-400">
                            {s.address}
                          </a>
                        </p>
                        <p className="flex items-center gap-1.5 leading-normal">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {s.phone}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900/40 border-t border-slate-850 flex justify-end">
                      <button
                        onClick={() => startEditStore(s)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3 text-yellow-500" />
                        Modify Properties
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WORKPLACE STAFF ACCESS CONTROLS MATRIX */}
        {activeTab === 'users' && currentUser.role === 'Master Admin' && (
          <div className="space-y-6 text-left">
            {/* Owner Signup Approval Column */}
            {pendingOwners.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3 flex items-center justify-between">
                  <span>🔑 SIGNUP REQUESTS: STORE OWNERS ({pendingOwners.length})</span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-slate-950 px-2 py-0.5 border border-white/5 rounded">Needs Approval</span>
                </h4>

                <div className="space-y-3">
                  {pendingOwners.map((p) => (
                    <div key={p.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img src={p.avatar} alt={p.username} className="w-10 h-10 rounded-full bg-slate-800 border" />
                        <div>
                          <p className="font-bold text-white">{p.username}</p>
                          <p className="text-xs text-slate-400">{p.email} • Tel: {p.phone}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveOwner(p.id, false)}
                          className="bg-red-950 text-red-400 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-900/40 transition-colors"
                        >
                          Deny Link
                        </button>
                        <button
                          onClick={() => handleApproveOwner(p.id, true)}
                          className="bg-[#FFFF00] hover:bg-yellow-400 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          Approve Owner
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System user mapped boundaries list */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3">
                Staff Assignment Matrix & Workplace Bindings
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Staff Profile</th>
                      <th className="py-2.5 px-3">Role Type</th>
                      <th className="py-2.5 px-3">Assigned Store</th>
                      <th className="py-2.5 px-3 text-right">Context Override Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 pb-2">
                    {users.map((u) => {
                      if (u.role === 'Master Admin') return null; // skip overlord account
                      return (
                        <tr key={u.id} className="hover:bg-slate-950/20">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
                              <div>
                                <p className="font-bold text-slate-100">{u.username}</p>
                                <p className="text-[10px] text-slate-500 font-mono tracking-tighter">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-mono italic">
                            {u.role}
                          </td>
                          <td className="py-3 px-3">
                            {u.storeId ? (
                              <span className="bg-slate-950 text-yellow-500 border border-yellow-500/10 font-bold px-2 py-1 rounded text-[10px] font-mono">
                                {stores.find(s => s.id === u.storeId)?.name || u.storeId}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">No storefront bound</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Workplace selector dropdown */}
                              <select
                                value={u.storeId || ''}
                                onChange={(e) => handleMapUser(u.id, e.target.value || null, u.role)}
                                className="bg-slate-950 border border-slate-850 rounded text-[10px] h-8 px-2.5 outline-none font-sans text-slate-300"
                              >
                                <option value="">[Not Assigned]</option>
                                {stores.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>

                              {/* Role selector dropdown */}
                              <select
                                value={u.role}
                                onChange={(e) => handleMapUser(u.id, u.storeId || null, e.target.value)}
                                className="bg-slate-950 border border-slate-850 rounded text-[10px] h-8 px-2.5 outline-none font-sans text-slate-300"
                              >
                                <option value="Customer">Customer</option>
                                <option value="Store Staff">Store Staff</option>
                                <option value="Admin">Local Admin</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CATALOG CRUD AND BASE PRICES */}
        {activeTab === 'catalog' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
            {/* Catalog Add / Edit form */}
            {(currentUser.role === 'Master Admin' || currentUser.role === 'Store Owner' || currentUser.role === 'Admin' || currentUser.role === 'Store Staff') && (
              <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 h-fit shadow-xl">
                <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-yellow-500" />
                  {editingProductId ? 'Modify Catalogue Product' : 'Catalogue Mapped Product'}
                </h4>

                {prodError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs p-3.5 rounded-lg mb-4 font-mono">
                    {prodError}
                  </div>
                )}
                {prodSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs p-3.5 rounded-lg mb-4 font-mono">
                    {prodSuccess}
                  </div>
                )}

                <form onSubmit={handleAddCatalogProduct} className="space-y-4">
                  <div className="space-y-1 block">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Target Store Catalog Outlet *</label>
                    {currentUser.role === 'Master Admin' ? (
                      <select
                        value={selectedCatalogStoreId}
                        onChange={(e) => setSelectedCatalogStoreId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="">[Select active store]</option>
                        {stores.map((s) => (
                           <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="bg-slate-950 border border-slate-850 p-2.5 px-3 text-xs text-slate-300 rounded-lg font-bold font-mono">
                        {stores.find(s => s.id === currentUser.storeId)?.name || currentUser.storeId}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 block">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Product Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Classic Tiramisu"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                    />
                  </div>

                  <div className="space-y-1 block">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Unique Barcode / Universal UPC *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 800111 or 900333"
                      value={prodBarcode}
                      onChange={(e) => setProdBarcode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1 block">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Description Detail</label>
                    <input
                      type="text"
                      placeholder="e.g. Traditional sheep milk ricotta pastries..."
                      value={prodDesc}
                      onChange={(e) => setProdDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 block text-left">
                      <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Base Price (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 5.50"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1 block text-left">
                      <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Stock Units *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 50"
                        value={prodStock}
                        onChange={(e) => setProdStock(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 block">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Product Photo (S3 storagePut buffer)</span>
                    <div className="flex gap-2 items-center mt-1">
                      <input
                        type="text"
                        placeholder="Custom link or upload"
                        value={prodImage}
                        onChange={(e) => setProdImage(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg h-10 px-3 text-xs text-slate-200 outline-none focus:border-yellow-500"
                      />
                      <label className="bg-slate-800 hover:bg-slate-700 h-10 px-3.5 flex items-center justify-center shrink-0 border border-slate-700 rounded-lg text-xs cursor-pointer text-slate-300">
                        <UploadCloud className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'prod')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingImage}
                    className="w-full bg-[#FFFF00] hover:bg-yellow-400 text-slate-950 font-bold h-10 rounded-lg text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer"
                  >
                    {uploadingImage ? 'Uploading image...' : (editingProductId ? 'Apply Product Update' : 'Map Catalog Item')}
                  </button>

                  {editingProductId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProductId(null);
                        setProdName('');
                        setProdDesc('');
                        setProdPrice('');
                        setProdStock('');
                        setProdImage('');
                        setProdBarcode('');
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 h-10 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel Editing
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* Catalog inventory list */}
            <div className={`graphics-view bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 ${(currentUser.role === 'Master Admin' || currentUser.role === 'Store Owner' || currentUser.role === 'Admin' || currentUser.role === 'Store Staff') ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3">
                Live Enterprise Stock Catalog
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.filter(p => currentUser.role === 'Master Admin' || p.storeId === currentUser.storeId).map((p) => (
                  <div key={p.id} className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={p.imageUrl} alt={p.name} className="w-14 h-14 object-cover rounded-lg bg-slate-900 shrink-0 border border-white/5" />
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold text-slate-200 truncate leading-normal">{p.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">{stores.find(s => s.id === p.storeId)?.name || 'Store Catalog'}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-[11px]">
                          <p className="text-yellow-500 font-bold">€{p.price.toFixed(2)}</p>
                          <p className={`${p.stock < 5 ? 'text-red-400 font-bold animate-pulse' : 'text-slate-400'}`}>Stock: {p.stock} pcs</p>
                          {p.barcode && (
                            <span className="bg-slate-900 text-yellow-500 px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-800">
                              BC: {p.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => startEditProduct(p)}
                        className="p-1 px-2 bg-slate-900 hover:bg-slate-800 text-yellow-500 rounded text-[10px] uppercase font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Edit Item"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1 px-2 bg-slate-900 hover:bg-slate-800 text-red-400 rounded text-[10px] uppercase font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE OUTLET ORDERS PANEL */}
        {activeTab === 'orders' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 text-left">
            <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>📋 ACTIVE ORDERS CONTROLLER</span>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider bg-slate-950 border border-white/5 px-2 py-0.5 rounded">Real-time update stream</span>
            </h4>

            {orders.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center italic">No active order records listed in workspace context.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {orders.map((o) => (
                  <div key={o.id} className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-4 shadow-sm transition-all">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-yellow-500 font-bold">#{o.id.slice(-6).toUpperCase()}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            o.status === 'Pending' ? 'bg-amber-900/35 text-amber-400 border border-amber-800/40' :
                            o.status === 'Confirmed' ? 'bg-sky-950 text-sky-400 border border-sky-850' :
                            o.status === 'Preparing' ? 'bg-indigo-950 text-indigo-400 border border-indigo-850' :
                            o.status === 'Ready' ? 'bg-purple-950 text-purple-400 border border-purple-850' :
                            o.status === 'Completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-850' :
                            'bg-red-950 text-red-400 border border-red-850'
                          }`}>
                            {o.status}
                          </span>
                          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-indigo-300 font-mono">
                            {o.type} ({o.timeSlot})
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-200">Customer: {o.customerName} ({o.customerPhone})</p>
                          {o.type === 'Delivery' && <p className="text-[11px] text-slate-400">Address: {o.deliveryAddress}</p>}
                        </div>

                        <div className="border-t border-slate-900 pt-2 space-y-1">
                          {o.items.map((item, idx) => (
                            <p key={idx} className="text-[11px] text-slate-300 font-mono">
                              {item.name} x {item.quantity} (unit price: €{item.price.toFixed(2)})
                            </p>
                          ))}
                          <p className="text-xs font-bold text-yellow-500 font-mono mt-1">Total Price: €{o.totalPrice.toFixed(2)}</p>
                        </div>

                        {/* delivery confirmation profile */}
                        {o.deliveryConfirmationImage && (
                          <div className="pt-2">
                            <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">Delivery Drop Photo Profile</span>
                            <img src={o.deliveryConfirmationImage} alt="Delivery Drop Confirmation" className="w-16 h-16 object-cover bg-slate-900 rounded border border-white/5" />
                          </div>
                        )}
                      </div>

                      <div className="text-left lg:text-right shrink-0">
                        <span className="text-[10px] text-slate-500 font-mono block mb-1.5 uppercase">Update Status Workflow</span>
                        <div className="flex gap-1 flex-wrap justify-start lg:justify-end max-w-sm">
                          {(['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => handleOrderStatusOverride(o.id, status)}
                              className={`px-2.5 py-1 text-[9px] font-mono font-bold border rounded transition-all cursor-pointer ${
                                o.status === status
                                  ? 'bg-[#FFFF00] text-slate-950 border-yellow-500 font-bold shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border-slate-850 hover:border-slate-500 hover:text-white'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Chat communication area */}
                    <div className="border-t border-slate-900/60 pt-3">
                      <button
                        onClick={() => setChattingOrderId(chattingOrderId === o.id ? null : o.id)}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase transition-all py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 text-yellow-500 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {chattingOrderId === o.id ? 'Close dialogue communication log' : `Send message / Communicate with customer ${o.customerName}`}
                      </button>

                      {chattingOrderId === o.id && (
                        <div className="mt-3 bg-slate-950/80 border border-slate-850 rounded-xl p-3.5 space-y-3">
                          <p className="text-[10px] text-slate-400 font-mono tracking-tight">
                            Communication thread mapped session customer reference: <span className="text-yellow-500 font-bold font-mono">{o.customerId}</span>
                          </p>
                          <div className="max-h-[165px] overflow-y-auto space-y-2 pr-1 text-xs">
                            {activeOrderMessages.length === 0 ? (
                              <p className="text-slate-600 italic text-center py-4 text-xs">No prior conversation history recorded inside workspace. Try sending a message below.</p>
                            ) : (
                              activeOrderMessages.map((msg) => {
                                const isCustomer = msg.senderRole === 'Customer' || msg.senderRole === 'Guest';
                                return (
                                  <div key={msg.id} className={`flex flex-col max-w-[85%] ${!isCustomer ? 'ml-auto text-right items-end' : 'mr-auto text-left items-start'}`}>
                                    <span className="text-[8px] text-slate-550 font-mono font-bold uppercase">{msg.senderName} ({msg.senderRole})</span>
                                    <div className={`p-2.5 rounded-xl mt-0.5 leading-snug ${!isCustomer ? 'bg-[#FFFF00] text-slate-950 font-semibold rounded-tr-xs shadow-xs' : 'bg-slate-900 border border-slate-850/50 text-slate-200 rounded-tl-xs'}`}>
                                      {msg.text}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <form onSubmit={(e) => handleSendAdminChatMessage(e, o)} className="flex gap-2 pt-1 border-t border-slate-900">
                            <input
                              type="text"
                              required
                              placeholder={`Type chat message logs for ${o.customerName}...`}
                              value={adminChatText}
                              onChange={(e) => setAdminChatText(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg h-9 px-3 text-xs text-slate-250 outline-none focus:border-yellow-500 font-sans"
                            />
                            <button type="submit" className="bg-[#FFFF00] hover:bg-yellow-400 text-slate-950 font-black text-xs px-4 rounded-lg cursor-pointer transition-colors shrink-0">
                              Transmit Message
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DOCK MAP LOCATION SERVICES */}
        {activeTab === 'delivery' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-left space-y-4">
            <h4 className="font-sans font-bold text-white text-md border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>📍 GPS MAP TELEMETRY DISPATCH</span>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-slate-950 border border-white/5 px-2 py-0.5 rounded">Locations Hub</span>
            </h4>

            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Physical branch addresses and customer shipping drop-off coordinates are logged strictly in the map directory below:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map((loc, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-start gap-3 shadow-md">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    loc.type === 'Store Outlet' ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/20' : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    <MapPin className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="min-w-0 text-xs">
                    <p className="font-bold text-slate-200">{loc.label}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">{loc.type}</p>
                    <p className="text-slate-400 font-mono mt-2 leading-tight">
                      Address: <a href={`https://maps.google.com/?q=${encodeURIComponent(loc.address)}`} target="_blank" rel="noreferrer" className="text-yellow-500 underline truncate hover:text-yellow-400">
                        {loc.address}
                      </a>
                    </p>
                    {loc.phone && <p className="text-slate-500 font-mono mt-1">Tel: {loc.phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
