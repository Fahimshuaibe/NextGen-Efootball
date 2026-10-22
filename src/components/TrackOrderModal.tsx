import React, { useState } from "react";
import { Order } from "../types";
import { getOrderById, getOrdersByPhone, getShopSettings } from "../utils/storage";
import { 
  Search, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  ArrowRight, 
  ExternalLink, 
  ThumbsUp, 
  MessageCircle,
  Headphones,
  KeyRound,
  Play,
  ShieldCheck
} from "lucide-react";
import { toBn, formatBdPhonePretty, formatBdWhatsappForUrl } from "../utils/order";

interface Props {
  onClose: () => void;
  onViewReceipt: (order: Order) => void;
  onOpenLiveChat?: (phone: string, orderNo?: string) => void;
}

export function TrackOrderModal({ onClose, onViewReceipt, onOpenLiveChat }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Order[] | null>(null);
  const [searched, setSearched] = useState(false);
  const shopSettings = getShopSettings();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearched(true);
    const cleanQuery = query.trim();

    // Check by Order ID first
    const byId = getOrderById(cleanQuery);
    if (byId) {
      setResults([byId]);
      return;
    }

    // Check by phone / whatsapp
    const byPhone = getOrdersByPhone(cleanQuery);
    if (byPhone.length > 0) {
      setResults(byPhone);
      return;
    }

    setResults([]);
  };

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            কমপ্লিটেড (Completed)
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            প্রসেসিং (কাজ চলছে)
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            বাতিল (Cancelled)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            পেন্ডিং (যাচাই চলছে)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-950/90 border-b border-slate-800 shrink-0">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            <span>লাইভ অর্ডার ট্র্যাকিং ও স্ট্যাটাস</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          <form onSubmit={handleSearch} className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">
              আপনার অর্ডার নম্বর (যেমন EF8839201) অথবা মোবাইল/WhatsApp নম্বর দিন:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="অর্ডার নম্বর বা ফোন নম্বর..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                খুঁজুন
              </button>
            </div>
          </form>

          {/* Results */}
          {searched && (
            <div className="space-y-4 pt-2">
              {results && results.length > 0 ? (
                results.map((ord) => (
                  <div
                    key={ord.orderNo}
                    className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-black text-sm text-cyan-400">
                          #{ord.orderNo}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {new Date(ord.time).toLocaleDateString("bn-BD", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      {getStatusBadge(ord.status)}
                    </div>

                    {/* Step-by-Step Progress Pipeline */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-2 text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        অর্ডারের বর্তমান অগ্রগতি:
                      </span>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <div className={`p-1.5 rounded-lg border ${
                          ord.status !== "cancelled" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}>
                          ১. পেমেন্ট যাচাই
                        </div>
                        <div className={`p-1.5 rounded-lg border ${
                          ord.status === "processing" || ord.status === "completed" ? "bg-sky-500/20 text-sky-300 border-sky-500/40" : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}>
                          ২. লগইন প্রস্তুতি
                        </div>
                        <div className={`p-1.5 rounded-lg border ${
                          ord.otpRequested || ord.status === "completed" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}>
                          ৩. জিমেইল OTP
                        </div>
                        <div className={`p-1.5 rounded-lg border ${
                          ord.status === "completed" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold" : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}>
                          ৪. সম্পন্ন ✅
                        </div>
                      </div>
                    </div>

                    <div className="text-xs space-y-1 text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">প্যাকেজ:</span>
                        <span className="font-medium text-white">{ord.packageName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">মূল্য:</span>
                        <span className="font-bold text-emerald-400">
                          ৳ {toBn(ord.price)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Konami ID/Email:</span>
                        <span className="font-mono text-amber-300">{ord.konamiIdOrEmail}</span>
                      </div>
                    </div>

                    {ord.customerNote && (
                      <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                        <b>আপনার নোট:</b> {ord.customerNote}
                      </div>
                    )}

                    {ord.adminNotes && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-300">
                        <b>এডমিন নোট:</b> {ord.adminNotes}
                      </div>
                    )}

                    {/* Celebration / Facebook Review Card on Completed */}
                    {ord.status === "completed" && (
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/60 to-indigo-950/50 border border-blue-500/40 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-blue-300 font-bold">
                          <ThumbsUp className="w-4 h-4 text-cyan-400" />
                          <span>কয়েন সফলভাবে জমা হয়েছে! 🎉</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          ভবিষ্যতে কয়েন লাগলে অবশ্যই যোগাযোগ করবেন। অনুগ্রহ করে আমাদের অফিসিয়াল ফেসবুক পেজে একটি রিভিউ দিয়ে আসুন এবং eFootball বন্ধুদের ইনভাইট দিন! ❤️⚽
                        </p>
                        <a
                          href={shopSettings.facebookUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-lg transition cursor-pointer shadow"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>ফেসবুক পেজে রিভিউ ও বন্ধুদের ইনভাইট দিন</span>
                        </a>
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => onViewReceipt(ord)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        <span>রিসিপ্ট দেখুন / প্রিন্ট</span>
                      </button>

                      <a
                        href={`https://wa.me/${formatBdWhatsappForUrl(shopSettings.adminWhatsapp || shopSettings.whatsapp)}?text=${encodeURIComponent(`আসসালামু আলাইকুম, আমার অর্ডার #${ord.orderNo} নিয়ে তথ্য/সাহায্য প্রয়োজন।`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp Support</span>
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs rounded-xl bg-slate-950/40 border border-slate-800">
                  কোনো অর্ডার পাওয়া যায়নি। অনুগ্রহ করে সঠিক অর্ডার নম্বর বা মোবাইল নম্বর দিন।
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
