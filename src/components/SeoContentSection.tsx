import React, { useState } from "react";
import { SEO_FAQ_ITEMS } from "../utils/seo";
import {
  HelpCircle,
  ChevronDown,
  ShieldCheck,
  Zap,
  Coins,
  Smartphone,
  CreditCard,
  CheckCircle2,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

interface Props {
  onNavigateCategory: (categoryId: string, sectionId: string) => void;
  onOpenHowToOrder: () => void;
}

export const SeoContentSection: React.FC<Props> = ({
  onNavigateCategory,
  onOpenHowToOrder,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <section
      id="seo-faq-guide"
      aria-labelledby="seo-guide-heading"
      className="relative z-10 max-w-6xl mx-auto px-4 pb-12 space-y-8 w-full scroll-mt-20"
    >
      {/* 1. BILINGUAL SEO OVERVIEW & INTERNAL LINK HUB */}
      <article className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-extrabold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>বাংলাদেশ অফিসিয়াল ইফুটবল গাইড • Official eFootball Guide BD</span>
            </span>
            <h2
              id="seo-guide-heading"
              className="text-lg sm:text-2xl font-black text-white leading-snug"
            >
              NextGen Efootball — বাংলাদেশে বিশ্বস্ত eFootball 2026 Coin Top Up ও প্লেয়ার প্যাক স্টোর
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Trusted eFootball 2026 Coins, Discount Combo Packs &amp; Legendary Player Packs (Luis Suárez, Iker Casillas) in Bangladesh with Instant bKash, Nagad, Rocket, Upay, Cellfin &amp; Bank NPSB Delivery.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenHowToOrder}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 border border-cyan-400/50 text-cyan-300 text-xs font-extrabold transition cursor-pointer shrink-0"
          >
            <span>🎬 কিভাবে অর্ডার করবেন? (ভিডিও গাইড)</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Bilingual Feature Pillars (Semantic H3s) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              অফিসিয়াল কয়েন ও প্লেয়ার প্যাক (Official eFootball Coins &amp; Packs)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              ১০০ কয়েন থেকে ১৫,০০০ কয়েন পর্যন্ত সকল রেগুলার কয়েন প্যাক, ১৫০০ ও ২৫০০ কয়েনের স্পেশাল সেভিংস কম্বো এবং{" "}
              <strong className="text-slate-100">Luis Suárez + 50 Coins</strong> ও{" "}
              <strong className="text-slate-100">Iker Casillas + 100 Coins</strong> স্টার্টার প্যাক সরাসরি আপনার গেম আইডিতে যুক্ত করা হয়।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              সহজ বাংলাদেশি পেমেন্ট (bKash, Nagad, Rocket, Upay &amp; Bank)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              বিকাশ, নগদ, রকেট, উপায়, সেলফিন অথবা ব্যাংক একাউন্টে (Trust Bank ও Islami Bank NPSB Instant Transfer) পেমেন্ট করে আপনার নিজের নম্বর বা দোকানের নম্বরের শেষ ৩ ডিজিট দিয়ে সাথে সাথে অর্ডার কনফার্ম করতে পারবেন।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              ১০০% নিরাপদ Konami ID টপ-আপ ও ফাস্ট ডেলিভারি
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              আমরা ১০০% অফিশিয়াল ইন-গেম স্টোর থেকে কয়েন পারচেজ করি। এডমিন অনলাইন থাকলে ৫–১০ মিনিটে OTP ভেরিফিকেশনের মাধ্যমে টপ-আপ সম্পন্ন করে সাথে সাথে লগআউট করা হয়।
            </p>
          </div>
        </div>

        {/* Crawlable Internal Quick-Navigation Links */}
        <nav
          aria-label="প্যাকেজ ও গাইড কুইক লিংক"
          className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-slate-400 font-bold mr-1">দ্রুত যান (Quick Links):</span>
          <a
            href="#section-block-player_pack"
            onClick={(e) => {
              e.preventDefault();
              onNavigateCategory("player_pack", "section-block-player_pack");
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 font-bold transition"
          >
            ⚽ প্লেয়ার প্যাক (Player Packs)
          </a>
          <a
            href="#section-block-combo"
            onClick={(e) => {
              e.preventDefault();
              onNavigateCategory("combo", "section-block-combo");
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 font-bold transition"
          >
            🎁 কয়েন কম্বো অফার (Coin Combos)
          </a>
          <a
            href="#section-block-regular"
            onClick={(e) => {
              e.preventDefault();
              onNavigateCategory("regular", "section-block-regular");
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 font-bold transition"
          >
            💎 রেগুলার কয়েন লিস্ট (Regular Coins)
          </a>
          <a
            href="#order-section"
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-emerald-300 font-bold transition"
          >
            🛒 অর্ডার ফরম (Order Form)
          </a>
        </nav>
      </article>

      {/* 2. BILINGUAL FAQ SECTION (Matches FAQPage Schema.org Structured Data) */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>সচরাচর জিজ্ঞাসিত প্রশ্নাবলী (Frequently Asked Questions)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              eFootball Coin Top Up Bangladesh, Payment, OTP এবং ডেলিভারি সম্পর্কিত সাধারণ প্রশ্ন ও উত্তর
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {SEO_FAQ_ITEMS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-slate-950/90 border border-slate-800/90 overflow-hidden transition"
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-900/80 transition cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <span className="block text-xs sm:text-sm font-extrabold text-white">
                        {faq.questionBn}
                      </span>
                      <span className="block text-[11px] font-semibold text-cyan-400/90">
                        {faq.questionEn}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-cyan-400" : ""
                      }`}
                    />
                  </button>
                </h3>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-2 text-xs text-slate-300 leading-relaxed">
                    <p>{faq.answerBn}</p>
                    <p className="text-slate-400 italic">{faq.answerEn}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
