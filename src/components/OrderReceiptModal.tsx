import React from "react";
import { Order } from "../types";
import { SITE } from "../config";
import { 
  CheckCircle2, 
  Clock, 
  Printer, 
  X, 
  AlertTriangle,
  Gift
} from "lucide-react";
import { toBn } from "../utils/order";

interface Props {
  order: Order;
  onClose: () => void;
  onOpenLiveChat?: (phone: string, orderNo?: string) => void;
}

export function OrderReceiptModal({ order, onClose }: Props) {
  const getStatusBadge = () => {
    switch (order.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            কমপ্লিটেড (Completed)
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            প্রসেসিং (Processing)
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            ক্যানসেলড (Cancelled)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            পেন্ডিং (Pending)
          </span>
        );
    }
  };

  const formattedDate = new Date(order.time).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <style>{`
        @media print {
          body, html {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          #digital-receipt-printable, #digital-receipt-printable * {
            visibility: visible !important;
          }
          #digital-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 10px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          @page {
            size: portrait;
            margin: 10mm;
          }
        }
      `}</style>

      <div 
        id="digital-receipt-printable"
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black flex flex-col"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 bg-slate-950/80 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              অফিসিয়াল ডিজিটাল রশিদ (Digital Receipt)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-5 sm:p-6 space-y-4 print:p-4 print:text-black">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:border-gray-300">
            <div className="flex items-center gap-3">
              <img
                src={SITE.logo}
                alt={SITE.name}
                className="w-10 h-10 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800 shadow"
              />
              <div>
                <h3 className="font-extrabold text-base text-white print:text-black">{SITE.name}</h3>
                <p className="text-[10px] text-emerald-400 print:text-gray-600">{SITE.tagline}</p>
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge()}
              <div className="text-[11px] text-slate-400 mt-1 font-mono print:text-gray-600">
                #{order.orderNo}
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="text-xs text-slate-400 print:text-gray-600 flex justify-between">
            <span>তারিখ: {formattedDate}</span>
            <span className="font-bold text-emerald-400 print:text-black">ডিজিটাল ক্যাশমেমো</span>
          </div>

          {/* Clean Receipt Summary: Customer Name, Product Taken, Price, Payment Method (No Sensitive Info) */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-3 print:bg-gray-50 print:border-gray-300 print:text-black">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 print:border-gray-200">
              <span className="text-xs text-slate-400 print:text-gray-600">গ্রাহকের নাম:</span>
              <span className="text-sm font-bold text-white print:text-black">{order.name}</span>
            </div>

            <div className="space-y-2 pb-2 border-b border-slate-800 print:border-gray-200">
              <span className="text-xs text-slate-400 print:text-gray-600 block">অর্ডারকৃত পণ্য / আইটেম:</span>
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 print:text-black">{item.name} ({item.quantity}টি)</span>
                    <span className="font-bold text-emerald-400 print:text-black">৳ {toBn(item.price * item.quantity)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 print:text-black">{order.packageName}</span>
                  <span className="font-bold text-emerald-400 print:text-black">৳ {toBn(order.price)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 print:text-gray-600">পেমেন্ট মেথড:</span>
              <span className="font-semibold text-white print:text-black">{order.paymentMethod}</span>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800 print:border-gray-300 font-extrabold">
              <span className="text-slate-200 print:text-black">সর্বমোট মূল্য:</span>
              <span className="text-emerald-400 print:text-black text-base">৳ {toBn(order.price)}</span>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400 print:text-gray-600">
              ধন্যবাদ আমাদের সাথে থাকার জন্য! NextGen Efootball-এর পক্ষ থেকে আপনাকে স্বাগতম।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
