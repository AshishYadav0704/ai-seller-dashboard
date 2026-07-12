import React, { useState, useEffect } from 'react';

// SET THIS TO YOUR LIVE RENDER URL
const API_BASE_URL = 'https://ai-seller-dashboard.onrender.com';

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
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(true);

  const [marketing, setMarketing] = useState<MarketingAssets | null>(null);
  const [generatingMarketing, setGeneratingMarketing] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

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
      const res = await fetch(`${API_BASE_URL}/products`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Ensure data is an array
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setProducts([]); 
    } finally {
      setFetchingProducts(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setPreview(null);
    setCategory("");
    setDescription("");
    setSavedId(null);
    setMarketing(null);
    setBulkResult(null);

    if (files.length === 1) {
      setIsBulkMode(false);
      setPreview(URL.createObjectURL(files[0]));
      setLoading(true);

      const formData = new FormData();
      formData.append('file', files[0]);

      try {
        const res = await fetch(`${API_BASE_URL}/analyze-product`, {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        setCategory(result.category);
        setDescription(result.description);
      } catch (err) {
        setCategory("Error");
        setDescription("Failed to connect to backend.");
      } finally {
        setLoading(false);
      }
    } else {
      setIsBulkMode(true);
      setBulkLoading(true);
      setSelectedFileCount(files.length);
      
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));

      try {
        const res = await fetch(`${API_BASE_URL}/bulk-upload`, {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        setBulkResult({ processed: result.processed });
        fetchProducts();
      } catch (err) {
        console.error(err);
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
      const res = await fetch(`${API_BASE_URL}/save-product`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      setSavedId(result.product_id);
      fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateMarketing = async () => {
    setGeneratingMarketing(true);
    const formData = new FormData();
    formData.append('category', category);
    formData.append('description', description);

    try {
      const res = await fetch(`${API_BASE_URL}/generate-marketing`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      setMarketing(result);
    } catch (err) {
      console.error(err);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Amazing Infinity</h1>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 mt-10 space-y-12">
        {/* --- UPLOAD SECTION --- */}
        <section>
          <div className="bg-white rounded-3xl p-8 border border-slate-200">
             <input type="file" multiple onChange={handleFileChange} />
             {/* ... rest of your UI ... */}
          </div>
        </section>

        {/* --- INVENTORY GALLERY --- */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Live Catalog</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* SAFETY CHECK: ONLY MAP IF PRODUCTS IS AN ARRAY */}
            {Array.isArray(products) && products.length > 0 ? (
              products.map((item) => (
                <div key={item.id} className="bg-white p-6 rounded-3xl border">
                   <p className="font-bold">{item.category}</p>
                   <p className="text-sm">{item.description}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">
                {fetchingProducts ? "Loading..." : "No products to display."}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}