import React from "react";
import { CheckCircle2, Sparkles, FileText, ShoppingBag, X, MessageCircle } from "lucide-react";
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

        {/* Auto-created Account Credentials Notice */}
        {order.autoAccountCreated && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-slate-900 to-emerald-950/70 border border-cyan-500/40 text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                <span>🎉 আপনার জন্য নতুন অ্যাকাউন্ট তৈরি হয়েছে!</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                অটোমেটিক
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              আপনি পূর্বে অ্যাকাউন্ট না খোলায় আপনার দেওয়া মোবাইল নম্বর দিয়ে স্বয়ংক্রিয়ভাবে একটি অ্যাকাউন্ট তৈরি করা হয়েছে:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">ইউজারনেম</span>
                <span className="font-bold text-white text-[11px]">{order.phone}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">ডিফল্ট পাসওয়ার্ড</span>
                <span className="font-bold text-amber-300 text-[11px]">{order.autoAccountDefaultPass || order.phone}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              💡 আপনি নিচে <b>"প্রোফাইল"</b> আইকনে গিয়ে যেকোনো সময় আপনার পাসওয়ার্ড ও প্রোফাইল তথ্য পরিবর্তন করে নিতে পারবেন।
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <a
            href={`https://wa.me/8801575887881?text=${encodeURIComponent(
              `আসসালামু আলাইকুম NextGen Efootball, আমি এইমাত্র একটি অর্ডার করেছি!\n\n🆔 অর্ডার নং: #${order.orderNo}\n👤 নাম: ${order.name}\n📦 প্যাকেজ: ${order.packageName}\n💰 মূল্য: ৳${order.price}\n\nদয়া করে দ্রুত ডেলিভারি সম্পন্ন করবেন।`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-emerald-600/30"
          >
            <MessageCircle className="w-4 h-4" />
            <span>অ্যাডমিনকে WhatsApp-এ মেসেজ দিন (অর্ডার দ্রুত পেতে)</span>
          </a>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => {
                onViewReceipt();
              }}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <FileText className="w-4 h-4" />
              <span>ডিজিটাল রশিদ দেখুন</span>
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>হোমে ফিরে যান</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
