import React from "react";

interface PaymentLogoBadgeProps {
  methodId: string;
  size?: "sm" | "md" | "lg";
}

export function PaymentLogoBadge({ methodId, size = "md" }: PaymentLogoBadgeProps) {
  const scaleClass =
    size === "sm"
      ? "scale-90"
      : size === "lg"
      ? "scale-105"
      : "scale-100";

  if (methodId === "bkash") {
    return (
      <div className={`inline-flex items-center gap-1.5 select-none ${scaleClass}`}>
        <span className="font-extrabold tracking-tight text-xl sm:text-2xl text-slate-900">
          <span className="text-[#e2136e] font-normal">b</span>Kash
        </span>
        {/* Origami Bird SVG */}
        <svg className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" viewBox="0 0 48 48" fill="none">
          <polygon points="10,8 28,12 22,28" fill="#e2136e" />
          <polygon points="28,12 38,22 22,28" fill="#c2105d" />
          <polygon points="22,28 38,22 18,42" fill="#9e0b4b" />
          <polygon points="38,22 44,20 40,25" fill="#e2136e" />
        </svg>
      </div>
    );
  }

  if (methodId === "nagad") {
    return (
      <div className={`inline-flex items-center gap-2 select-none ${scaleClass}`}>
        {/* Nagad Flame Circle */}
        <svg className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="18" stroke="#f6921e" strokeWidth="4" fill="#fff7ed" />
          <path d="M18 30C18 22 26 14 32 18C28 24 28 30 22 32" fill="#e52d27" />
          <circle cx="24" cy="24" r="5" fill="#f6921e" />
        </svg>
        <div className="text-left leading-none">
          <span className="block font-black text-xl sm:text-2xl text-[#e52d27]">নগদ</span>
          <span className="block text-[8px] font-bold text-slate-500 mt-0.5">ডিজিটাল লেনদেন</span>
        </div>
      </div>
    );
  }

  if (methodId === "rocket") {
    return (
      <div className={`inline-flex items-center gap-1.5 select-none ${scaleClass}`}>
        <div className="relative">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black tracking-wider text-[#8c3494] uppercase block">
              ROCKET
            </span>
            <svg className="w-4 h-4 text-[#8c3494]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </div>
          <span className="block font-black text-xl sm:text-2xl text-[#8c3494] leading-none">
            রকেট
          </span>
          <span className="block text-[8px] font-semibold text-[#8c3494]/80 mt-0.5">
            ডাচ্-বাংলা ব্যাংক মোবাইল ব্যাংকিং
          </span>
        </div>
      </div>
    );
  }

  if (methodId === "upay") {
    return (
      <div className={`inline-flex flex-col items-center justify-center select-none ${scaleClass}`}>
        <div className="flex items-center">
          <svg className="w-8 h-6 sm:w-9 sm:h-7" viewBox="0 0 48 36" fill="none">
            <circle cx="14" cy="7" r="4" fill="#fbbf24" />
            <circle cx="34" cy="7" r="4" fill="#005baa" />
            <path
              d="M14 14C14 23 24 27 24 27"
              stroke="#fbbf24"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M34 14C34 23 24 27 24 27"
              stroke="#005baa"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="font-black text-base sm:text-lg text-slate-900 leading-none">উপায়</span>
      </div>
    );
  }

  if (methodId === "cellfin") {
    return (
      <div className={`inline-flex items-center gap-2 select-none ${scaleClass}`}>
        <div className="w-7 h-9 rounded-md bg-[#008542] flex flex-col items-center justify-between p-1 text-white shrink-0">
          <span className="text-[9px] font-black text-amber-300">CF</span>
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>
        <div className="text-left leading-none">
          <div className="font-black text-lg sm:text-xl tracking-tight">
            <span className="text-[#e52d27]">Cell</span>
            <span className="text-[#008542] italic">fin</span>
          </div>
          <span className="block text-[8px] font-semibold text-slate-500 mt-0.5">
            Banking and beyond
          </span>
        </div>
      </div>
    );
  }

  // Default: Bank Account (NPSB)
  return (
    <div className={`inline-flex items-center gap-2 select-none ${scaleClass}`}>
      <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-600/30 flex items-center justify-center text-blue-700 shrink-0">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <polygon points="12 2 2 7 22 7 12 2" />
          <line x1="6" y1="10" x2="6" y2="17" />
          <line x1="10" y1="10" x2="10" y2="17" />
          <line x1="14" y1="10" x2="14" y2="17" />
          <line x1="18" y1="10" x2="18" y2="17" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </svg>
      </div>
      <div className="text-left leading-tight">
        <span className="block font-black text-sm sm:text-base text-slate-900">
          ব্যাংক একাউন্ট
        </span>
        <span className="block text-[9px] font-extrabold text-blue-700">
          NPSB (Trust / Islami Bank)
        </span>
      </div>
    </div>
  );
}
