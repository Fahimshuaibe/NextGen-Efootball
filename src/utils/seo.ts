import { CatalogProduct } from "../types";

export const CANONICAL_ORIGIN = "https://www.nextgenefootball.store";
export const BRAND_NAME = "NextGen Efootball";
export const DEFAULT_OG_IMAGE = `${CANONICAL_ORIGIN}/assets/aistudio/20260627_002155_69284c16.png`;

export type SeoViewKey =
  | "home"
  | "player_pack"
  | "combo"
  | "regular"
  | "how_to_order"
  | "faq"
  | "order_verify"
  | "track_order"
  | "customer_account"
  | "order_receipt"
  | "admin_panel";

export interface SeoPageMeta {
  viewKey: SeoViewKey;
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  robots: string;
  isSensitive: boolean;
}

const SENSITIVE_PATH_PREFIXES = [
  "/admin",
  "/account",
  "/checkout",
  "/receipt",
  "/track",
  "/otp",
  "/login",
  "/payment",
  "/api",
];

/**
 * Normalizes a pathname and determines whether the URL path itself represents
 * a sensitive route that must never be indexed by search engines.
 */
export function isSensitivePath(pathname: string): boolean {
  const clean = (pathname || "/").trim().toLowerCase();
  return SENSITIVE_PATH_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`)
  );
}

/**
 * Maps URL pathname and active UI state into a deterministic SeoViewKey.
 */
export function resolveSeoViewKey(params: {
  pathname?: string;
  activeTab?: string;
  orderStep?: "step1_info" | "step2_methods" | "step3_verify";
  showAdminPanel?: boolean;
  showAccountModal?: boolean;
  showTrackModal?: boolean;
  hasActiveReceipt?: boolean;
  hasSuccessOrder?: boolean;
  showHowToOrderModal?: boolean;
}): SeoViewKey {
  if (params.showAdminPanel) return "admin_panel";
  if (params.hasActiveReceipt || params.hasSuccessOrder) return "order_receipt";
  if (params.showAccountModal) return "customer_account";
  if (params.showTrackModal) return "track_order";
  if (params.orderStep && params.orderStep !== "step1_info") return "order_verify";
  if (params.showHowToOrderModal) return "how_to_order";

  const cleanPath = (params.pathname || "/").trim().toLowerCase();
  if (cleanPath.startsWith("/admin")) return "admin_panel";
  if (cleanPath.startsWith("/account") || cleanPath.startsWith("/login") || cleanPath.startsWith("/otp")) {
    return "customer_account";
  }
  if (cleanPath.startsWith("/track")) return "track_order";
  if (cleanPath.startsWith("/receipt")) return "order_receipt";
  if (cleanPath.startsWith("/checkout") || cleanPath.startsWith("/payment")) return "order_verify";
  if (cleanPath.startsWith("/player-packs")) return "player_pack";
  if (cleanPath.startsWith("/coin-combos")) return "combo";
  if (cleanPath.startsWith("/regular-coins")) return "regular";
  if (cleanPath.startsWith("/how-to-order")) return "how_to_order";
  if (cleanPath.startsWith("/faq")) return "faq";

  if (params.activeTab === "player_pack") return "player_pack";
  if (params.activeTab === "combo") return "combo";
  if (params.activeTab === "regular") return "regular";

  return "home";
}

/**
 * Generates complete SEO metadata for the given view key and pathname.
 * Ensures sensitive pages (orders, payments, OTP, receipts, customer account, admin)
 * always receive `noindex, nofollow, noarchive, nosnippet`.
 */
export function getSeoMetaForView(
  viewKey: SeoViewKey,
  pathname = "/"
): SeoPageMeta {
  const pathForceNoindex = isSensitivePath(pathname);

  const pages: Record<SeoViewKey, Omit<SeoPageMeta, "viewKey">> = {
    home: {
      title: "NextGen Efootball | eFootball Coin Top Up BD ও প্লেয়ার প্যাক",
      description:
        "NextGen Efootball বাংলাদেশে বিশ্বস্ত eFootball 2026 কয়েন টপ-আপ, কম্বো অফার ও লুইস সুয়ারেজ/ক্যাসিয়াস প্লেয়ার প্যাক স্টোর। বিকাশ, নগদ ও ব্যাংকে ৫-১০ মিনিটে ডেলিভারি।",
      canonicalUrl: `${CANONICAL_ORIGIN}/`,
      ogTitle: "NextGen Efootball — eFootball 2026 Coin Top Up Bangladesh ও প্লেয়ার প্যাক",
      ogDescription:
        "বাংলাদেশে সবচেয়ে দ্রুত ও নিরাপদ eFootball 2026 অফিশিয়াল কয়েন টপ-আপ, স্পেশাল কম্বো অফার এবং লেজেন্ডারি প্লেয়ার প্যাক। বিকাশ, নগদ, রকেট ও ব্যাংকে সহজে অর্ডার করুন।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      isSensitive: false,
    },
    player_pack: {
      title: "eFootball Player Packs BD — সুয়ারেজ ও ক্যাসিয়াস | NextGen Efootball",
      description:
        "eFootball 2026 লেজেন্ডারি প্লেয়ার প্যাক — Starter Set Luis Suárez + 50 Coins, Iker Casillas + 100 Coins ও কম্বো বান্ডেল বাংলাদেশে সেরা দামে কিনুন NextGen Efootball থেকে।",
      canonicalUrl: `${CANONICAL_ORIGIN}/player-packs`,
      ogTitle: "eFootball 2026 Player Packs Bangladesh — Luis Suárez & Iker Casillas",
      ogDescription:
        "CF 99 Luis Suárez, GK 100 Iker Casillas এবং স্পেশাল প্লেয়ার কম্বো প্যাক ইন-গেম কয়েনসহ ফাস্ট ডেলিভারি।",
      ogImage: `${CANONICAL_ORIGIN}/assets/aistudio/combo_suarez_casillas.png`,
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      isSensitive: false,
    },
    combo: {
      title: "eFootball Coin Combo Offer BD — ১৫০০ ও ২৫০০ কয়েন | NextGen Efootball",
      description:
        "eFootball 2026 কয়েন কম্বো অফার বাংলাদেশ — ১৫০০ কয়েন (1000+500) ও ২৫০০ কয়েন (2000+500) স্পেশাল ডিসকাউন্ট প্যাক বিকাশ ও নগদে দ্রুত টপ-আপ করুন।",
      canonicalUrl: `${CANONICAL_ORIGIN}/coin-combos`,
      ogTitle: "eFootball Coin Combo Packs BD — বেশি কয়েনে বাড়তি সেভিংস | NextGen Efootball",
      ogDescription:
        "একসাথে ১৫০০ বা ২৫০০ eFootball কয়েন কম্বো প্যাক নিয়ে বাড়তি সেভিংস উপভোগ করুন। ৫-১০ মিনিটে নিরাপদ Konami ID লগইন টপ-আপ।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      isSensitive: false,
    },
    regular: {
      title: "eFootball Coins Price in BD — ১০০ থেকে ১৫০০০ কয়েন | NextGen Efootball",
      description:
        "বাংলাদেশে অফিশিয়াল রেটে eFootball 2026 রেগুলার কয়েন প্রাইস লিস্ট — ১০০, ৩০০, ৫০০, ১০০০, ২০০০, ৩০০০, ৫০০০, ১০০০০ ও ১৫০০০ কয়েন ইনস্ট্যান্ট ইন-গেম টপ-আপ।",
      canonicalUrl: `${CANONICAL_ORIGIN}/regular-coins`,
      ogTitle: "eFootball Coins Price List Bangladesh — ইনস্ট্যান্ট টপ-আপ | NextGen Efootball",
      ogDescription:
        "১০০ কয়েন থেকে ১৫,০০০ কয়েন পর্যন্ত সকল রেগুলার eFootball কয়েন প্যাকেজ বিকাশ, নগদ, রকেট, উপায় ও ব্যাংকে অর্ডার করুন।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      isSensitive: false,
    },
    how_to_order: {
      title: "কিভাবে eFootball কয়েন অর্ডার করবেন? ভিডিও গাইড | NextGen Efootball",
      description:
        "NextGen Efootball থেকে ধাপে ধাপে eFootball কয়েন ও প্লেয়ার প্যাক অর্ডার করার বাংলা ভিডিও টিউটোরিয়াল ও সহজ নিয়মাবলী দেখুন।",
      canonicalUrl: `${CANONICAL_ORIGIN}/how-to-order`,
      ogTitle: "কিভাবে অর্ডার করবেন? (How to Order eFootball Coins) | NextGen Efootball",
      ogDescription:
        "কয়েন সিলেক্ট করা থেকে শুরু করে Konami ID, পেমেন্ট ও ভেরিফাই করার সম্পূর্ণ বাংলা ভয়েসওভার ভিডিও গাইড।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      isSensitive: false,
    },
    faq: {
      title: "eFootball Coin Top Up FAQ ও নিয়মাবলী | NextGen Efootball",
      description:
        "বাংলাদেশে eFootball 2026 কয়েন টপ-আপ, ডেলিভারি সময়, পেমেন্ট মাধ্যম, Android/iOS সাপোর্ট এবং অ্যাকাউন্ট নিরাপত্তা সম্পর্কিত সকল প্রশ্নের উত্তর।",
      canonicalUrl: `${CANONICAL_ORIGIN}/faq`,
      ogTitle: "সচরাচর জিজ্ঞাসিত প্রশ্নাবলী (FAQ) | NextGen Efootball Bangladesh",
      ogDescription:
        "eFootball কয়েন কেনার নিয়ম, বিকাশ/নগদ পেমেন্ট, OTP ভেরিফিকেশন ও নিরাপদ টপ-আপ সম্পর্কে বিস্তারিত জানুন।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      isSensitive: false,
    },
    order_verify: {
      title: "পেমেন্ট ও অর্ডার ভেরিফিকেশন | NextGen Efootball",
      description: "আপনার অর্ডারের পেমেন্ট ও ট্রানজেকশন ভেরিফিকেশন সম্পন্ন করুন।",
      canonicalUrl: `${CANONICAL_ORIGIN}/`,
      ogTitle: "NextGen Efootball — নিরাপদ পেমেন্ট ভেরিফিকেশন",
      ogDescription: "আপনার অর্ডারের পেমেন্ট ভেরিফাই করুন।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "noindex, nofollow, noarchive, nosnippet",
      isSensitive: true,
    },
    track_order: {
      title: "অর্ডার ট্র্যাকিং (Track Order) | NextGen Efootball",
      description: "আপনার অর্ডার নম্বর বা মোবাইল নম্বর দিয়ে লাইভ অর্ডার স্ট্যাটাস ট্র্যাক করুন।",
      canonicalUrl: `${CANONICAL_ORIGIN}/`,
      ogTitle: "NextGen Efootball — লাইভ অর্ডার ট্র্যাকিং",
      ogDescription: "আপনার অর্ডারের বর্তমান অবস্থা জানুন।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "noindex, nofollow, noarchive, nosnippet",
      isSensitive: true,
    },
    customer_account: {
      title: "আমার অ্যাকাউন্ট ও প্রোফাইল | NextGen Efootball",
      description: "গ্রাহক প্রোফাইল, অর্ডার হিস্ট্রি ও অ্যাকাউন্ট ব্যবস্থাপনা।",
      canonicalUrl: `${CANONICAL_ORIGIN}/`,
      ogTitle: "NextGen Efootball — গ্রাহক অ্যাকাউন্ট",
      ogDescription: "আপনার ব্যক্তিগত অ্যাকাউন্ট ও অর্ডার ড্যাশবোর্ড।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "noindex, nofollow, noarchive, nosnippet",
      isSensitive: true,
    },
    order_receipt: {
      title: "অর্ডার রিসিট ও কনফার্মেশন | NextGen Efootball",
      description: "আপনার অর্ডারের ডিজিটাল রিসিট ও বিস্তারিত তথ্য।",
      canonicalUrl: `${CANONICAL_ORIGIN}/`,
      ogTitle: "NextGen Efootball — অর্ডার রিসিট",
      ogDescription: "আপনার অর্ডারের ডিজিটাল রিসিট।",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "noindex, nofollow, noarchive, nosnippet",
      isSensitive: true,
    },
    admin_panel: {
      title: "অ্যাডমিন কন্ট্রোল প্যানেল | NextGen Efootball",
      description: "NextGen Efootball সিকিউর অ্যাডমিন প্যানেল।",
      canonicalUrl: `${CANONICAL_ORIGIN}/`,
      ogTitle: "NextGen Efootball — Admin Panel",
      ogDescription: "Restricted admin area.",
      ogImage: DEFAULT_OG_IMAGE,
      robots: "noindex, nofollow, noarchive, nosnippet",
      isSensitive: true,
    },
  };

  const base = pages[viewKey] || pages.home;
  if (pathForceNoindex) {
    return {
      ...base,
      viewKey,
      robots: "noindex, nofollow, noarchive, nosnippet",
      isSensitive: true,
    };
  }

  return {
    ...base,
    viewKey,
  };
}

export interface BilingualFaqItem {
  questionBn: string;
  questionEn: string;
  answerBn: string;
  answerEn: string;
}

export const SEO_FAQ_ITEMS: BilingualFaqItem[] = [
  {
    questionBn: "NextGen Efootball থেকে eFootball কয়েন বা প্লেয়ার প্যাক অর্ডার করার নিয়ম কী?",
    questionEn: "How to order eFootball coins or player packs from NextGen Efootball?",
    answerBn:
      "প্রথমে আপনার পছন্দের কয়েন প্যাক বা প্লেয়ার প্যাক সিলেক্ট করে 'এখনই কিনুন' বাটনে ক্লিক করুন। এরপর আপনার ডিভাইস (Android/iOS), Konami ID/Gmail, পাসওয়ার্ড, নাম ও WhatsApp নম্বর দিন। পরের ধাপে বিকাশ, নগদ, রকেট, উপায়, সেলফিন বা ব্যাংক (NPSB)-এ পেমেন্ট করে Transaction ID বা লাস্ট ৩ ডিজিট দিয়ে VERIFY বাটনে চাপলেই অর্ডার সম্পন্ন হবে।",
    answerEn:
      "Select your desired eFootball coin package or player pack, enter your Konami ID/email, password, name, and active WhatsApp/contact details, then complete payment via bKash, Nagad, Rocket, Upay, Cellfin, or Bank NPSB transfer and verify with your Transaction ID or last 3 digits.",
  },
  {
    questionBn: "অর্ডার করার কত সময়ের মধ্যে কয়েন ডেলিভারি পাওয়া যায়?",
    questionEn: "How long does eFootball coin top-up delivery take in Bangladesh?",
    answerBn:
      "এডমিন অনলাইন থাকলে সাধারণত ৫ থেকে ১০ মিনিটের মধ্যে আপনার গেম অ্যাকাউন্টে অফিশিয়াল ইন-গেম কয়েন ও প্লেয়ার প্যাক ডেলিভারি সম্পন্ন করা হয়। লগইনের সময় আপনার ইমেইলে যাওয়া Konami OTP কোডটি আমাদের WhatsApp/Facebook/Telegram-এ পাঠাতে হবে।",
    answerEn:
      "When our admin is online, orders are typically completed within 5 to 10 minutes via official in-game top-up after you share the 5-minute Konami verification OTP.",
  },
  {
    questionBn: "কয়েন টপ-আপ করার জন্য আমার Konami অ্যাকাউন্ট কি সম্পূর্ণ নিরাপদ?",
    questionEn: "Is my Konami ID safe during eFootball coin top-up?",
    answerBn:
      "হ্যাঁ, ১০০% নিরাপদ। আমরা অফিশিয়াল মেথডে সরাসরি ইন-গেম পারচেজের মাধ্যমে কয়েন ও প্লেয়ার প্যাক যুক্ত করি। টপ-আপ শেষ হওয়ার সাথে সাথে ডিভাইস থেকে লগআউট করা হয় এবং কোনো তথ্য সংরক্ষণ করা হয় না।",
    answerEn:
      "Yes, 100% safe. All top-ups are performed through official in-game purchases. We log out immediately after completing your order.",
  },
  {
    questionBn: "Android এবং iOS (iPhone) উভয় ডিভাইসেই কি কয়েন ও প্লেয়ার প্যাক পাওয়া যাবে?",
    questionEn: "Are eFootball coins and player packs available for both Android and iOS?",
    answerBn:
      "Android ডিভাইসে সকল রেগুলার কয়েন প্যাক, কম্বো প্যাক এবং প্লেয়ার প্যাক (কয়েনসহ) সম্পূর্ণ চালু আছে। তবে iOS/iPhone ডিভাইসে কয়েন ট্রান্সফার বন্ধ থাকায় iOS গ্রাহকরা শুধুমাত্র প্লেয়ার প্যাক (যেমন: Luis Suárez বা Iker Casillas কার্ড) অর্ডার করতে পারবেন।",
    answerEn:
      "Android players receive both eFootball coins and player packs. For iOS/iPhone users, only the player cards inside Player Packs are available as coins do not transfer across OS platforms.",
  },
  {
    questionBn: "পেমেন্ট করার জন্য কী কী মাধ্যম চালু আছে?",
    questionEn: "What payment methods are supported in Bangladesh?",
    answerBn:
      "বাংলাদেশের যেকোনো প্রান্ত থেকে বিকাশ (bKash), নগদ (Nagad), রকেট (Rocket), উপায় (Upay), সেলফিন (Cellfin) এবং ব্যাংক একাউন্টে (Trust Bank ও Islami Bank NPSB Instant Transfer) পেমেন্ট করতে পারবেন। নিজের নম্বর অথবা দোকানের নম্বর—দুইভাবেই পেমেন্ট করার সুবিধা রয়েছে।",
    answerEn:
      "We accept bKash, Nagad, Rocket, Upay, Cellfin, and instant Bank NPSB transfers (Trust Bank PLC & Islami Bank Bangladesh PLC). Both personal payments and mobile shop payments are supported.",
  },
];

/**
 * Builds truthful Schema.org JSON-LD (@graph with Organization, WebSite, ItemList, and FAQPage).
 * Strictly avoids any fake ratings, fake reviews, or unverified claims.
 */
export function buildStructuredDataJsonLd(products: CatalogProduct[]): Record<string, unknown> {
  const activeProducts = products.filter((p) => p.isActive);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${CANONICAL_ORIGIN}/#organization`,
        name: BRAND_NAME,
        alternateName: ["NextGen eFootball BD", "নেক্সটজেন ইফুটবল"],
        url: `${CANONICAL_ORIGIN}/`,
        logo: {
          "@type": "ImageObject",
          url: DEFAULT_OG_IMAGE,
          width: 512,
          height: 512,
        },
        areaServed: {
          "@type": "Country",
          name: "Bangladesh",
          identifier: "BD",
        },
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: "+8801575887881",
            contactType: "customer support",
            areaServed: "BD",
            availableLanguage: ["bn", "en"],
          },
        ],
        sameAs: [
          "https://facebook.com/nextgenefootball01",
          "https://wa.me/8801575887881",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${CANONICAL_ORIGIN}/#website`,
        url: `${CANONICAL_ORIGIN}/`,
        name: BRAND_NAME,
        description:
          "বাংলাদেশে বিশ্বস্ত eFootball 2026 অফিশিয়াল কয়েন টপ-আপ, কম্বো অফার ও স্পেশাল প্লেয়ার প্যাক প্ল্যাটফর্ম।",
        publisher: {
          "@id": `${CANONICAL_ORIGIN}/#organization`,
        },
        inLanguage: ["bn-BD", "en-BD"],
      },
      {
        "@type": "ItemList",
        "@id": `${CANONICAL_ORIGIN}/#catalog`,
        name: "eFootball 2026 Coin Packages & Player Packs in Bangladesh",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: activeProducts.length,
        itemListElement: activeProducts.map((prod, idx) => {
          const imageUrl = prod.image
            ? prod.image.startsWith("http")
              ? prod.image
              : `${CANONICAL_ORIGIN}${prod.image}`
            : DEFAULT_OG_IMAGE;

          return {
            "@type": "ListItem",
            position: idx + 1,
            item: {
              "@type": "Product",
              "@id": `${CANONICAL_ORIGIN}/#product-${prod.id}`,
              sku: prod.id,
              name: prod.name,
              description:
                prod.description ||
                prod.subtitle ||
                `${prod.name} — অফিশিয়াল eFootball 2026 ইন-গেম টপ-আপ বাংলাদেশ`,
              image: imageUrl,
              brand: {
                "@type": "Brand",
                name: "eFootball / Konami",
              },
              offers: {
                "@type": "Offer",
                url: `${CANONICAL_ORIGIN}/#product-card-${prod.id}`,
                priceCurrency: "BDT",
                price: String(prod.price),
                availability: "https://schema.org/InStock",
                seller: {
                  "@id": `${CANONICAL_ORIGIN}/#organization`,
                },
              },
            },
          };
        }),
      },
      {
        "@type": "FAQPage",
        "@id": `${CANONICAL_ORIGIN}/#faq`,
        mainEntity: SEO_FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: `${item.questionBn} (${item.questionEn})`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${item.answerBn} ${item.answerEn}`,
          },
        })),
      },
    ],
  };
}

/**
 * Applies the resolved SEO metadata to the live browser DOM (`document.head`).
 */
export function applySeoMetaToDom(
  meta: SeoPageMeta,
  products: CatalogProduct[]
): void {
  if (typeof document === "undefined") return;

  document.title = meta.title;

  const setMetaTag = (
    attrName: "name" | "property",
    attrValue: string,
    content: string
  ) => {
    let el = document.head.querySelector(
      `meta[${attrName}="${attrValue}"]`
    ) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  setMetaTag("name", "description", meta.description);
  setMetaTag("name", "robots", meta.robots);
  setMetaTag("name", "googlebot", meta.robots);

  setMetaTag("property", "og:title", meta.ogTitle);
  setMetaTag("property", "og:description", meta.ogDescription);
  setMetaTag("property", "og:url", meta.canonicalUrl);
  setMetaTag("property", "og:image", meta.ogImage);
  setMetaTag("property", "og:site_name", BRAND_NAME);
  setMetaTag("property", "og:type", "website");
  setMetaTag("property", "og:locale", "bn_BD");

  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", meta.ogTitle);
  setMetaTag("name", "twitter:description", meta.ogDescription);
  setMetaTag("name", "twitter:image", meta.ogImage);

  let canonicalLink = document.head.querySelector(
    'link[rel="canonical"]'
  ) as HTMLLinkElement | null;
  if (!canonicalLink) {
    canonicalLink = document.createElement("link");
    canonicalLink.setAttribute("rel", "canonical");
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute("href", meta.canonicalUrl);

  // Update dynamic JSON-LD structured data script
  let ldScript = document.getElementById(
    "nextgen-seo-jsonld"
  ) as HTMLScriptElement | null;
  if (!ldScript) {
    ldScript = document.createElement("script");
    ldScript.id = "nextgen-seo-jsonld";
    ldScript.type = "application/ld+json";
    document.head.appendChild(ldScript);
  }
  ldScript.textContent = JSON.stringify(buildStructuredDataJsonLd(products));
}
