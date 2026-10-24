import { Order, NewsTickerConfig, CustomNewsTickerItem } from "../types";
import { toBn } from "./order";

export interface OrderNewsItem {
  id: string;
  kind?: "order" | "custom";
  orderNo: string;
  customerDisplay: string;
  itemDisplay: string;
  headline: string;
  badgeText: string;
  timeLabel: string;
  isCompleted: boolean;
  isCustomHeadline?: boolean;
}

export const DEFAULT_NEWS_TICKER_CONFIG: NewsTickerConfig = {
  isEnabled: true,
  showAutoLastOrders: true,
  autoOrderCount: 3,
  autoOrderOverrides: {},
  customItems: [],
};

const DEFAULT_FALLBACK_NEWS: OrderNewsItem[] = [
  {
    id: "seed-news-1",
    kind: "order",
    orderNo: "NG-9841",
    customerDisplay: "রহিম ভাই",
    itemDisplay: "লুইস সুয়ারেজ প্যাক",
    headline: "রহিম ভাই এই মাত্র তার জন্য লুইস সুয়ারেজ প্যাক কিনে নিল!",
    badgeText: "ডেলিভারি সম্পন্ন",
    timeLabel: "এই মাত্র",
    isCompleted: true,
  },
  {
    id: "seed-news-2",
    kind: "order",
    orderNo: "NG-9839",
    customerDisplay: "সাকিব ভাই",
    itemDisplay: "ইকার ক্যাসিয়াস প্যাক",
    headline: "সাকিব ভাই এই মাত্র তার জন্য ইকার ক্যাসিয়াস প্যাক কিনে নিল!",
    badgeText: "ডেলিভারি সম্পন্ন",
    timeLabel: "২ মিনিট আগে",
    isCompleted: true,
  },
  {
    id: "seed-news-3",
    kind: "order",
    orderNo: "NG-9835",
    customerDisplay: "তানভীর ভাই",
    itemDisplay: "১,০০০ কয়েন",
    headline: "তানভীর ভাই এই মাত্র তার জন্য ১,০০০ কয়েন কিনে নিল!",
    badgeText: "ডেলিভারি সম্পন্ন",
    timeLabel: "৫ মিনিট আগে",
    isCompleted: true,
  },
];

export function formatCustomerNameWithHonorific(rawName?: string): string {
  const cleaned = (rawName || "").trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "রহিম ভাই";
  }

  const lower = cleaned.toLowerCase();
  if (
    cleaned.endsWith("ভাই") ||
    cleaned.endsWith("আপু") ||
    cleaned.endsWith("ভাইয়া") ||
    cleaned.endsWith("ভাইয়া") ||
    lower.endsWith("bhai") ||
    lower.endsWith("vai")
  ) {
    return cleaned;
  }

  return `${cleaned} ভাই`;
}

export function formatPurchasedItemForNews(order: Pick<Order, "packageName" | "items" | "coins">): string {
  const combinedText = [
    order.packageName || "",
    ...(order.items || []).map((item) => item.name || ""),
  ]
    .join(" ")
    .toLowerCase();

  const hasSuarez =
    combinedText.includes("suárez") ||
    combinedText.includes("suarez") ||
    combinedText.includes("সুয়ারেজ") ||
    combinedText.includes("সুয়ারেজ");

  const hasCasillas =
    combinedText.includes("casillas") ||
    combinedText.includes("ক্যাসিয়াস") ||
    combinedText.includes("ক্যাসিয়াস");

  if (hasSuarez && hasCasillas) {
    return "লুইস সুয়ারেজ ও ইকার ক্যাসিয়াস কম্বো প্যাক";
  }
  if (hasSuarez) {
    return "লুইস সুয়ারেজ প্যাক";
  }
  if (hasCasillas) {
    return "ইকার ক্যাসিয়াস প্যাক";
  }

  const totalCoins =
    typeof order.coins === "number" && order.coins > 0
      ? order.coins
      : (order.items || []).reduce(
          (sum, item) => sum + (item.coins ? item.coins * (item.quantity || 1) : 0),
          0
        );

  if (totalCoins > 0) {
    return `${toBn(totalCoins)} কয়েন`;
  }

  const pkgClean = (order.packageName || "").trim();
  if (pkgClean) {
    return pkgClean;
  }

  return "স্পেশাল কয়েন প্যাক";
}

export function buildOrderNewsItem(order: Order, index = 0): OrderNewsItem {
  const customerDisplay = formatCustomerNameWithHonorific(order.name);
  const itemDisplay = formatPurchasedItemForNews(order);
  const headline = `${customerDisplay} এই মাত্র তার জন্য ${itemDisplay} কিনে নিল!`;
  const isCompleted = order.status === "completed";

  const timeLabels = ["এই মাত্র", "কিছুক্ষণ আগে", "অর্ডার সম্পন্ন"];
  const timeLabel = timeLabels[index % timeLabels.length];

  return {
    id: `order-news-${order.orderNo || index}`,
    kind: "order",
    orderNo: order.orderNo || `NG-${1000 + index}`,
    customerDisplay,
    itemDisplay,
    headline,
    badgeText: isCompleted ? "অর্ডার কমপ্লিট" : "নতুন অর্ডার",
    timeLabel,
    isCompleted,
  };
}

export function getLatestThreeOrderNews(orders: Order[], maxCount = 3): OrderNewsItem[] {
  const limit = Math.max(1, Math.min(20, Number(maxCount) || 3));
  const validOrders = (orders || []).filter(
    (ord) => ord && ord.status !== "cancelled" && !ord.isFakeOrInvalidStrike
  );

  const completedOrders = validOrders.filter((ord) => ord.status === "completed");
  const nonCompletedOrders = validOrders.filter((ord) => ord.status !== "completed");

  const prioritized = [...completedOrders, ...nonCompletedOrders];
  const selectedNews: OrderNewsItem[] = [];

  for (let i = 0; i < prioritized.length && selectedNews.length < limit; i++) {
    selectedNews.push(buildOrderNewsItem(prioritized[i], selectedNews.length));
  }

  let fallbackIdx = 0;
  while (selectedNews.length < limit && fallbackIdx < DEFAULT_FALLBACK_NEWS.length) {
    selectedNews.push(DEFAULT_FALLBACK_NEWS[fallbackIdx]);
    fallbackIdx++;
  }

  return selectedNews.slice(0, limit);
}

export function buildCustomNewsItem(item: CustomNewsTickerItem): OrderNewsItem {
  const cleanHeadline = (item.headline || "").trim();
  const cleanBadge = (item.badgeText || "").trim() || "জরুরি ঘোষণা";
  return {
    id: item.id,
    kind: "custom",
    orderNo: "",
    customerDisplay: "",
    itemDisplay: "",
    headline: cleanHeadline,
    badgeText: cleanBadge,
    timeLabel: "লাইভ আপডেট",
    isCompleted: true,
    isCustomHeadline: true,
  };
}

export function buildActiveNewsTickerItems(
  orders: Order[],
  config?: Partial<NewsTickerConfig>
): OrderNewsItem[] {
  const effectiveConfig: NewsTickerConfig = {
    ...DEFAULT_NEWS_TICKER_CONFIG,
    ...(config || {}),
    autoOrderOverrides: config?.autoOrderOverrides || {},
    customItems: Array.isArray(config?.customItems) ? config!.customItems : [],
  };

  if (effectiveConfig.isEnabled === false) {
    return [];
  }

  // 1. Collect all active admin custom news items (supports 1 item, 10 items, or any count)
  const customNews: OrderNewsItem[] = effectiveConfig.customItems
    .filter((item) => item && item.isActive && (item.headline || "").trim().length > 0)
    .map(buildCustomNewsItem);

  // 2. Collect automatic recent order items if enabled (default: last 3 orders)
  let autoOrderNews: OrderNewsItem[] = [];
  if (effectiveConfig.showAutoLastOrders !== false) {
    const rawAutoOrders = getLatestThreeOrderNews(orders, effectiveConfig.autoOrderCount || 3);
    autoOrderNews = rawAutoOrders
      .filter((item) => {
        const override =
          effectiveConfig.autoOrderOverrides[item.id] ||
          effectiveConfig.autoOrderOverrides[item.orderNo];
        return !override?.hidden;
      })
      .map((item) => {
        const override =
          effectiveConfig.autoOrderOverrides[item.id] ||
          effectiveConfig.autoOrderOverrides[item.orderNo];
        if (!override) return item;
        const hasEditedHeadline = Boolean(override.headline && override.headline.trim().length > 0);
        const hasEditedBadge = Boolean(override.badgeText && override.badgeText.trim().length > 0);
        return {
          ...item,
          headline: hasEditedHeadline ? override.headline!.trim() : item.headline,
          badgeText: hasEditedBadge ? override.badgeText!.trim() : item.badgeText,
          isCustomHeadline: hasEditedHeadline ? true : item.isCustomHeadline,
        };
      });
  }

  return [...customNews, ...autoOrderNews];
}
