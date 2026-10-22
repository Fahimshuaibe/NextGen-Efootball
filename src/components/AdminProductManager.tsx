import React, { useState, useEffect } from "react";
import { CatalogProduct, CatalogSection, PaymentOptionConfig } from "../types";
import {
  getCatalogProducts,
  saveCatalogProducts,
  addCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  getCatalogSections,
  saveCatalogSections,
  addCatalogSection,
  updateCatalogSection,
  deleteCatalogSection,
  resetDefaultCatalog,
  getPaymentOptions,
  updatePaymentOption,
  togglePaymentMethod,
} from "../utils/storage";
import { toBn } from "../utils/order";
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Flame,
  Clock,
  Users,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Coins,
  Check,
  X,
  Search,
  Upload,
  RotateCcw,
  Tag,
  AlertCircle,
  HelpCircle,
  Calendar,
  Power,
  CreditCard,
} from "lucide-react";

const PRESET_IMAGES = [
  { label: "Luis Suárez", url: "/assets/aistudio/Screenshot_20260929-225847_72392c40.png" },
  { label: "Iker Casillas", url: "/assets/aistudio/casillas_card.png" },
  { label: "Suárez + Casillas Combo", url: "/assets/aistudio/combo_suarez_casillas.png" },
  { label: "NextGen Logo", url: "/assets/aistudio/20260627_002155_69284c16.png" },
];

export function AdminProductManager() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptionConfig[]>([]);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<{
    name: string;
    description: string;
    subtitle: string;
    category: string;
    coins: string;
    price: string;
    originalPrice: string;
    image: string;
    tag: string;
    parts: string;
    isActive: boolean;
    isOffer: boolean;
    offerDurationDays: string;
    offerExpiry: string;
    maxBuyers: string;
    soldCount: string;
  }>({
    name: "",
    description: "",
    subtitle: "",
    category: "regular",
    coins: "100",
    price: "140",
    originalPrice: "",
    image: "",
    tag: "",
    parts: "",
    isActive: true,
    isOffer: false,
    offerDurationDays: "3",
    offerExpiry: "",
    maxBuyers: "50",
    soldCount: "0",
  });

  // Section Modal State
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState<{
    name: string;
    subtitle: string;
    badge: string;
    icon: string;
    isActive: boolean;
  }>({
    name: "",
    subtitle: "",
    badge: "",
    icon: "🔥",
    isActive: true,
  });

  const loadData = () => {
    setProducts(getCatalogProducts());
    setSections(getCatalogSections());
    setPaymentOptions(getPaymentOptions());
  };

  useEffect(() => {
    loadData();
    const handleProds = () => setProducts(getCatalogProducts());
    const handleSecs = () => setSections(getCatalogSections());
    const handlePays = () => setPaymentOptions(getPaymentOptions());
    window.addEventListener("nextgen_catalog_products_updated", handleProds);
    window.addEventListener("nextgen_catalog_sections_updated", handleSecs);
    window.addEventListener("nextgen_payment_options_updated", handlePays);
    return () => {
      window.removeEventListener("nextgen_catalog_products_updated", handleProds);
      window.removeEventListener("nextgen_catalog_sections_updated", handleSecs);
      window.removeEventListener("nextgen_payment_options_updated", handlePays);
    };
  }, []);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Open Product Modal
  const handleOpenAddProduct = (defaultCategory?: string) => {
    setEditingProductId(null);
    const targetCat = defaultCategory || (sections[0]?.id || "regular");
    setProductForm({
      name: "",
      description: "",
      subtitle: "",
      category: targetCat,
      coins: "100",
      price: "140",
      originalPrice: "",
      image: "",
      tag: "",
      parts: "",
      isActive: true,
      isOffer: false,
      offerDurationDays: "3",
      offerExpiry: "",
      maxBuyers: "50",
      soldCount: "0",
    });
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod: CatalogProduct) => {
    setEditingProductId(prod.id);
    setProductForm({
      name: prod.name,
      description: prod.description || "",
      subtitle: prod.subtitle || "",
      category: prod.category,
      coins: prod.coins !== undefined && prod.coins !== null ? String(prod.coins) : "",
      price: String(prod.price),
      originalPrice: prod.originalPrice ? String(prod.originalPrice) : "",
      image: prod.image || "",
      tag: prod.tag || "",
      parts: prod.parts || "",
      isActive: prod.isActive ?? true,
      isOffer: Boolean(prod.isOffer),
      offerDurationDays: prod.offerDurationDays ? String(prod.offerDurationDays) : "3",
      offerExpiry: prod.offerExpiry ? prod.offerExpiry.substring(0, 16) : "",
      maxBuyers: prod.maxBuyers ? String(prod.maxBuyers) : "",
      soldCount: prod.soldCount ? String(prod.soldCount) : "0",
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showFeedback("প্রোডাক্টের নাম লিখুন", "error");
      return;
    }
    const priceNum = Number(productForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      showFeedback("সঠিক বিক্রয় মূল্য দিন", "error");
      return;
    }

    let calculatedExpiry = productForm.offerExpiry;
    if (productForm.isOffer && !calculatedExpiry && productForm.offerDurationDays) {
      const days = Number(productForm.offerDurationDays) || 3;
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      calculatedExpiry = expDate.toISOString();
    } else if (productForm.isOffer && calculatedExpiry) {
      calculatedExpiry = new Date(calculatedExpiry).toISOString();
    }

    const payload: Omit<CatalogProduct, "id"> = {
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      subtitle: productForm.subtitle.trim(),
      category: productForm.category,
      coins: productForm.coins ? Number(productForm.coins) : null,
      price: priceNum,
      originalPrice: productForm.originalPrice ? Number(productForm.originalPrice) : undefined,
      image: productForm.image.trim(),
      tag: productForm.tag.trim(),
      parts: productForm.parts.trim(),
      isActive: productForm.isActive,
      isOffer: productForm.isOffer,
      offerExpiry: productForm.isOffer ? calculatedExpiry : undefined,
      offerDurationDays: productForm.isOffer && productForm.offerDurationDays ? Number(productForm.offerDurationDays) : undefined,
      maxBuyers: productForm.isOffer && productForm.maxBuyers ? Number(productForm.maxBuyers) : undefined,
      soldCount: Number(productForm.soldCount) || 0,
    };

    if (editingProductId) {
      updateCatalogProduct(editingProductId, payload);
      showFeedback("✅ প্রোডাক্ট সফলভাবে আপডেট করা হয়েছে!");
    } else {
      addCatalogProduct(payload);
      showFeedback("🎉 নতুন প্রোডাক্ট সফলভাবে যোগ করা হয়েছে!");
    }

    setShowProductModal(false);
    loadData();
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`আপনি কি নিশ্চিত যে "${name}" প্রোডাক্টটি মুছে ফেলতে চান?`)) {
      deleteCatalogProduct(id);
      showFeedback("🗑️ প্রোডাক্টটি মুছে ফেলা হয়েছে!");
      loadData();
    }
  };

  const handleToggleProductActive = (prod: CatalogProduct) => {
    const nextStatus = !prod.isActive;
    updateCatalogProduct(prod.id, { isActive: nextStatus });
    showFeedback(nextStatus ? `👁️ "${prod.name}" সক্রিয় করা হয়েছে!` : `🙈 "${prod.name}" লুকিয়ে রাখা হয়েছে!`);
    loadData();
  };

  // Open Section Modal
  const handleOpenAddSection = () => {
    setEditingSectionId(null);
    setSectionForm({
      name: "",
      subtitle: "",
      badge: "",
      icon: "🔥",
      isActive: true,
    });
    setShowSectionModal(true);
  };

  const handleOpenEditSection = (sec: CatalogSection) => {
    setEditingSectionId(sec.id);
    setSectionForm({
      name: sec.name,
      subtitle: sec.subtitle || "",
      badge: sec.badge || "",
      icon: sec.icon || "🔥",
      isActive: sec.isActive ?? true,
    });
    setShowSectionModal(true);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.name.trim()) {
      showFeedback("সেকশনের নাম লিখুন", "error");
      return;
    }

    if (editingSectionId) {
      updateCatalogSection(editingSectionId, {
        name: sectionForm.name.trim(),
        subtitle: sectionForm.subtitle.trim(),
        badge: sectionForm.badge.trim(),
        icon: sectionForm.icon.trim(),
        isActive: sectionForm.isActive,
      });
      showFeedback("✅ সেকশন সফলভাবে আপডেট হয়েছে!");
    } else {
      addCatalogSection({
        name: sectionForm.name.trim(),
        subtitle: sectionForm.subtitle.trim(),
        badge: sectionForm.badge.trim(),
        icon: sectionForm.icon.trim(),
        isActive: sectionForm.isActive,
        order: sections.length + 1,
      });
      showFeedback("🎉 নতুন সেকশন যোগ করা হয়েছে!");
    }

    setShowSectionModal(false);
    loadData();
  };

  const handleDeleteSection = (id: string, name: string) => {
    const prodsCount = products.filter(p => p.category === id).length;
    if (prodsCount > 0) {
      if (!confirm(`এই সেকশনে ${prodsCount}টি প্রোডাক্ট রয়েছে। সেকশন মুছলে এগুলো আনক্যাটাগোরাইজড হবে। আপনি কি নিশ্চিত?`)) {
        return;
      }
    } else {
      if (!confirm(`আপনি কি "${name}" সেকশনটি মুছে ফেলতে চান?`)) return;
    }
    deleteCatalogSection(id);
    showFeedback("🗑️ সেকশন মুছে ফেলা হয়েছে!");
    loadData();
  };

  // Image Upload via File Reader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2.5 * 1024 * 1024) {
        alert("⚠️ ছবির সাইজ ২.৫ মেগাবাইট (2.5MB) এর নিচে হতে হবে।");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setProductForm(prev => ({ ...prev, image: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter Products
  const filteredProducts = products.filter((p) => {
    const matchesSection = selectedSectionFilter === "all" || p.category === selectedSectionFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      (p.coins && String(p.coins).includes(query)) ||
      String(p.price).includes(query);
    return matchesSection && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-lg animate-fadeIn ${
            feedbackMsg.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/50 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">প্রোডাক্ট, সেকশন ও লিমিটেড অফার কন্ট্রোল</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              যেকোনো কয়েন রেট, প্লেয়ার প্যাক, ছবি, নাম, ডেসক্রিপশন পরিবর্তন করুন ও নতুন অফার যুক্ত করুন
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenAddSection}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন সেকশন যোগ</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddProduct()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black text-xs font-black transition cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রোডাক্ট / অফার যোগ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm("আপনি কি ডিফল্ট কয়েন ও প্লেয়ার প্যাক তালিকায় রিসেট করতে চান? আপনার কাস্টম পরিবর্তন মুছে যাবে।")) {
                resetDefaultCatalog();
                loadData();
                showFeedback("🔄 ডিফল্ট প্রোডাক্ট তালিকায় রিস্টোর করা হয়েছে!");
              }
            }}
            title="ডিফল্ট ডাটা রিস্টোর"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-xs transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PAYMENT OPTIONS ON/OFF CONTROL PANEL */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              পেমেন্ট মেথড চালু / বন্ধ কন্ট্রোল (Payment Gateway Switch):
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            হঠাৎ কোনো পেমেন্ট অপশনে সমস্যা হলে এখান থেকে ১ ক্লিকে বন্ধ বা চালু করুন
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paymentOptions.map((pay) => (
            <div
              key={pay.id}
              className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                pay.isEnabled
                  ? "bg-slate-950/90 border-emerald-500/30"
                  : "bg-rose-950/20 border-rose-500/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-xs">{pay.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        pay.isEnabled
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {pay.isEnabled ? "✓ চালু আছে" : "🚫 বন্ধ (Disabled)"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{pay.number}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextState = !pay.isEnabled;
                    togglePaymentMethod(pay.id, nextState, pay.disabledReason);
                    setPaymentOptions(getPaymentOptions());
                    showFeedback(
                      nextState
                        ? `✅ ${pay.label} পেমেন্ট অপশন আবার চালু করা হয়েছে!`
                        : `🚫 ${pay.label} পেমেন্ট অপশন সাময়িকভাবে বন্ধ করা হয়েছে!`,
                      nextState ? "success" : "error"
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    pay.isEnabled
                      ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20"
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{pay.isEnabled ? "বন্ধ করুন" : "চালু করুন"}</span>
                </button>
              </div>

              {!pay.isEnabled && (
                <div className="pt-1 border-t border-rose-500/20">
                  <label className="block text-[10px] font-bold text-rose-300 mb-1">
                    বন্ধ থাকার কারণ / নোটিশ (গ্রাহক যা দেখবে):
                  </label>
                  <input
                    type="text"
                    value={pay.disabledReason || ""}
                    onChange={(e) => {
                      updatePaymentOption(pay.id, { disabledReason: e.target.value });
                      setPaymentOptions(getPaymentOptions());
                    }}
                    placeholder="যেমন: যান্ত্রিক ত্রুটির কারণে এই পেমেন্ট মেথডটি সাময়িকভাবে বন্ধ আছে"
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-rose-500/40 rounded-lg text-[11px] text-rose-200 focus:outline-none focus:border-rose-400"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SECTIONS MANAGER STRIP */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              বর্তমান সেকশনসমূহ ({toBn(sections.length)} টি):
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            ওয়েবসাইটে এই সেকশন অনুযায়ী ক্যাটাগরি ও ফিল্টার দেখাবে
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((sec) => {
            const count = products.filter(p => p.category === sec.id).length;
            return (
              <div
                key={sec.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                  sec.isActive
                    ? "bg-slate-950/80 border-slate-800"
                    : "bg-slate-950/30 border-slate-800/50 opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{sec.icon || "📁"}</span>
                    <span className="font-extrabold text-white text-xs truncate">{sec.name}</span>
                    {sec.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {sec.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {count} টি প্রোডাক্ট • {sec.isActive ? "সক্রিয়" : "বন্ধ"}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEditSection(sec)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    title="সেকশন এডিট করুন"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSection(sec.id, sec.name)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                    title="সেকশন মুছুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="all">সকল সেকশনের প্রোডাক্ট ({toBn(products.length)})</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({toBn(products.filter(p => p.category === s.id).length)})
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="প্রোডাক্ট নাম, কয়েন বা দাম দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">
            পাওয়া গেছে: <span className="text-cyan-400 font-mono">{toBn(filteredProducts.length)}</span> টি
          </span>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <p className="text-slate-400 text-sm">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>
          <button
            type="button"
            onClick={() => handleOpenAddProduct()}
            className="px-4 py-2 bg-cyan-500 text-black text-xs font-bold rounded-xl cursor-pointer"
          >
            + নতুন প্রোডাক্ট তৈরি করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const sec = sections.find((s) => s.id === p.category);
            const isOfferActive = Boolean(p.isOffer);
            const remainingQuota = p.maxBuyers ? Math.max(0, p.maxBuyers - (p.soldCount || 0)) : null;
            const isSoldOut = remainingQuota !== null && remainingQuota <= 0;

            return (
              <div
                key={p.id}
                className={`rounded-2xl border flex flex-col justify-between p-4 transition relative overflow-hidden group shadow-lg ${
                  !p.isActive
                    ? "bg-slate-950/40 border-slate-800 opacity-60"
                    : isOfferActive
                    ? "bg-slate-900 border-amber-500/40 shadow-amber-500/5 ring-1 ring-amber-500/20"
                    : "bg-slate-900 border-slate-800 hover:border-cyan-500/40"
                }`}
              >
                {/* Sudden Offer Ribbon */}
                {isOfferActive && (
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500 to-rose-500 text-black flex items-center gap-1 shadow">
                      <Flame className="w-3 h-3 fill-black text-black" />
                      <span>স্পেশাল অফার</span>
                    </span>
                    {remainingQuota !== null && (
                      <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold border ${
                        isSoldOut
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}>
                        {isSoldOut ? "🚫 স্টক শেষ" : `বাকি: ${toBn(remainingQuota)}টি`}
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {/* Image or Coin Badge */}
                  <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="text-center p-3 space-y-1">
                        <span className="text-3xl block">🪙</span>
                        <span className="text-[11px] font-mono text-cyan-300 font-extrabold block">
                          {p.coins ? `${toBn(p.coins)} কয়েন` : "প্যাকেজ"}
                        </span>
                      </div>
                    )}

                    {p.tag && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-black bg-cyan-500 text-black">
                        {p.tag}
                      </span>
                    )}
                  </div>

                  {/* Title & Section */}
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                      <span>{sec?.icon || "📁"}</span>
                      <span>{sec?.name || "জেনারেল"}</span>
                    </div>

                    <h4 className="font-black text-white text-sm group-hover:text-cyan-300 transition mt-1 line-clamp-1">
                      {p.name}
                    </h4>

                    {p.description && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Coins Row */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">বিক্রয় মূল্য:</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-black text-emerald-400 font-mono">
                          ৳ {toBn(p.price)}
                        </span>
                        {p.originalPrice && p.originalPrice > p.price && (
                          <span className="text-[10px] text-slate-500 line-through font-mono">
                            ৳{toBn(p.originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    {p.coins ? (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">ইন-গেম কয়েন:</span>
                        <span className="text-xs font-black text-amber-300 font-mono">
                          {toBn(p.coins)} 🪙
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Offer Timer Banner if offer is active */}
                  {isOfferActive && p.offerExpiry && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-center gap-1.5 font-mono">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>মেয়াদ: {new Date(p.offerExpiry).toLocaleDateString("bn-BD")}</span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleProductActive(p)}
                    className={`p-1.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      p.isActive
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                        : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                    }`}
                    title={p.isActive ? "পণ্যটি ওয়েবসাইটে দেখানো হচ্ছে" : "পণ্যটি লুকানো রয়েছে"}
                  >
                    {p.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{p.isActive ? "চালু" : "লুকানো"}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditProduct(p)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>এডিট</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id, p.name)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== CREATE / EDIT PRODUCT MODAL ==================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-7 space-y-5 my-auto max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {editingProductId ? "প্রোডাক্ট / অফার তথ্য এডিট করুন" : "নতুন প্রোডাক্ট বা অফার যোগ করুন"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    নাম, কয়েন, দাম, ছবি ও স্পেশাল অফার টাইমার সেট করুন
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* 1. Name & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    প্রোডাক্টের নাম (Product Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="যেমন: ১,০০০ কয়েন অথবা Starter Set: Luis Suárez"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    সেকশন / ক্যাটাগরি (Section) *
                  </label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon || "📁"} {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Coins & Price & Original Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ইন-গেম কয়েন (Coins)
                  </label>
                  <input
                    type="number"
                    value={productForm.coins}
                    onChange={(e) => setProductForm({ ...productForm, coins: e.target.value })}
                    placeholder="যেমন: 1000"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    বিক্রয় মূল্য (Price BDT ৳) *
                  </label>
                  <input
                    type="number"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="যেমন: 1100"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-emerald-300 font-bold text-xs font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    পূর্বের রেগুলার দাম (ঐচ্ছিক - স্ট্রাইকথ্রু)
                  </label>
                  <input
                    type="number"
                    value={productForm.originalPrice}
                    onChange={(e) => setProductForm({ ...productForm, originalPrice: e.target.value })}
                    placeholder="যেমন: 1250"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-400 text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* 3. Description & Subtitle & Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ট্যাগ / ব্যাজ (Tag)
                  </label>
                  <input
                    type="text"
                    value={productForm.tag}
                    onChange={(e) => setProductForm({ ...productForm, tag: e.target.value })}
                    placeholder="যেমন: সেরা দাম, জনপ্রিয়, লিমিটেড অফার"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    সাব-টাইটেল (Subtitle)
                  </label>
                  <input
                    type="text"
                    value={productForm.subtitle}
                    onChange={(e) => setProductForm({ ...productForm, subtitle: e.target.value })}
                    placeholder="যেমন: CF 99 Luis Suárez + ৫০ কয়েন"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  বিস্তারিত বিবরণ (Description)
                </label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="গ্রাহককে প্রোডাক্ট সম্পর্কে বিস্তারিত তথ্য জানান..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              {/* 4. Product Image Upload & Presets */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    <span>প্রোডাক্ট এর ছবি (Product Photo)</span>
                  </label>
                  {productForm.image && (
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, image: "" })}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      ছবি রিমুভ করুন
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  {/* Image Preview Box */}
                  <div className="w-24 h-24 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {productForm.image ? (
                      <img src={productForm.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-500 font-bold text-center p-2">ছবি নেই</span>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    {/* Device Upload Button */}
                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-white font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0">
                        <Upload className="w-3.5 h-3.5 text-cyan-400" />
                        <span>ডিভাইস থেকে ছবি আপলোড</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">বা সরাসরি ছবির URL পেস্ট করুন</span>
                    </div>

                    <input
                      type="text"
                      value={productForm.image}
                      onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                      placeholder="ছবির লিংক পেস্ট করুন (যেমন: https://... বা /assets/...)"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                    />

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400">প্রিসেট:</span>
                      {PRESET_IMAGES.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setProductForm({ ...productForm, image: preset.url })}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. SUDDEN / LIMITED-TIME OFFER SETTINGS */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <div>
                      <h5 className="text-xs font-black text-amber-300">
                        হঠাৎ কোনো অফার ও লিমিটেড টাইম ফ্ল্যাশ সেল সেটিংস
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        অফারের মেয়াদ (দিন/ঘণ্টা) ও কতজনকে দেওয়া যাবে সেই কোটা নির্ধারণ করুন
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.isOffer}
                      onChange={(e) => setProductForm({ ...productForm, isOffer: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {productForm.isOffer && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-500/20">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-200 mb-1">
                        কতদিনের জন্য অফার (Duration Days)
                      </label>
                      <select
                        value={productForm.offerDurationDays}
                        onChange={(e) => {
                          const days = Number(e.target.value);
                          const exp = new Date();
                          exp.setDate(exp.getDate() + days);
                          setProductForm({
                            ...productForm,
                            offerDurationDays: e.target.value,
                            offerExpiry: exp.toISOString().substring(0, 16),
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-amber-500/30 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        <option value="1">১ দিন (২৪ ঘণ্টা)</option>
                        <option value="2">২ দিন</option>
                        <option value="3">৩ দিন</option>
                        <option value="5">৫ দিন</option>
                        <option value="7">৭ দিন (১ সপ্তাহ)</option>
                        <option value="15">১৫ দিন</option>
                        <option value="30">১ মাস</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-200 mb-1">
                        নির্দিষ্ট শেষ তারিখ ও সময় (Exact Expiry)
                      </label>
                      <input
                        type="datetime-local"
                        value={productForm.offerExpiry}
                        onChange={(e) => setProductForm({ ...productForm, offerExpiry: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-amber-500/30 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-200 mb-1">
                        কতজনকে দেওয়া যাবে (Quota / Max Buyers) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={productForm.maxBuyers}
                        onChange={(e) => setProductForm({ ...productForm, maxBuyers: e.target.value })}
                        placeholder="যেমন: 20 বা 50 জন"
                        className="w-full px-3 py-2 bg-slate-900 border border-amber-500/30 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        বিক্রি হয়েছে: {toBn(Number(productForm.soldCount) || 0)} জন
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  {editingProductId ? "পরিবর্তন সেভ করুন" : "প্রোডাক্ট যোগ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CREATE / EDIT SECTION MODAL ==================== */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>{editingSectionId ? "সেকশন এডিট করুন" : "নতুন সেকশন যোগ করুন"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSectionModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  সেকশনের নাম (Section Title) *
                </label>
                <input
                  type="text"
                  required
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="যেমন: 🔥 মেগা ধামাকা অফার অথবা ম্যানেজার প্যাক"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  সাব-টাইটেল (Subtitle)
                </label>
                <input
                  type="text"
                  value={sectionForm.subtitle}
                  onChange={(e) => setSectionForm({ ...sectionForm, subtitle: e.target.value })}
                  placeholder="যেমন: সীমিত সময়ের বিশেষ ক্যাশব্যাক অফার"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ব্যাজ (Badge)
                  </label>
                  <input
                    type="text"
                    value={sectionForm.badge}
                    onChange={(e) => setSectionForm({ ...sectionForm, badge: e.target.value })}
                    placeholder="যেমন: সেরা রেট, লিমিটেড"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    আইকন / ইমোজি (Icon)
                  </label>
                  <input
                    type="text"
                    value={sectionForm.icon}
                    onChange={(e) => setSectionForm({ ...sectionForm, icon: e.target.value })}
                    placeholder="যেমন: 🔥, ⚽, 🎁, 💎"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-300">সেকশনটি সক্রিয় রাখবেন?</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sectionForm.isActive}
                    onChange={(e) => setSectionForm({ ...sectionForm, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs cursor-pointer"
                >
                  সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
