import React, { useState, useEffect } from 'react';

interface Product {
  id: number;
  category: string;
  description: string;
  status: string;
}

interface MarketingAssets {
  instagram_caption: string;
  seo_meta: string;
}

export default function App() {
  // Core States
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(true);

  // Marketing States
  const [marketing, setMarketing] = useState<MarketingAssets | null>(null);
  const [generatingMarketing, setGeneratingMarketing] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // Bulk States
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ processed: number } | null>(null);
  const [selectedFileCount, setSelectedFileCount] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setFetchingProducts(true);
    try {
      const res = await fetch('http://localhost:8000/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setFetchingProducts(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Reset UI states
    setPreview(null);
    setCategory("");
    setDescription("");
    setSavedId(null);
    setMarketing(null);
    setBulkResult(null);

    // ---- OPTION 2: SINGLE FILE DEEP-DIVE ----
    if (files.length === 1) {
      setIsBulkMode(false);
      setPreview(URL.createObjectURL(files[0]));
      setLoading(true);

      const formData = new FormData();
      formData.append('file', files[0]);

      try {
        const res = await fetch('http://localhost:8000/analyze-product', {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        setCategory(result.category);
        setDescription(result.description);
      } catch (err) {
        console.error("API error:", err);
        setCategory("Error");
        setDescription("Failed to connect to the backend.");
      } finally {
        setLoading(false);
      }
    } 
    // ---- OPTION 3: BULK PROCESSING PIPELINE ----
    else {
      setIsBulkMode(true);
      setBulkLoading(true);
      setSelectedFileCount(files.length);
      
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file); // 'files' matches backend List parameter
      });

      try {
        const res = await fetch('http://localhost:8000/bulk-upload', {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        setBulkResult({ processed: result.processed });
        fetchProducts(); // Instantly refresh catalog with new batch
      } catch (err) {
        console.error("Bulk upload error:", err);
      } finally {
        setBulkLoading(false);
      }
    }
  };

  const handlePublish = async () => {
    const formData = new FormData();
    formData.append('category', category);
    formData.append('description', description);

    try {
      const res = await fetch('http://localhost:8000/save-product', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      setSavedId(result.product_id);
      fetchProducts();
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleGenerateMarketing = async () => {
    setGeneratingMarketing(true);
    const formData = new FormData();
    formData.append('category', category);
    formData.append('description', description);

    try {
      const res = await fetch('http://localhost:8000/generate-marketing', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      setMarketing(result);
    } catch (err) {
      console.error("Marketing error:", err);
    } finally {
      setGeneratingMarketing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const hasError = category.toLowerCase().includes("error") || description.toLowerCase().includes("error");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-inner">
              <span className="text-white font-bold text-xl leading-none">✦</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Seller<span className="text-slate-500 font-medium">Dash</span></h1>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 space-y-12">
        
        {/* --- UPLOAD WORKSPACE --- */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Add Products</h2>
            <p className="text-slate-500 text-sm mt-1">Upload a single image to edit, or select multiple files to auto-publish in bulk.</p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col md:flex-row">
            
            {/* Left Column: Image Upload */}
            <div className="md:w-1/2 p-8 bg-slate-50/50 border-r border-slate-100 flex flex-col gap-6">
              <div className="relative group cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple // Now accepts multiple files!
                  onChange={handleFileChange} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all group-hover:border-indigo-400 group-hover:bg-indigo-50/50">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Click to select product images</p>
                  <p className="text-xs text-slate-400 mt-1">Select multiple files for batch processing</p>
                </div>
              </div>

              {/* Single File Preview */}
              {!isBulkMode && preview && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm flex items-center justify-center h-72">
                  <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain p-2" />
                </div>
              )}

              {/* Bulk File Preview Graphic */}
              {isBulkMode && (
                 <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center h-72 gap-3">
                    <svg className="w-16 h-16 text-indigo-200" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    <span className="font-bold text-slate-700 text-lg">{selectedFileCount} Files Queued</span>
                 </div>
              )}
            </div>

            {/* Right Column: AI Output & Progress */}
            <div className="md:w-1/2 p-8 flex flex-col justify-center min-h-[300px]">
              
              {/* Idle State */}
              {!loading && !category && !isBulkMode && !bulkLoading && !bulkResult && (
                <div className="text-center text-slate-400">
                  <div className="w-16 h-16 mx-auto mb-4 opacity-20">
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M9.75 3a1.5 1.5 0 011.5 1.5v1.898c.552.122 1.077.34 1.558.64l1.341-1.342a1.5 1.5 0 112.122 2.122l-1.342 1.341c.3.481.518 1.006.64 1.558H17.5a1.5 1.5 0 010 3h-1.898c-.122.552-.34 1.077-.64 1.558l1.342 1.341a1.5 1.5 0 11-2.122 2.122l-1.341-1.342c-.481.3-.1006.518-1.558.64V20.5a1.5 1.5 0 01-3 0v-1.898c-.552-.122-1.077-.34-1.558-.64l-1.341 1.342a1.5 1.5 0 11-2.122-2.122l1.342-1.341c-.3-.481-.518-1.006-.64-1.558H4.5a1.5 1.5 0 010-3h1.898c.122-.552.34-1.077.64-1.558l-1.342-1.341a1.5 1.5 0 012.122-2.122l1.341 1.342c.481-.3.1006-.518 1.558-.64V4.5A1.5 1.5 0 019.75 3z" /></svg>
                  </div>
                  <p>Awaiting image upload...</p>
                </div>
              )}

              {/* Bulk Loading State */}
              {bulkLoading && (
                <div className="text-center space-y-5 animate-in fade-in duration-300">
                  <div className="w-16 h-16 mx-auto rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Processing Batch...</h3>
                    <p className="text-slate-500 text-sm mt-2">Gemini is analyzing and auto-publishing your products. Please do not close this window.</p>
                  </div>
                </div>
              )}

              {/* Bulk Success State */}
              {bulkResult && !bulkLoading && (
                <div className="text-center space-y-4 animate-in zoom-in duration-500">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Batch Complete!</h3>
                    <p className="text-slate-600 mt-1">Successfully analyzed and published <span className="font-bold">{bulkResult.processed}</span> products.</p>
                  </div>
                </div>
              )}

              {/* Single File Loading State */}
              {loading && !isBulkMode && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-24 w-full bg-slate-100 rounded-xl animate-pulse"></div>
                  </div>
                </div>
              )}

              {/* Single File Results & Editor */}
              {!loading && !isBulkMode && category && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {hasError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">
                      ⚠️ Could not parse product. Please try again.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</label>
                    <input 
                      type="text" 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)} 
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${hasError ? 'border-red-200' : 'border-slate-200'}`} 
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</label>
                    <textarea 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      rows={3} 
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-700 leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none ${hasError ? 'border-red-200' : 'border-slate-200'}`} 
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    {savedId ? (
                      <div className="flex-1 bg-emerald-50 text-emerald-700 py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-emerald-200/50">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Published
                      </div>
                    ) : (
                      <button 
                        onClick={handlePublish} 
                        disabled={hasError}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300 active:scale-[0.98]"
                      >
                        Publish Catalog
                      </button>
                    )}
                    
                    {!marketing && (
                      <button 
                        onClick={handleGenerateMarketing}
                        disabled={hasError || generatingMarketing}
                        className="flex-1 bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 disabled:text-slate-400 disabled:border-slate-200 disabled:bg-slate-50 font-semibold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {generatingMarketing ? (
                          <span className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></span>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                            Generate Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {marketing && (
                    <div className="mt-6 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 shadow-inner animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-indigo-900">Instagram Draft</h3>
                        <button 
                          onClick={() => copyToClipboard(marketing.instagram_caption)}
                          className="text-xs font-semibold text-indigo-600 bg-white px-3 py-1.5 rounded-md border border-indigo-200 hover:bg-indigo-50 transition-colors"
                        >
                          {copiedCaption ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-sm text-indigo-800 leading-relaxed mb-4 whitespace-pre-wrap">
                        {marketing.instagram_caption}
                      </p>
                      <div className="h-px bg-indigo-200/50 w-full my-4"></div>
                      <h3 className="text-sm font-bold text-indigo-900 mb-2">SEO Meta Tag Draft</h3>
                      <p className="text-xs text-indigo-700 bg-white p-3 rounded-lg border border-indigo-100">
                        {marketing.seo_meta}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* --- INVENTORY GALLERY --- */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Live Catalog</h2>
              <p className="text-slate-500 text-sm mt-1">Manage your published inventory.</p>
            </div>
            <span className="bg-white text-slate-600 text-sm font-semibold px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
              {products.length} Items
            </span>
          </div>
          
          {fetchingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse border border-slate-200/60"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No products yet</h3>
              <p className="text-slate-500 mt-1">Upload an image above to generate your first listing.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((item) => (
                <div key={item.id} className="group bg-white border border-slate-200/60 rounded-3xl p-6 hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
                  
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  <div className="flex justify-between items-start mb-5">
                    <span className="inline-block bg-slate-100/80 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-widest border border-slate-200/50">
                      {item.category}
                    </span>
                    <span className="text-slate-400 font-mono text-xs font-semibold bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      #{item.id}
                    </span>
                  </div>
                  
                  <p className="text-slate-600 text-sm flex-grow leading-relaxed">
                    {item.description}
                  </p>
                  
                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}