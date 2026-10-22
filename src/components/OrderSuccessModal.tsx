import React from "react";
import { CheckCircle2, Sparkles, FileText, ShoppingBag, X } from "lucide-react";
import { Order } from "../types";
import { toBn } from "../utils/order";

interface Props {
  order: Order;
  onViewReceipt: () => void;
  onClose: () => void;
}

export function OrderSuccessModal({ order, onViewReceipt, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#0b1326] to-slate-950 border-2 border-emerald-500/50 rounded-3xl shadow-2xl p-6 text-center space-y-5 overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Animated Icon */}
        <div className="relative mx-auto w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-bounce">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <div className="absolute -top-1 -right-1 text-amber-300 animate-spin">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
            <span>🎉 অর্ডার সফলভাবে কনফার্ম হয়েছে!</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            ধন্যবাদ, {order.name}!
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে। অর্ডার নম্বর <span className="font-mono font-bold text-cyan-300">#{order.orderNo}</span>। ৫-১০ মিনিটের মধ্যে ইন-গেম কয়েন ডেলিভারি সম্পন্ন করা হবে।
          </p>
        </div>

        {/* Summary Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">প্যাকেজ:</span>
            <span className="font-bold text-white text-right truncate max-w-[200px]">{order.packageName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">মূল্য:</span>
            <span className="font-bold text-emerald-400">৳ {toBn(order.price)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">পেমেন্ট মেথড:</span>
            <span className="font-semibold text-slate-200">{order.paymentMethod}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={() => {
              onViewReceipt();
            }}
            className="py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <FileText className="w-4 h-4" />
            <span>ডিজিটাল রশিদ দেখুন</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>হোমে ফিরে যান</span>
          </button>
        </div>
      </div>
    </div>
  );
}
