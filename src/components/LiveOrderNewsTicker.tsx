import React, { useEffect, useState } from "react";
import { CheckCircle2, Flame, Megaphone, Radio, Sparkles } from "lucide-react";
import { getOrders, getNewsTickerConfig } from "../utils/storage";
import { buildActiveNewsTickerItems, OrderNewsItem } from "../utils/orderNews";

export const LiveOrderNewsTicker: React.FC = () => {
  const [newsItems, setNewsItems] = useState<OrderNewsItem[]>(() =>
    buildActiveNewsTickerItems(getOrders(), getNewsTickerConfig())
  );

  useEffect(() => {
    const refreshNews = () => {
      const latestOrders = getOrders();
      const tickerConfig = getNewsTickerConfig();
      setNewsItems(buildActiveNewsTickerItems(latestOrders, tickerConfig));
    };

    refreshNews();
    window.addEventListener("nextgen_orders_updated", refreshNews);
    window.addEventListener("nextgen_news_ticker_updated", refreshNews);
    window.addEventListener("storage", refreshNews);
    return () => {
      window.removeEventListener("nextgen_orders_updated", refreshNews);
      window.removeEventListener("nextgen_news_ticker_updated", refreshNews);
      window.removeEventListener("storage", refreshNews);
    };
  }, []);

  if (newsItems.length === 0) {
    return null;
  }

  // Repeat items so that even 1 single item or 10+ items scroll seamlessly in a continuous TV ticker loop
  const basePass =
    newsItems.length === 1
      ? [newsItems[0], newsItems[0], newsItems[0]]
      : newsItems.length === 2
      ? [...newsItems, ...newsItems]
      : newsItems;
  const repeatedTickerItems = [...basePass, ...basePass];
  const marqueeClass =
    newsItems.length >= 6 ? "animate-news-marquee-long" : "animate-news-marquee";

  return (
    <div
      id="live-order-news-ticker"
      aria-label="লাইভ নিউজ ও অর্ডার আপডেট"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950 border border-cyan-500/35 shadow-[0_8px_30px_rgba(6,182,212,0.12)]"
    >
      {/* Subtle top highlight line like a TV broadcast ticker */}
      <div className="h-[2px] w-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400" />

      <div className="flex items-stretch">
        {/* Left TV Broadcast LIVE Badge */}
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white font-extrabold text-[11px] sm:text-sm tracking-wide shadow-md z-10 border-r border-rose-400/30">
          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-85" />
            <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-white" />
          </span>
          <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200 animate-pulse shrink-0 hidden sm:inline" />
          <span className="whitespace-nowrap">লাইভ নিউজ</span>
          <span className="hidden sm:inline whitespace-nowrap">আপডেট</span>
        </div>

        {/* Continuous News Channel Marquee Stream (No 1,2,3 numbering) */}
        <div className="relative flex-1 overflow-hidden flex items-center py-2.5 bg-slate-950/80">
          {/* Left & Right subtle fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-950 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-950 to-transparent z-10" />

          <div className={`${marqueeClass} items-center`}>
            {repeatedTickerItems.map((item, idx) => {
              const isCustomAnnouncement = item.kind === "custom";
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="inline-flex items-center gap-2.5 px-5 sm:px-7 text-xs sm:text-sm whitespace-nowrap"
                >
                  {isCustomAnnouncement ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                      <Megaphone className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{item.badgeText || "জরুরি ঘোষণা"}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{item.badgeText || "অর্ডার আপডেট"}</span>
                    </span>
                  )}

                  {item.isCustomHeadline || isCustomAnnouncement ? (
                    <span className="text-slate-100 font-bold tracking-wide">
                      {item.headline}
                    </span>
                  ) : (
                    <span className="text-slate-100 font-medium">
                      <strong className="text-amber-300 font-extrabold">
                        {item.customerDisplay}
                      </strong>{" "}
                      এই মাত্র তার জন্য{" "}
                      <strong className="text-cyan-300 font-extrabold">
                        {item.itemDisplay}
                      </strong>{" "}
                      কিনে নিল!
                    </span>
                  )}

                  {!isCustomAnnouncement && !item.isCustomHeadline && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>({item.badgeText})</span>
                    </span>
                  )}

                  <span className="text-slate-600 select-none pl-2">•</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Live Broadcast Pill (Desktop/Tablet) - No 1,2,3 numbering */}
        <div className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-slate-900/95 border-l border-slate-800 text-[11px] font-bold text-slate-300 shrink-0">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-cyan-300">অফিসিয়াল ব্রেকিং আপডেট</span>
        </div>
      </div>
    </div>
  );
};
