import React, { useMemo, useState, useEffect } from "react";
import { 
  SITE, 
  PAYMENTS, 
  BANK_ACCOUNTS,
  REGULAR_PACKAGES, 
  COIN_COMBOS, 
  PLAYER_PACKS, 
  ALL_OFFERS,
  SHEET_WEBHOOK_URL,
  type PaymentMethod
} from "./config";
import { 
  Order, 
  OrderStatus, 
  CartItem, 
  ShopSettings, 
  CustomerAccount, 
  RegisteredUserAccount,
  ProductSortOption,
  ContactMethod,
  ServiceMethod,
  LiveChatMessage 
} from "./types";
import { 
  saveOrder, 
  getOrders,
  getAdminOnlineStatus, 
  getShopSettings, 
  isPhoneBlocked, 
  getActiveCustomerPhone, 
  getCustomerAccount,
  getActiveUserAccount,
  getOrCreateUserForGuestOrder,
  isUserUsingDefaultPassword,
  getLiveChatMessages 
} from "./utils/storage";
import { generateUniqueOrderId } from "./utils/orderNotification";
import { 
  formatBdWhatsappForUrl, 
  formatBdPhonePretty, 
  convertBnToEnDigits,
  isValidBdPhone,
  isValidTrxId,
  toBn,
  filterAndSortPackages,
  getSortOptionLabel,
  getSmartSearchSuggestions,
  extractRequestedCoinAmount,
  validateOrderStepOne,
  validateAndFormatPaymentProof,
  type SearchableCatalogItem,
  type SmartSearchSuggestion
} from "./utils/order";
import { OrderReceiptModal } from "./components/OrderReceiptModal";
import { OrderSuccessModal } from "./components/OrderSuccessModal";
import { TrackOrderModal } from "./components/TrackOrderModal";
import { CustomerAccountModal } from "./components/CustomerAccountModal";
import { AdminPanel } from "./components/AdminPanel";
import { PaymentLogoBadge } from "./components/PaymentLogoBadge";
import { sendAutomaticAdminOrderAlert, sendCustomerOrderPlacedEmail } from "./utils/autoNotify";
import { 
  Check, 
  Copy, 
  MessageCircle, 
  ShieldCheck, 
  Zap, 
  Clock, 
  AlertCircle, 
  Sparkles,
  Flame,
  CheckCircle2,
  ChevronDown,
  ShoppingBag,
  HelpCircle,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Search,
  BadgeCheck,
  Star,
  Smartphone,
  Tag,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowRight,
  PhoneCall,
  User,
  ExternalLink,
  ShieldAlert,
  ThumbsUp,
  Gift,
  Headphones,
  Send,
  MessageSquare,
  Share2,
  Trophy,
  Coins,
  Layers,
  Home,
  SlidersHorizontal,
  X
} from "lucide-react";

interface FormState {
  device: "android" | "ios";
  serviceMethod: ServiceMethod;
  name: string;
  phone: string;
  contactMethod: ContactMethod;
  contactHandle: string;
  otpWhatsapp: string;
  konamiIdOrEmail: string;
  konamiPassword: string;
  agreeRegionChange: boolean;
  agreeThirtyMin: boolean;
  noIdReasons: string[];
  paymentLinkJapan: string;
  paymentLinkGmail: string;
  payment: string;
  paymentSource: "personal" | "shop" | "bank";
  shopLastDigits: string;
  senderBankAccountName: string;
  selectedBankId: string;
  senderNumber: string;
  trxId: string;
  customerNote: string;
}

const initialForm: FormState = {
  device: "android",
  serviceMethod: "konami_login",
  name: "",
  phone: "",
  contactMethod: "whatsapp",
  contactHandle: "",
  otpWhatsapp: "",
  konamiIdOrEmail: "",
  konamiPassword: "",
  agreeRegionChange: false,
  agreeThirtyMin: false,
  noIdReasons: [],
  paymentLinkJapan: "",
  paymentLinkGmail: "",
  payment: "bkash",
  paymentSource: "personal",
  shopLastDigits: "",
  senderBankAccountName: "",
  selectedBankId: "trust_bank",
  senderNumber: "",
  trxId: "",
  customerNote: "",
};

export default function App() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [orderStep, setOrderStep] = useState<"step1_info" | "step2_methods" | "step3_verify">("step1_info");
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [sameSender, setSameSender] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalSection, setAccountModalSection] = useState<"dashboard" | "orders" | "details" | "verify">("dashboard");
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [activeTab, setActiveTab] = useState<"all" | "regular" | "combos" | "playerPacks">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ProductSortOption>("default");
  const [showSortModal, setShowSortModal] = useState<boolean>(false);

  const [isAdminOnline, setIsAdminOnline] = useState<boolean>(getAdminOnlineStatus);
  const [shopSettings, setShopSettingsState] = useState<ShopSettings>(getShopSettings);
  const [activePhone, setActivePhone] = useState<string>(getActiveCustomerPhone);
  const [activeCustomer, setActiveCustomer] = useState<CustomerAccount | null>(null);
  const [activeUser, setActiveUser] = useState<RegisteredUserAccount | null>(getActiveUserAccount);

  useEffect(() => {
    const handleStatusUpdate = (e: any) => {
      if (e.detail !== undefined) {
        setIsAdminOnline(e.detail);
      } else {
        setIsAdminOnline(getAdminOnlineStatus());
      }
    };
    const handleSettingsUpdate = () => {
      setShopSettingsState(getShopSettings());
    };
    const handleAccountOrPhoneChange = () => {
      const u = getActiveUserAccount();
      setActiveUser(u);
      const p = u?.phone || getActiveCustomerPhone();
      setActivePhone(p);
      if (u) {
        setActiveCustomer(getCustomerAccount(u.id));
        setForm((prev) => ({
          ...prev,
          name: prev.name || u.name || u.username || "",
          phone: prev.phone || u.phone || "",
          otpWhatsapp: prev.otpWhatsapp || u.phone || "",
          senderNumber: prev.senderNumber || u.phone || "",
        }));
      } else if (p) {
        setActiveCustomer(getCustomerAccount(p));
      } else {
        setActiveCustomer(null);
      }
    };

    window.addEventListener("nextgen_admin_status_changed", handleStatusUpdate);
    window.addEventListener("nextgen_shop_settings_updated", handleSettingsUpdate);
    window.addEventListener("nextgen_customer_phone_changed", handleAccountOrPhoneChange);
    window.addEventListener("nextgen_user_account_updated", handleAccountOrPhoneChange);
    window.addEventListener("nextgen_orders_updated", handleAccountOrPhoneChange);

    handleAccountOrPhoneChange();

    return () => {
      window.removeEventListener("nextgen_admin_status_changed", handleStatusUpdate);
      window.removeEventListener("nextgen_shop_settings_updated", handleSettingsUpdate);
      window.removeEventListener("nextgen_customer_phone_changed", handleAccountOrPhoneChange);
      window.removeEventListener("nextgen_user_account_updated", handleAccountOrPhoneChange);
      window.removeEventListener("nextgen_orders_updated", handleAccountOrPhoneChange);
    };
  }, [activePhone]);

  // Unified Searchable Catalog (Supports English & Bengali queries + Nearest Coin matching)
  const searchableCatalog: SearchableCatalogItem[] = useMemo(() => {
    return [
      ...PLAYER_PACKS.map((p) => {
        const lowerTitle = `${p.title} ${p.subtitle || ""}`.toLowerCase();
        const playerAliases =
          lowerTitle.includes("suarez") || lowerTitle.includes("suárez") || lowerTitle.includes("সুয়ারেজ") || lowerTitle.includes("সুয়ারেজ")
            ? "luis suarez লুইস সুয়ারেজ সুয়ারেজ"
            : "";
        const casillasAliases =
          lowerTitle.includes("casillas") || lowerTitle.includes("ক্যাসিয়াস") || lowerTitle.includes("ক্যাসিয়াস")
            ? "iker casillas ইকার ক্যাসিয়াস ক্যাসিয়াস"
            : "";
        return {
          id: p.id,
          title: p.title,
          subtitle: p.subtitle || "স্পেশাল প্লেয়ার প্যাক",
          price: p.price,
          coins: p.coins,
          image: p.image,
          tag: p.tag,
          category: "playerPacks" as const,
          sectionId: `product-card-${p.id}`,
          keywords: `${playerAliases} ${casillasAliases} starter set player pack প্লেয়ার প্যাক ${p.title} ${p.subtitle || ""}`,
        };
      }),
      ...REGULAR_PACKAGES.map((r) => ({
        id: r.id,
        title: `${toBn(r.coins)} কয়েন (${r.coins} Coins)`,
        subtitle: "অফিসিয়াল রেগুলার কয়েন প্যাক",
        price: r.price,
        coins: r.coins,
        tag: r.tag,
        category: "regular" as const,
        sectionId: `product-card-${r.id}`,
        keywords: `${r.coins} coins coin কয়েন কয়েন রেগুলার টপআপ ${toBn(r.coins)}`,
      })),
      ...COIN_COMBOS.map((c) => ({
        id: c.id,
        title: `${toBn(c.coins)} কয়েন কম্বো (${c.parts})`,
        subtitle: c.description || "কম্বো কয়েন অফার",
        price: c.price,
        coins: c.coins,
        tag: c.tag,
        category: "combos" as const,
        sectionId: `product-card-${c.id}`,
        keywords: `${c.coins} combo coins কম্বো কয়েন কয়েন ${c.parts} ${toBn(c.coins)}`,
      })),
    ];
  }, []);

  const searchSuggestions = useMemo(() => {
    return getSmartSearchSuggestions(searchableCatalog, searchQuery, 6);
  }, [searchableCatalog, searchQuery]);

  const requestedCoinAmount = useMemo(() => {
    return extractRequestedCoinAmount(searchQuery);
  }, [searchQuery]);

  const hasExactCoinMatch = useMemo(() => {
    if (requestedCoinAmount === null) return true;
    return searchableCatalog.some((item) => item.coins === requestedCoinAmount);
  }, [searchableCatalog, requestedCoinAmount]);

  const handleSelectSearchSuggestion = (suggestion: SmartSearchSuggestion) => {
    setShowSearchDropdown(false);
    setActiveTab("all");
    setHighlightedProductId(suggestion.id);

    setTimeout(() => {
      const el = document.getElementById(`product-card-${suggestion.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);

    setTimeout(() => {
      setHighlightedProductId((prev) => (prev === suggestion.id ? null : prev));
    }, 4500);
  };

  // Filtered and Sorted Packages
  const filteredPlayerPacks = useMemo(() => {
    return filterAndSortPackages(
      PLAYER_PACKS,
      searchQuery,
      sortBy,
      (p) => `${p.title} ${p.subtitle || ""} ${p.tag || ""} প্লেয়ার প্যাক`
    );
  }, [searchQuery, sortBy]);

  const filteredCombos = useMemo(() => {
    return filterAndSortPackages(
      COIN_COMBOS,
      searchQuery,
      sortBy,
      (c) => `${c.coins} ${c.parts} ${c.description || ""} ${c.tag || ""} combo কম্বো কয়েন`
    );
  }, [searchQuery, sortBy]);

  const filteredRegularPackages = useMemo(() => {
    return filterAndSortPackages(
      REGULAR_PACKAGES,
      searchQuery,
      sortBy,
      (r) => `${r.coins} coins কয়েন কয়েন ${r.tag || ""}`
    );
  }, [searchQuery, sortBy]);

  const [showKonamiPassword, setShowKonamiPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedBankKey, setCopiedBankKey] = useState<string | null>(null);

  // All 6 payment methods combined with dynamic shop settings for bKash & Nagad
  const dynamicPayments: PaymentMethod[] = useMemo(() => {
    return PAYMENTS.map((pay) => {
      if (pay.id === "bkash" && shopSettings.bkashNumber) {
        return { ...pay, number: shopSettings.bkashNumber };
      }
      if (pay.id === "nagad" && shopSettings.nagadNumber) {
        return { ...pay, number: shopSettings.nagadNumber };
      }
      return pay;
    });
  }, [shopSettings]);

  const currentPay = useMemo(() => {
    return dynamicPayments.find((p) => p.id === form.payment) || dynamicPayments[0];
  }, [form.payment, dynamicPayments]);

  const selectedBankAccount = useMemo(() => {
    return BANK_ACCOUNTS.find((b) => b.id === form.selectedBankId) || BANK_ACCOUNTS[0];
  }, [form.selectedBankId]);

  // Check if current input phone is blocked
  const isInputPhoneBlocked = useMemo(() => {
    if (!form.phone) return false;
    return isPhoneBlocked(form.phone).blocked;
  }, [form.phone]);

  // Sync phone changes
  const handlePhoneChange = (val: string) => {
    const enVal = convertBnToEnDigits(val);
    setForm(prev => ({
      ...prev,
      phone: enVal,
      otpWhatsapp: sameWhatsapp ? enVal : prev.otpWhatsapp,
      senderNumber: sameSender ? enVal : prev.senderNumber
    }));
  };

  const handleWhatsappChange = (val: string) => {
    const enVal = convertBnToEnDigits(val);
    setForm(prev => ({ ...prev, otpWhatsapp: enVal }));
  };

  const handleToggleSameWhatsapp = () => {
    const nextVal = !sameWhatsapp;
    setSameWhatsapp(nextVal);
    if (nextVal && form.phone) {
      setForm(prev => ({ ...prev, otpWhatsapp: prev.phone }));
    }
  };

  const handleToggleSameSender = () => {
    const nextVal = !sameSender;
    setSameSender(nextVal);
    if (nextVal && form.phone) {
      setForm(prev => ({ ...prev, senderNumber: prev.phone }));
    }
  };

  // Cart operations
  const subtotalCartPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const finalPayablePrice = subtotalCartPrice;

  const totalCartCoins = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.coins ? item.coins * item.quantity : 0), 0);
  }, [cart]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (item: Omit<CartItem, "quantity">) => {
    if (form.device === "ios" && (item.category === "regular" || item.category === "combo")) {
      alert("⚠️ iOS ডিভাইসে কয়েন দেওয়া বন্ধ আছে। আপনি শুধু প্লেয়ার প্যাক নিতে পারবেন।");
      return;
    }
    const finalItem =
      form.device === "ios" && item.category === "player_pack"
        ? {
            ...item,
            coins: 0,
            name: `${item.name.replace(/\+\s*\d+\s*(কয়েন|Coins)/gi, "").trim()} (iOS - শুধু প্লেয়ার)`,
          }
        : item;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === finalItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === finalItem.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...finalItem, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.id === id) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const buyNow = (item: Omit<CartItem, "quantity">) => {
    if (form.device === "ios" && (item.category === "regular" || item.category === "combo")) {
      alert("⚠️ iOS ডিভাইসে কয়েন দেওয়া বন্ধ আছে। আপনি শুধু প্লেয়ার প্যাক নিতে পারবেন।");
      return;
    }
    const finalItem =
      form.device === "ios" && item.category === "player_pack"
        ? {
            ...item,
            coins: 0,
            name: `${item.name.replace(/\+\s*\d+\s*(কয়েন|Coins)/gi, "").trim()} (iOS - শুধু প্লেয়ার)`,
          }
        : item;

    setCart([{ ...finalItem, quantity: 1 }]);
    setOrderStep("step1_info");
    document.getElementById("order-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCopyPaymentNumber = (numToCopy?: string) => {
    navigator.clipboard.writeText(numToCopy || currentPay.number);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopyBankText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBankKey(key);
    setTimeout(() => setCopiedBankKey(null), 2000);
  };

  const navigateToSection = (tabId: "all" | "playerPacks" | "combos" | "regular", sectionId: string) => {
    setActiveTab(tabId);
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 40);
  };

  // Validate Step 1 (Konami ID/Pass + Name, Mobile & OTP Contact) and advance to Step 2 (Payment Grid)
  const handleNextToPaymentStep = () => {
    setFormError("");

    if (form.device === "ios") {
      const hasCoins = cart.some((i) => i.category === "regular" || i.category === "combo");
      if (hasCoins) {
        setFormError("⚠️ iOS ডিভাইসে কয়েন দেওয়া বন্ধ আছে। আপনি শুধু প্লেয়ার প্যাক নিতে পারবেন। কার্ট থেকে কয়েন প্যাক রিমুভ করুন।");
        return;
      }
    }

    const step1Check = validateOrderStepOne({
      cartCount: cart.length,
      konamiIdOrEmail: form.konamiIdOrEmail,
      konamiPassword: form.konamiPassword,
      name: form.name,
      phone: form.phone,
      contactMethod: form.contactMethod,
      otpWhatsapp: form.otpWhatsapp,
      sameWhatsapp,
      contactHandle: form.contactHandle,
    });

    if (!step1Check.ok) {
      setFormError(step1Check.error || "অনুগ্রহ করে সকল তথ্য সঠিকভাবে পূরণ করুন।");
      return;
    }

    const blockCheck = isPhoneBlocked(step1Check.cleanPhone || form.phone);
    if (blockCheck.blocked) {
      setFormError(
        `⛔ এই মোবাইল নম্বরটি সাময়িকভাবে ব্লক করা হয়েছে (${blockCheck.reason || "৩ বার ভুল তথ্যের জন্য"})। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করে আনব্লক করুন।`
      );
      return;
    }

    setOrderStep("step2_methods");
    setTimeout(() => {
      document.getElementById("order-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };

  // Select a payment method from Step 2 Grid -> open Step 3 Instructions & Verification
  const handleSelectPaymentMethod = (methodId: string) => {
    setFormError("");
    setForm((prev) => ({
      ...prev,
      payment: methodId,
      paymentSource: methodId === "bank" ? "bank" : prev.paymentSource === "bank" ? "personal" : prev.paymentSource,
    }));
    setOrderStep("step3_verify");
    setTimeout(() => {
      document.getElementById("order-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const step1Check = validateOrderStepOne({
      cartCount: cart.length,
      konamiIdOrEmail: form.konamiIdOrEmail,
      konamiPassword: form.konamiPassword,
      name: form.name,
      phone: form.phone,
      contactMethod: form.contactMethod,
      otpWhatsapp: form.otpWhatsapp,
      sameWhatsapp,
      contactHandle: form.contactHandle,
    });

    if (!step1Check.ok) {
      setFormError(step1Check.error || "অনুগ্রহ করে সকল তথ্য সঠিকভাবে পূরণ করুন।");
      setOrderStep("step1_info");
      return;
    }

    const cleanPhone = step1Check.cleanPhone!;
    const cleanWa = step1Check.cleanWa!;

    // Check block list
    const blockCheck = isPhoneBlocked(cleanPhone);
    if (blockCheck.blocked) {
      setFormError(`⛔ এই মোবাইল নম্বরটি সাময়িকভাবে ব্লক করা হয়েছে (${blockCheck.reason || "৩ বার ভুল তথ্যের জন্য"})। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করে আনব্লক করুন।`);
      return;
    }

    const proofCheck = validateAndFormatPaymentProof({
      paymentId: form.payment,
      paymentSource: form.payment === "bank" ? "bank" : form.paymentSource,
      customerPhone: cleanPhone,
      personalProofInput: form.trxId,
      shopLastDigits: form.shopLastDigits,
      senderBankAccountName: form.senderBankAccountName,
      targetBankName: selectedBankAccount.bankName,
    });

    if (!proofCheck.ok) {
      setFormError(proofCheck.error || "অনুগ্রহ করে পেমেন্টের সঠিক প্রমাণ দিন।");
      return;
    }

    setSending(true);

    const existingOrderIds = getOrders().map((o) => o.orderNo);
    const orderNo = generateUniqueOrderId(existingOrderIds);
    const nowIso = new Date().toISOString();
    const packageSummary = cart.length === 1 
      ? cart[0].name 
      : `${cart[0].name} + আরও ${cart.length - 1}টি আইটেম`;

    const resolvedContactHandle = form.contactMethod === "whatsapp" 
      ? cleanWa 
      : form.contactHandle.trim();

    // Auto-create account for guest user if not already logged in:
    // Username = mobile number, Password = mobile number
    let assignedUserId = activeUser?.id;
    let autoAccountCreated = false;
    let autoAccountDefaultPass = "";

    const orderCustomerEmail =
      activeUser?.email ||
      (form.konamiIdOrEmail.includes("@")
        ? form.konamiIdOrEmail.trim()
        : form.paymentLinkGmail?.includes("@")
        ? form.paymentLinkGmail.trim()
        : undefined);

    if (!assignedUserId) {
      const { user: linkedUser, isNewAccount } = getOrCreateUserForGuestOrder({
        phone: cleanPhone,
        name: form.name.trim(),
        email: orderCustomerEmail,
      });
      assignedUserId = linkedUser.id;
      autoAccountCreated = isNewAccount;
      autoAccountDefaultPass = cleanPhone;
      setActiveUser(linkedUser);
    }

    const newOrder: Order = {
      orderNo,
      time: nowIso,
      statusUpdatedAt: nowIso,
      statusHistory: [
        {
          status: "pending",
          updatedAt: nowIso,
          updatedBy: "customer",
          note: "অর্ডার তৈরি করা হয়েছে (Order Created)",
        },
      ],
      userId: assignedUserId,
      customerEmail: orderCustomerEmail,
      name: form.name.trim(),
      phone: cleanPhone,
      serviceMethod: "konami_login",
      contactMethod: form.contactMethod,
      contactHandle: resolvedContactHandle,
      otpWhatsapp: form.contactMethod === "whatsapp" ? cleanWa : cleanPhone,
      konamiIdOrEmail: form.konamiIdOrEmail.trim(),
      konamiPassword: form.konamiPassword.trim(),
      platform: "Android (Android Only)",
      items: cart,
      packageName: packageSummary,
      price: finalPayablePrice,
      coins: totalCartCoins,
      paymentMethod:
        form.payment === "bank"
          ? `Bank Account (${selectedBankAccount.bankName})`
          : currentPay.label,
      paymentSource: proofCheck.resolvedPaymentSource,
      shopLastDigits: proofCheck.cleanShopDigits,
      senderBankAccountName:
        form.payment === "bank" ? form.senderBankAccountName.trim() : undefined,
      targetBankName:
        form.payment === "bank" ? selectedBankAccount.bankName : undefined,
      senderNumber: proofCheck.finalSenderNumber!,
      trxId: proofCheck.finalTrxId!,
      status: "pending",
      customerNote: form.customerNote.trim() || undefined,
      autoAccountCreated,
      autoAccountDefaultPass: autoAccountCreated ? autoAccountDefaultPass : undefined,
    };

    saveOrder(newOrder);

    // Automatically notify Admin in the background (WhatsApp Bot + Email + Telegram) without needing customer's WhatsApp
    sendAutomaticAdminOrderAlert(newOrder).catch((err) =>
      console.warn("Background admin alert error:", err)
    );

    // Automatically send customer order confirmation email if customer has an email
    sendCustomerOrderPlacedEmail(newOrder, activeUser?.email).catch(() => {});

    if (SHEET_WEBHOOK_URL) {
      try {
        await fetch(SHEET_WEBHOOK_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newOrder),
        });
      } catch (err) {
        console.warn("Sheet webhook error:", err);
      }
    }

    setSending(false);
    setSuccessOrder(newOrder);

    // Reset form fields, step, and cart
    setCart([]);
    setOrderStep("step1_info");
    setForm(prev => ({
      ...prev,
      konamiPassword: "",
      paymentLinkJapan: "",
      shopLastDigits: "",
      senderBankAccountName: "",
      trxId: "",
      customerNote: ""
    }));
  };

  return (
    <div className="min-h-screen bg-[#070d1d] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden w-full max-w-full box-border">
      {/* Stadium Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
      </div>

      {/* TOP NOTIFICATION / ADMIN STATUS BAR */}
      <div className={`py-2 px-4 text-xs font-semibold text-center border-b transition-colors relative z-20 w-full ${
        isAdminOnline 
          ? "bg-gradient-to-r from-emerald-950/80 via-slate-950 to-emerald-950/80 border-emerald-500/30 text-emerald-300"
          : "bg-gradient-to-r from-rose-950/80 via-slate-950 to-rose-950/80 border-rose-500/30 text-rose-300"
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 px-1">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isAdminOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
          <span>
            {isAdminOnline 
              ? "🟢 এডমিন অনলাইন — এখন অর্ডার করলে সাথে সাথে ৫-১০ মিনিটে ফাস্ট ডেলিভারি পাবেন!" 
              : "🔴 এডমিন সাময়িক অফলাইন/ব্যস্ত — অর্ডার চালু আছে, অনলাইনে আসামাত্র সবার আগে আপনার ডেলিভারি দেওয়া হবে!"}
          </span>
        </div>
      </div>

      {/* MAIN NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 w-full">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand (Full clear visibility for NextGen Efootball) */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <img
                src={SITE.logo}
                alt={shopSettings.siteName}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-contain bg-slate-900 border border-cyan-500/30 shadow-md shadow-cyan-500/20"
              />
              <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded text-[8px] font-black bg-cyan-500 text-black uppercase">
                26
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-white text-base sm:text-xl tracking-tight leading-tight">
                  {shopSettings.siteName}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    isAdminOnline
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isAdminOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                    }`}
                  />
                  <span>{isAdminOnline ? "Online" : "Offline"}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{shopSettings.tagline}</p>
            </div>
          </div>

          {/* Right Header Controls — Profile & Cart */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Customer Profile Icon */}
            <button
              type="button"
              onClick={() => {
                setAccountModalSection("dashboard");
                setShowAccountModal(true);
              }}
              title="আমার অ্যাকাউন্ট ও প্রোফাইল"
              className="relative inline-flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400 text-slate-200 text-xs sm:text-sm font-bold transition cursor-pointer"
            >
              <User className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline">
                {activeUser ? (activeUser.name || activeUser.username) : "প্রোফাইল"}
              </span>
              {isUserUsingDefaultPassword(activeUser) && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-slate-950"></span>
                </span>
              )}
            </button>

            {/* Cart Trigger */}
            <a
              href="#order-section"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black text-xs sm:text-sm font-extrabold transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>কার্ট</span>
              <span className="px-1.5 py-0.5 rounded-full bg-black text-white text-[10px] font-mono font-bold">
                {toBn(totalCartCount)}
              </span>
            </a>
          </div>
        </div>
      </header>

      {/* OFFERS & PACKAGES SHOWCASE */}
      <section id="packages-showcase-section" className="relative z-10 max-w-6xl mx-auto px-4 pt-5 pb-10 space-y-6 w-full scroll-mt-20">
        {/* TOP SEARCH, CATEGORY & SORT FILTER BAR (With Live Smart Search Dropdown) */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/95 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-lg relative z-30">
          {/* Category Quick Select */}
          <div className="flex items-center gap-2 flex-1 relative">
            <select
              aria-label="প্যাকেজ ক্যাটাগরি ফিল্টার"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer shrink-0"
            >
              <option value="all">All Categories</option>
              <option value="playerPacks">প্লেয়ার প্যাক</option>
              <option value="combos">কয়েন কম্বো অফার</option>
              <option value="regular">রেগুলার কয়েন</option>
            </select>

            {/* Search Input + Live Dropdown List */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                placeholder="কয়েন বা প্যাক খুঁজুন (যেমন: 700 কয়েন, 800, Luis Suarez)..."
                className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearchDropdown(false);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <Search className="w-4 h-4 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>

            {/* LIVE SMART SEARCH DROPDOWN LIST (Full row width so mobile titles never clip) */}
            {showSearchDropdown && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-slate-950 border-2 border-cyan-500/40 shadow-2xl overflow-hidden z-50">
                <div className="px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {requestedCoinAmount !== null && !hasExactCoinMatch
                        ? `“${searchQuery}” নেই — সবচেয়ে কাছাকাছি কয়েন প্যাকসমূহ:`
                        : `সার্চ রেজাল্ট লিস্ট (ক্লিক করলে প্রোডাক্টে নিয়ে যাবে):`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSearchDropdown(false)}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer shrink-0"
                  >
                    বন্ধ করুন
                  </button>
                </div>

                {searchSuggestions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    কোনো মিল পাওয়া যায়নি। অন্য নাম বা কয়েন সংখ্যা লিখে চেষ্টা করুন।
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80">
                    {searchSuggestions.map((item) => (
                      <button
                        key={`suggest-${item.id}`}
                        type="button"
                        onClick={() => handleSelectSearchSuggestion(item)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-cyan-500/10 transition flex items-center justify-between gap-2.5 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-xs font-black text-cyan-300 shrink-0">
                              🪙
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-extrabold text-white text-xs sm:text-sm group-hover:text-cyan-300 transition">
                              {item.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.matchType === "nearby"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                }`}
                              >
                                {item.matchBadge}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {item.subtitle}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm block">
                            ৳ {toBn(item.price)}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-bold group-hover:underline">
                            প্রোডাক্টে যান →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sort By Filter Trigger Button (Opens Screenshot 3 Radio Selector) */}
          <button
            type="button"
            onClick={() => setShowSortModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 flex items-center justify-between sm:justify-center gap-2 cursor-pointer transition shrink-0"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>{getSortOptionLabel(sortBy)}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* NEARBY COIN MATCH INFO BANNER WHEN EXACT COIN AMOUNT DOES NOT EXIST */}
        {requestedCoinAmount !== null && !hasExactCoinMatch && (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <b>{toBn(requestedCoinAmount)} কয়েন</b> এর নির্দিষ্ট প্যাক নেই — তাই এর আশেপাশে সবচেয়ে কাছাকাছি কয়েন প্যাকগুলো (যেমন:{" "}
                <b>{toBn(filteredRegularPackages[0]?.coins || 750)} কয়েন</b>) নিচে দেখানো হচ্ছে:
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[11px] font-extrabold text-cyan-300 hover:underline self-start sm:self-auto cursor-pointer shrink-0"
            >
              সব প্যাক দেখুন
            </button>
          </div>
        )}

        {/* CATEGORY NAVIGATOR CARDS (Screenshot Box Style) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>প্যাকেজ ক্যাটাগরি (সহজে যেতে ক্লিক করুন):</span>
            </span>
            <span className="text-[11px] text-cyan-400 font-semibold hidden sm:inline">
              যেকোনো ঘরে ক্লিক করলে সরাসরি সেই সেকশনে নিয়ে যাবে
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Box 1: স্পেশাল প্লেয়ার প্যাক */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("playerPacks");
                setTimeout(() => {
                  document.getElementById("player-packs-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
              className={`p-2.5 sm:p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-lg group relative flex items-center gap-2.5 sm:gap-3.5 border ${
                activeTab === "playerPacks"
                  ? "bg-slate-900 border-cyan-400 ring-2 ring-cyan-500/40 shadow-cyan-500/20"
                  : "bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900"
              }`}
            >
              <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 transition ${
                activeTab === "playerPacks"
                  ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                  : "bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20"
              }`}>
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-white group-hover:text-cyan-300 transition leading-tight">
                  স্পেশাল প্লেয়ার প্যাক
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                  সুয়ারেজ, ক্যাসিয়াস প্যাক
                </div>
              </div>
            </button>

            {/* Box 2: কয়েন এর অফার */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("combos");
                setTimeout(() => {
                  document.getElementById("combos-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
              className={`p-2.5 sm:p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-lg group relative flex items-center gap-2.5 sm:gap-3.5 border ${
                activeTab === "combos"
                  ? "bg-slate-900 border-amber-400 ring-2 ring-amber-500/40 shadow-amber-500/20"
                  : "bg-slate-900/90 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900"
              }`}
            >
              <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 transition ${
                activeTab === "combos"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                  : "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20"
              }`}>
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-white group-hover:text-amber-300 transition leading-tight">
                  কয়েন এর অফার
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                  ডিসকাউন্ট কম্বো ও সেভার
                </div>
              </div>
            </button>

            {/* Box 3: রেগুলার কয়েন */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("regular");
                setTimeout(() => {
                  document.getElementById("regular-coins-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
              className={`p-2.5 sm:p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-lg group relative flex items-center gap-2.5 sm:gap-3.5 border ${
                activeTab === "regular"
                  ? "bg-slate-900 border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-500/20"
                  : "bg-slate-900/90 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900"
              }`}
            >
              <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 transition ${
                activeTab === "regular"
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30"
                  : "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20"
              }`}>
                <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-white group-hover:text-emerald-300 transition leading-tight">
                  রেগুলার কয়েন
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                  ১৩০ - ১২,৮০০ কয়েন সরাসরি
                </div>
              </div>
            </button>

            {/* Box 4: সব অফার একসাথে */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("all");
                setTimeout(() => {
                  document.getElementById("packages-showcase-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
              className={`p-2.5 sm:p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-lg group relative flex items-center gap-2.5 sm:gap-3.5 border ${
                activeTab === "all"
                  ? "bg-slate-900 border-teal-400 ring-2 ring-teal-500/40 shadow-teal-500/20"
                  : "bg-slate-900/90 border-slate-800 hover:border-teal-500/50 hover:bg-slate-900"
              }`}
            >
              <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 transition ${
                activeTab === "all"
                  ? "bg-teal-500 text-black shadow-md shadow-teal-500/30"
                  : "bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20"
              }`}>
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-white group-hover:text-teal-300 transition leading-tight">
                  সব অফার একসাথে
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                  সম্পূর্ণ প্যাকেজ ও প্রাইস তালিকা
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 1. PLAYER PACKS */}
        {(activeTab === "all" || activeTab === "playerPacks") && filteredPlayerPacks.length > 0 && (
          <div id="player-packs-section" className="space-y-3 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <span>⚽ লেজেন্ডারি প্লেয়ার প্যাক (ছবিসহ)</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  ইন-গেম কয়েন সহ
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {filteredPlayerPacks.map((pack) => (
                <div
                  key={pack.id}
                  id={`product-card-${pack.id}`}
                  className={`bg-slate-900/90 border rounded-2xl p-4 flex flex-col justify-between transition duration-300 group shadow-lg scroll-mt-28 ${
                    highlightedProductId === pack.id
                      ? "border-cyan-400 ring-2 ring-cyan-400/60 shadow-cyan-500/30"
                      : "border-slate-800 hover:border-cyan-500/40"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
                      <img
                        src={pack.image}
                        alt={pack.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      {pack.tag && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500 text-black">
                          {pack.tag}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-extrabold text-white text-sm group-hover:text-cyan-400 transition">
                        {pack.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{pack.subtitle}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">মূল্য:</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        ৳ {toBn(pack.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => addToCart({
                          id: pack.id,
                          name: pack.title,
                          price: pack.price,
                          coins: pack.coins,
                          image: pack.image,
                          category: "player_pack"
                        })}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                        title="কার্টে যোগ করুন"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => buyNow({
                          id: pack.id,
                          name: pack.title,
                          price: pack.price,
                          coins: pack.coins,
                          image: pack.image,
                          category: "player_pack"
                        })}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs transition cursor-pointer"
                      >
                        কিনুন
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. COMBO PACKS */}
        {(activeTab === "all" || activeTab === "combos") && filteredCombos.length > 0 && (
          <div id="combos-section" className="space-y-3 pt-2 scroll-mt-24">
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <span>🎁 কয়েন এর অফার ও কম্বো প্যাক</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                বেশি সেভিংস
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCombos.map((combo) => (
                <div
                  key={combo.id}
                  id={`product-card-${combo.id}`}
                  className={`bg-slate-900/90 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition duration-300 shadow-lg scroll-mt-28 ${
                    highlightedProductId === combo.id
                      ? "border-amber-400 ring-2 ring-amber-400/60 shadow-amber-500/30"
                      : "border-slate-800 hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                        {combo.tag || "কম্বো"}
                      </span>
                      <h3 className="font-extrabold text-white text-base mt-1.5">
                        {combo.coins} কয়েন কম্বো ({combo.parts})
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{combo.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xl font-black text-emerald-400 font-mono block">
                        ৳ {toBn(combo.price)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => addToCart({
                        id: combo.id,
                        name: `${combo.coins} কয়েন (${combo.parts})`,
                        price: combo.price,
                        coins: combo.coins,
                        category: "combo"
                      })}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>কার্টে যোগ</span>
                    </button>

                    <button
                      onClick={() => buyNow({
                        id: combo.id,
                        name: `${combo.coins} কয়েন (${combo.parts})`,
                        price: combo.price,
                        coins: combo.coins,
                        category: "combo"
                      })}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold text-xs transition cursor-pointer"
                    >
                      এখনই অর্ডার করুন
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. REGULAR PACKAGES */}
        {(activeTab === "all" || activeTab === "regular") && filteredRegularPackages.length > 0 && (
          <div id="regular-coins-section" className="space-y-3 pt-2 scroll-mt-24">
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <span>💎 রেগুলার কয়েন প্যাকেজসমূহ</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                অফিসিয়াল ইন-গেম রেট
              </span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
              {filteredRegularPackages.map((pkg, idx) => (
                <div
                  key={pkg.id}
                  id={`product-card-${pkg.id}`}
                  className={`bg-slate-900/90 border rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition duration-200 shadow-md relative scroll-mt-28 ${
                    highlightedProductId === pkg.id
                      ? "border-cyan-400 ring-2 ring-cyan-400/60 shadow-cyan-500/30"
                      : "border-slate-800 hover:border-cyan-500/40"
                  }`}
                >
                  {requestedCoinAmount !== null && !hasExactCoinMatch && idx === 0 ? (
                    <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-black shadow">
                      সবচেয়ে কাছাকাছি
                    </span>
                  ) : pkg.tag ? (
                    <span className={`absolute -top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow ${
                      pkg.tag === "সেরা দাম" 
                        ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-black" 
                        : "bg-cyan-500 text-black"
                    }`}>
                      {pkg.tag}
                    </span>
                  ) : null}

                  <div className="pt-1">
                    <div className="text-xs text-slate-400 font-semibold">eFootball কয়েন</div>
                    <div className="text-lg font-black text-white font-mono mt-0.5">
                      {toBn(pkg.coins)} 🪙
                    </div>
                    <div className="text-base font-black text-emerald-400 font-mono mt-1">
                      ৳ {toBn(pkg.price)}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                    <button
                      onClick={() => addToCart({
                        id: pkg.id,
                        name: `${pkg.coins} কয়েন`,
                        price: pkg.price,
                        coins: pkg.coins,
                        category: "regular"
                      })}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      title="Add to Cart"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => buyNow({
                        id: pkg.id,
                        name: `${pkg.coins} কয়েন`,
                        price: pkg.price,
                        coins: pkg.coins,
                        category: "regular"
                      })}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold text-[11px] transition cursor-pointer text-center"
                    >
                      কিনুন
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CHECKOUT & ORDER FORM SECTION */}
      <section id="order-section" className="relative z-10 max-w-4xl mx-auto px-4 pb-16 w-full">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl relative overflow-hidden">
          {/* Subtle Cyber Grid Accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Form Header */}
          <div className="border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyan-400" />
              <span>সহজ অর্ডার ফরম (Order Form)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              কয়েন বা প্যাক সিলেক্ট করে নিচের তথ্য পূরণ করে সহজে অর্ডার করুন
            </p>
          </div>

          {/* Selected Package / Cart Box + Quick Selector */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span>সিলেক্ট করা কয়েন / প্যাক ({toBn(totalCartCount)} টি)</span>
              </h3>

              {/* Quick Add/Switch Package Dropdown */}
              <select
                value=""
                onChange={(e) => {
                  const found = ALL_OFFERS.find((o) => o.id === e.target.value);
                  if (found) {
                    addToCart({
                      id: found.id,
                      name: found.name,
                      price: found.price,
                      coins: found.coins,
                      category: found.category as any
                    });
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-xs font-bold text-cyan-300 focus:outline-none cursor-pointer"
              >
                <option value="">+ এখান থেকে কয়েন বা প্যাক যোগ করুন...</option>
                {ALL_OFFERS.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.name} — ৳{toBn(offer.price)}
                  </option>
                ))}
              </select>
            </div>

            {cart.length === 0 ? (
              <div className="p-4 text-center text-xs text-amber-300 bg-amber-500/10 rounded-xl border border-amber-500/20">
                কোনো কয়েন বা প্যাক সিলেক্ট করা হয়নি! ওপরে থেকে বা ডানের অপশন থেকে কয়েন সিলেক্ট করুন।
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {cart.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs sm:text-sm truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400">
                          ৳ {toBn(item.price)}
                          {item.coins ? ` • ${toBn(item.coins)} কয়েন` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, -1)}
                          className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-mono text-xs font-bold text-white">
                          {toBn(item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-black text-emerald-400 text-xs sm:text-sm font-mono min-w-[60px] text-right">
                        ৳ {toBn(item.price * item.quantity)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        title="রিমুভ করুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-300 text-xs sm:text-sm">মোট পরিশোধযোগ্য টাকা:</span>
              <span className="font-black text-emerald-400 text-lg sm:text-xl font-mono">
                ৳ {toBn(finalPayablePrice)}
              </span>
            </div>
          </div>

          {/* Blocked Alert Banner if this phone is blocked */}
          {isInputPhoneBlocked && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-950/60 border-2 border-rose-500 text-rose-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm text-rose-300">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>⛔ এই মোবাইল নম্বরটি সাময়িকভাবে ব্লক করা হয়েছে!</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`https://wa.me/${formatBdWhatsappForUrl(shopSettings.whatsapp)}?text=${encodeURIComponent(`আমার নম্বর ${form.phone} ব্লক দেখাচ্ছে। দয়া করে আনব্লক করবেন?`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-500 text-black font-bold rounded-lg"
                >
                  হোয়াটসঅ্যাপে এডমিনকে জানান
                </a>
              </div>
            </div>
          )}

          {/* STEP PROGRESS INDICATOR */}
          <div className="mb-4 flex items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 rounded-2xl p-2.5 text-xs">
            <button
              type="button"
              onClick={() => setOrderStep("step1_info")}
              className={`flex-1 py-2 px-2.5 rounded-xl font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                orderStep === "step1_info"
                  ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                  : "bg-slate-900 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              <span>১. আইডি ও যোগাযোগ</span>
              {orderStep !== "step1_info" && <Check className="w-3.5 h-3.5" />}
            </button>

            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />

            <button
              type="button"
              onClick={() => {
                if (orderStep !== "step1_info") {
                  setOrderStep("step2_methods");
                } else {
                  handleNextToPaymentStep();
                }
              }}
              className={`flex-1 py-2 px-2.5 rounded-xl font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                orderStep === "step2_methods"
                  ? "bg-[#7c2ae8] text-white shadow-md shadow-purple-500/25"
                  : orderStep === "step3_verify"
                  ? "bg-slate-900 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              <span>২. পেমেন্ট মেথড</span>
              {orderStep === "step3_verify" && <Check className="w-3.5 h-3.5" />}
            </button>

            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />

            <div
              className={`flex-1 py-2 px-2.5 rounded-xl font-extrabold text-center transition ${
                orderStep === "step3_verify"
                  ? "bg-[#e2136e] text-white shadow-md shadow-pink-500/25"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              ৩. পেমেন্ট ভেরিফাই
            </div>
          </div>

          {/* MULTI-STEP ORDER FORM */}
          <form onSubmit={handleSubmitOrder} className="space-y-5">
            {/* ==================== STAGE 1: KONAMI ID/PASS + NAME, MOBILE & OTP CONTACT ==================== */}
            {orderStep === "step1_info" && (
              <>
                {/* DEVICE SELECTION: ANDROID / IOS */}
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <label className="block text-xs font-extrabold text-white">
                    আপনার গেম ডিভাইস সিলেক্ট করুন (Device) *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, device: "android" })}
                      className={`p-3 rounded-xl border-2 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        form.device === "android"
                          ? "bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/10"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-sm font-black">🤖 Android</span>
                      <span className="text-[10px] text-slate-300">কয়েন ও প্লেয়ার প্যাক দুটোই চালু</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, device: "ios" })}
                      className={`p-3 rounded-xl border-2 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        form.device === "ios"
                          ? "bg-rose-950/60 border-rose-400 text-rose-300 shadow-lg shadow-rose-500/10"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-sm font-black">🍏 iOS / iPhone</span>
                      <span className="text-[10px] text-slate-300">শুধু প্লেয়ার প্যাক (কয়েন বন্ধ)</span>
                    </button>
                  </div>

                  {form.device === "ios" && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>ios ডিভাইস এ কয়েন দেওয়া বন্ধ আছে। আপনি শুধু প্লেয়ার প্যাক নিতে পারবেন (সাথে থাকা কয়েন শো করবে না)।</span>
                    </div>
                  )}
                </div>

                {/* 1. KONAMI ID & PASSWORD LOGIN FORM */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h3 className="text-xs sm:text-sm font-extrabold text-cyan-400">
                    ১. আপনার Konami আইডি ও পাসওয়ার্ড দিন:
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        Konami ID অথবা জিমেইল *
                      </label>
                      <input
                        type="text"
                        value={form.konamiIdOrEmail}
                        onChange={(e) => setForm({ ...form, konamiIdOrEmail: e.target.value })}
                        placeholder="আপনার Konami ID বা Gmail লিখুন"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        Konami পাসওয়ার্ড *
                      </label>
                      <div className="relative">
                        <input
                          type={showKonamiPassword ? "text" : "password"}
                          value={form.konamiPassword}
                          onChange={(e) => setForm({ ...form, konamiPassword: e.target.value })}
                          placeholder="আপনার পাসওয়ার্ড লিখুন"
                          className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKonamiPassword(!showKonamiPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showKonamiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CUSTOMER NAME, PHONE & OTP CONTACT METHOD (WHATSAPP / FACEBOOK / TELEGRAM) */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-cyan-400">
                      ২. আপনার নাম, মোবাইল ও OTP যোগাযোগের মাধ্যম:
                    </h3>
                    <p className="text-[11px] text-amber-300 font-semibold mt-0.5">
                      ⚡ OTP নেওয়ার জন্য অবশ্যই আপনার WhatsApp নম্বর অথবা ফেসবুক আইডি অথবা টেলিগ্রাম আইডি দিন যেন আমরা সহজে যোগাযোগ করতে পারি
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        আপনার নাম *
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="আপনার নাম লিখুন"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        আপনার সচল মোবাইল নম্বর *
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {/* OTP Contact Method Selector: WhatsApp / Facebook / Telegram */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-3">
                    <label className="block text-xs font-extrabold text-white">
                      আপনার সাথে OTP ও যোগাযোগের জন্য কোনটি ব্যবহার করবেন? (যেকোনো একটি সিলেক্ট করুন) *
                    </label>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, contactMethod: "whatsapp" })}
                        className={`p-2.5 sm:p-3 rounded-xl border-2 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          form.contactMethod === "whatsapp"
                            ? "bg-emerald-950/50 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/10"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-extrabold">🟢 WhatsApp</span>
                        <span className="text-[10px] text-slate-400">হোয়াটসঅ্যাপ নম্বর</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, contactMethod: "facebook" })}
                        className={`p-2.5 sm:p-3 rounded-xl border-2 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          form.contactMethod === "facebook"
                            ? "bg-blue-950/50 border-blue-400 text-blue-300 shadow-md shadow-blue-500/10"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-extrabold">🔵 Facebook ID</span>
                        <span className="text-[10px] text-slate-400">ফেসবুক আইডি / লিংক</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, contactMethod: "telegram" })}
                        className={`p-2.5 sm:p-3 rounded-xl border-2 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          form.contactMethod === "telegram"
                            ? "bg-sky-950/50 border-sky-400 text-sky-300 shadow-md shadow-sky-500/10"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-extrabold">✈️ Telegram ID</span>
                        <span className="text-[10px] text-slate-400">টেলিগ্রাম আইডি / নম্বর</span>
                      </button>
                    </div>

                    {/* Dynamic Contact Input Based on Selected Method */}
                    {form.contactMethod === "whatsapp" && (
                      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-bold text-emerald-300">
                            আপনার WhatsApp নম্বর (OTP নেওয়ার জন্য) *
                          </label>
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sameWhatsapp}
                              onChange={handleToggleSameWhatsapp}
                              className="rounded accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span>উপরের মোবাইল নম্বরটাই</span>
                          </label>
                        </div>
                        <input
                          type="tel"
                          value={sameWhatsapp ? form.phone : form.otpWhatsapp}
                          onChange={(e) => handleWhatsappChange(e.target.value)}
                          disabled={sameWhatsapp}
                          placeholder="আপনার ১১ ডিজিটের WhatsApp নম্বর দিন (01XXXXXXXXX)"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-emerald-400 disabled:opacity-75"
                        />
                      </div>
                    )}

                    {form.contactMethod === "facebook" && (
                      <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
                        <label className="block text-xs font-bold text-blue-300">
                          আপনার ফেসবুক আইডি নাম অথবা প্রোফাইল লিংক দিন (OTP ও যোগাযোগের জন্য) *
                        </label>
                        <input
                          type="text"
                          value={form.contactHandle}
                          onChange={(e) => setForm({ ...form, contactHandle: e.target.value })}
                          placeholder="আপনার Facebook আইডির নাম অথবা প্রোফাইল লিংক পেস্ট করুন..."
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    )}

                    {form.contactMethod === "telegram" && (
                      <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-2">
                        <label className="block text-xs font-bold text-sky-300">
                          আপনার টেলিগ্রাম ইউজারনেম (@username) অথবা টেলিগ্রাম নম্বর দিন *
                        </label>
                        <input
                          type="text"
                          value={form.contactHandle}
                          onChange={(e) => setForm({ ...form, contactHandle: e.target.value })}
                          placeholder="যেমন: @username অথবা আপনার টেলিগ্রাম নম্বর লিখুন..."
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-400"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message on Step 1 */}
                {formError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* NEXT BUTTON TO OPEN PAYMENT OPTIONS */}
                <button
                  type="button"
                  onClick={handleNextToPaymentStep}
                  disabled={isInputPhoneBlocked}
                  className={`w-full py-4 rounded-2xl font-black text-base transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
                    isInputPhoneBlocked
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "bg-gradient-to-r from-[#7c2ae8] via-indigo-600 to-cyan-500 hover:from-[#6b21cf] hover:to-cyan-400 text-white shadow-purple-500/25"
                  }`}
                >
                  <span>Next — পেমেন্ট অপশনে যান (৳ {toBn(finalPayablePrice)})</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* ==================== STAGE 2: PAYMENT METHOD SELECTION GRID (LIKE SCREENSHOT 1) ==================== */}
            {orderStep === "step2_methods" && (
              <div className="rounded-3xl bg-[#f5f6fb] text-slate-900 p-4 sm:p-6 shadow-2xl border-2 border-indigo-200/80 space-y-5">
                {/* Back to Step 1 button */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setOrderStep("step1_info");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold transition cursor-pointer shadow-xs"
                  >
                    <span>← পেছনে যান (আইডি ও নম্বর পরিবর্তন)</span>
                  </button>
                  <span className="text-[11px] font-bold text-[#7c2ae8] bg-purple-100 px-2.5 py-1 rounded-full">
                    পেমেন্ট মেথড সিলেক্ট করুন
                  </span>
                </div>

                {/* Store Header (Screenshot 1 Style) */}
                <div className="text-center space-y-1.5 pt-1">
                  <div className="relative w-16 h-16 mx-auto rounded-full p-1 bg-white shadow-lg shadow-purple-500/20 border-2 border-purple-200 flex items-center justify-center">
                    <img
                      src={SITE.logo}
                      alt={shopSettings.siteName}
                      className="w-full h-full rounded-full object-contain bg-slate-950"
                    />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#6b21cf] tracking-tight">
                    {shopSettings.siteName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    গ্রাহক: <b className="text-slate-800">{form.name}</b> ({form.phone})
                  </p>

                  {/* Support Quick Icons (Headset, WhatsApp, Call) */}
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <a
                      href={`https://wa.me/${formatBdWhatsappForUrl(shopSettings.adminWhatsapp || shopSettings.whatsapp)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-blue-600 hover:bg-blue-50 transition"
                      title="Support"
                    >
                      <Headphones className="w-5 h-5" />
                    </a>
                    <a
                      href={`https://wa.me/${formatBdWhatsappForUrl(shopSettings.adminWhatsapp || shopSettings.whatsapp)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition"
                      title="WhatsApp Support"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </a>
                    <a
                      href={`tel:+${formatBdWhatsappForUrl(shopSettings.adminWhatsapp || shopSettings.whatsapp)}`}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition"
                      title="Call Support"
                    >
                      <PhoneCall className="w-5 h-5" />
                    </a>
                  </div>
                </div>

                {/* Category Header Bar (Screenshot 1 Style) */}
                <div className="grid grid-cols-2 gap-2.5 bg-slate-200/70 p-1.5 rounded-2xl">
                  <div className="py-2.5 px-3 rounded-xl bg-[#7c2ae8] text-white font-extrabold text-xs sm:text-sm text-center shadow-sm">
                    Mobile Banking
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod("bank")}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-blue-50 text-slate-700 font-extrabold text-xs sm:text-sm text-center shadow-xs transition cursor-pointer"
                  >
                    Bank Account (NPSB)
                  </button>
                </div>

                {/* 2-Column Payment Options Grid: bKash, Nagad, Rocket, Upay, Cellfin, Bank Account */}
                <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                  {dynamicPayments.map((pay) => {
                    const isSelected = form.payment === pay.id;
                    return (
                      <button
                        key={pay.id}
                        type="button"
                        onClick={() => handleSelectPaymentMethod(pay.id)}
                        className={`min-h-[82px] sm:min-h-[90px] p-3.5 rounded-2xl bg-white border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 shadow-xs hover:shadow-md ${
                          isSelected
                            ? "border-[#7c2ae8] ring-2 ring-[#7c2ae8]/20"
                            : "border-slate-200/90 hover:border-purple-400"
                        }`}
                      >
                        <PaymentLogoBadge methodId={pay.id} size="md" />
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Purple Pay Bar (Screenshot 1 Style) */}
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod(form.payment || "bkash")}
                  className="w-full py-4 rounded-2xl bg-[#7c2ae8] hover:bg-[#6b21cf] text-white font-black text-base sm:text-lg shadow-lg shadow-purple-600/30 transition cursor-pointer text-center"
                >
                  Pay {finalPayablePrice} BDT (৳ {toBn(finalPayablePrice)})
                </button>
              </div>
            )}

            {/* ==================== STAGE 3: PAYMENT INSTRUCTIONS & VERIFICATION (LIKE SCREENSHOT 2) ==================== */}
            {orderStep === "step3_verify" && (
              <div className="rounded-3xl bg-[#f5f6fb] text-slate-900 p-4 sm:p-6 shadow-2xl border-2 border-indigo-200/80 space-y-4">
                {/* Top Navigation Back to Payment Methods */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setOrderStep("step2_methods");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold transition cursor-pointer shadow-xs"
                  >
                    <span>← অন্য পেমেন্ট মেথড সিলেক্ট করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setOrderStep("step1_info");
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    আইডি/নম্বর এডিট করুন
                  </button>
                </div>

                {/* Top White Summary Card: Logo on Left | Amount in BDT on Right (Screenshot 2 Style) */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center">
                    <PaymentLogoBadge methodId={currentPay.id} size="md" />
                  </div>
                  <div className="h-10 w-px bg-slate-200 shrink-0" />
                  <div className="text-right pr-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight block">
                      {finalPayablePrice} BDT
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      মোট পরিশোধযোগ্য: ৳ {toBn(finalPayablePrice)}
                    </span>
                  </div>
                </div>

                {/* Pale Yellow Note Bar (Screenshot 2 Style) */}
                <div className="py-2.5 px-3.5 rounded-xl bg-amber-50 border border-amber-200 text-center text-xs text-slate-600 font-medium">
                  <b className="text-amber-600">নোটঃ</b> টাকা পাঠানোর পর নিচের বক্সে সঠিক প্রমাণ দিয়ে ভেরিফাই করবেন।
                </div>

                {/* Main Brand-Colored Instruction & Proof Card (Screenshot 2 Style) */}
                <div
                  className="rounded-3xl p-4 sm:p-6 text-white shadow-xl space-y-5"
                  style={{ backgroundColor: currentPay.cardBg }}
                >
                  {currentPay.id === "bank" ? (
                    /* ==================== BANK ACCOUNT (NPSB) INSTRUCTION & PROOF ==================== */
                    <>
                      <div className="space-y-2.5 text-center">
                        <h4 className="text-base sm:text-lg font-extrabold text-white">
                          যে ব্যাংক থেকে পাঠিয়েছেন ওই ব্যাংক অ্যাকাউন্ট নাম দিন
                        </h4>
                        <input
                          type="text"
                          value={form.senderBankAccountName}
                          onChange={(e) =>
                            setForm({ ...form, senderBankAccountName: e.target.value })
                          }
                          placeholder="আপনার ব্যাংক ও অ্যাকাউন্টের নাম লিখুন (যেমন: Islami Bank - Md. Rahim)"
                          className="w-full px-4 py-3.5 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-bold text-center shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-300"
                        />
                      </div>

                      {/* Two Bank Accounts with Copy Buttons */}
                      <div className="space-y-3 pt-1">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-yellow-300 border-b border-white/20 pb-1.5">
                          আমাদের ব্যাংক একাউন্টসমূহ (যেকোনো একটিতে NPSB করুন):
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {BANK_ACCOUNTS.map((bankAcc, idx) => {
                            const isSelectedBank = form.selectedBankId === bankAcc.id;
                            return (
                              <div
                                key={bankAcc.id}
                                onClick={() => setForm({ ...form, selectedBankId: bankAcc.id })}
                                className={`p-3.5 rounded-2xl border-2 transition cursor-pointer ${
                                  isSelectedBank
                                    ? "bg-black/30 border-yellow-300 shadow-md"
                                    : "bg-black/15 border-white/20 hover:border-white/40"
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                  <span className="font-black text-sm sm:text-base text-yellow-300">
                                    {idx + 1}. {bankAcc.bankName}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/15 text-white">
                                    {isSelectedBank ? "✓ নির্বাচিত ব্যাংক" : "সিলেক্ট করুন"}
                                  </span>
                                </div>

                                <div className="space-y-1 text-xs text-white/95">
                                  <div className="flex flex-wrap items-center justify-between gap-2 bg-black/25 px-3 py-2 rounded-xl">
                                    <div>
                                      <span className="text-white/75 block text-[10px]">Account Number:</span>
                                      <span className="font-mono font-black text-sm sm:text-base text-yellow-300 tracking-wider">
                                        {bankAcc.accountNumber}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleCopyBankText(bankAcc.accountNumber, bankAcc.id);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white text-xs font-bold transition cursor-pointer"
                                    >
                                      {copiedBankKey === bankAcc.id ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1 text-[11px]">
                                    <div>
                                      <span className="text-white/70">Name/Title: </span>
                                      <b className="text-white">{bankAcc.accountName}</b>
                                    </div>
                                    <div>
                                      <span className="text-white/70">Branch: </span>
                                      <b className="text-white">{bankAcc.branchName}</b>
                                    </div>
                                    <div>
                                      <span className="text-white/70">Routing: </span>
                                      <b className="font-mono text-yellow-200">{bankAcc.routingNumber}</b>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bank NPSB Instructions List */}
                      <div className="space-y-2.5 pt-1">
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-white border-b border-white/20 pb-1.5">
                          INSTRUCTIONS (ব্যাংক পেমেন্ট নিয়মাবলী)
                        </h5>

                        <ul className="space-y-2.5 text-xs sm:text-sm leading-relaxed">
                          <li className="flex items-start gap-2.5 pb-2 border-b border-white/15">
                            <span className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                            <span>
                              ব্যাংক একাউন্টে টাকা পাঠাতে আপনার ব্যাংক অ্যাপ থেকে অবশ্যই{" "}
                              <b className="text-yellow-300">"NPSB (Instant Transfer)"</b> সিলেক্ট করে পাঠাবেন।
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5 pb-2 border-b border-white/15">
                            <span className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                            <span>
                              উপরের যেকোনো একটি ব্যাংক একাউন্টে পরিমাণ:{" "}
                              <b className="text-yellow-300">{finalPayablePrice}</b> টাকা ট্রান্সফার করুন।
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                            <span>
                              টাকা পাঠানোর পর উপরের সাদা বক্সে{" "}
                              <b className="text-yellow-300">যে ব্যাংক থেকে পাঠিয়েছেন ওই ব্যাংক অ্যাকাউন্টের নাম</b>{" "}
                              লিখে নিচের <b className="text-yellow-300">VERIFY TRANSACTION</b> বাটনে ক্লিক করুন।
                            </span>
                          </li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    /* ==================== MOBILE BANKING (BKASH / NAGAD / ROCKET / UPAY / CELLFIN) ==================== */
                    <>
                      {/* Toggle: Personal (TrxID or Mobile Last 3 Digits) vs Shop (Shop Number Last 3 Digits) */}
                      <div className="grid grid-cols-2 gap-2 bg-black/20 p-1.5 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, paymentSource: "personal" })}
                          className={`py-2 px-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                            form.paymentSource !== "shop"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-white/90 hover:bg-white/10"
                          }`}
                        >
                          📱 নিজের নম্বর থেকে
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, paymentSource: "shop" })}
                          className={`py-2 px-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                            form.paymentSource === "shop"
                              ? "bg-yellow-300 text-slate-900 shadow-sm"
                              : "text-white/90 hover:bg-white/10"
                          }`}
                        >
                          🏪 দোকান থেকে পাঠিয়েছি
                        </button>
                      </div>

                      {/* White Input Box (Screenshot 2 Style) */}
                      {form.paymentSource === "shop" ? (
                        <div className="space-y-2.5 text-center">
                          <h4 className="text-base sm:text-lg font-extrabold text-white">
                            দোকানের নম্বরের লাস্ট ৩ ডিজিট দিন
                          </h4>
                          <input
                            type="tel"
                            maxLength={11}
                            value={form.shopLastDigits}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                shopLastDigits: convertBnToEnDigits(e.target.value),
                              })
                            }
                            placeholder="দোকানের নম্বরের লাস্ট ৩ ডিজিট লিখুন (যেমন: 458)"
                            className="w-full px-4 py-3.5 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-bold text-center font-mono tracking-wider shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-300"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2.5 text-center">
                          <h4 className="text-base sm:text-lg font-extrabold text-white">
                            ট্রানজেকশন আইডি অথবা মোবাইলের লাস্ট ৩ ডিজিট দিন
                          </h4>
                          <input
                            type="text"
                            value={form.trxId}
                            onChange={(e) =>
                              setForm({ ...form, trxId: convertBnToEnDigits(e.target.value) })
                            }
                            placeholder="ট্রানজেকশন আইডি অথবা মোবাইলের লাস্ট ৩ ডিজিট দিন"
                            className="w-full px-4 py-3.5 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-bold text-center font-mono tracking-wider shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-300"
                          />
                        </div>
                      )}

                      {/* INSTRUCTIONS List (Screenshot 2 Style) */}
                      <div className="space-y-2.5 pt-1">
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-white border-b border-white/20 pb-1.5">
                          INSTRUCTIONS
                        </h5>

                        <ul className="space-y-3 text-xs sm:text-sm leading-relaxed">
                          <li className="flex items-start gap-2.5 pb-2.5 border-b border-white/15">
                            <span className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                            <span>
                              {currentPay.dialCode ? (
                                <>
                                  <b className="text-yellow-300 font-extrabold">
                                    {currentPay.dialCode}
                                  </b>{" "}
                                  ডায়াল করে আপনার{" "}
                                  <b className="text-yellow-300 font-extrabold uppercase">
                                    {currentPay.shortName}
                                  </b>{" "}
                                  মোবাইল মেনুতে যান অথবা{" "}
                                  <b className="text-yellow-300 font-extrabold uppercase">
                                    {currentPay.shortName}
                                  </b>{" "}
                                  অ্যাপে যান।
                                </>
                              ) : (
                                <>
                                  আপনার{" "}
                                  <b className="text-yellow-300 font-extrabold uppercase">
                                    {currentPay.shortName}
                                  </b>{" "}
                                  অ্যাপে লগইন করুন।
                                </>
                              )}
                            </span>
                          </li>

                          <li className="flex items-start gap-2.5 pb-2.5 border-b border-white/15">
                            <span className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                            <span>
                              <b className="text-yellow-300 font-extrabold">
                                "{currentPay.appAction}"
                              </b>{" "}
                              -এ ক্লিক করুন।
                            </span>
                          </li>

                          <li className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/15">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                              <span>প্রাপক নম্বর হিসেবে এই নম্বরটি লিখুন:</span>
                            </div>

                            <div className="flex items-center gap-2 ml-4 sm:ml-0">
                              <span className="font-mono font-black text-base sm:text-lg text-yellow-300 tracking-wider">
                                {currentPay.number}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyPaymentNumber(currentPay.number)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-bold transition cursor-pointer"
                              >
                                {copiedNumber ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </li>

                          <li className="flex items-start gap-2.5 pb-2.5 border-b border-white/15">
                            <span className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                            <span>
                              পরিমাণ:{" "}
                              <b className="text-yellow-300 font-extrabold">
                                {finalPayablePrice}
                              </b>{" "}
                              টাকা দিয়ে <b className="text-yellow-300 font-extrabold">SUBMIT</b>{" "}
                              করুন।
                            </span>
                          </li>

                          <li className="flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                            <span>
                              এখন উপরের বক্সে আপনার{" "}
                              <b className="text-yellow-300 font-extrabold">
                                Transaction ID অথবা মোবাইলের লাস্ট ৩ ডিজিট
                              </b>{" "}
                              (দোকান থেকে পাঠালে দোকানের নম্বরের লাস্ট ৩ ডিজিট) দিন এবং নিচের{" "}
                              <b className="text-yellow-300 font-extrabold">VERIFY</b> বাটনে ক্লিক করুন।
                            </span>
                          </li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>

                {/* Error Message inside Step 3 */}
                {formError && (
                  <div className="p-3.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Bottom VERIFY TRANSACTION CTA Button (Screenshot 2 Style) */}
                <button
                  type="submit"
                  disabled={sending || isInputPhoneBlocked}
                  className="w-full py-4 rounded-2xl font-black text-base sm:text-lg text-white transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: currentPay.cardBg }}
                >
                  {sending ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin" />
                      <span>অর্ডার ভেরিফাই হচ্ছে...</span>
                    </>
                  ) : (
                    <span>VERIFY TRANSACTION • অর্ডার নিশ্চিত করুন</span>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* BOTTOM WHATSAPP SUPPORT BANNER */}
      <section className="max-w-4xl mx-auto px-3 sm:px-4 pb-6 w-full relative z-10">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/80 via-[#0b1829] to-teal-950/80 border border-emerald-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5 text-center sm:text-left flex-col sm:flex-row">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center justify-center sm:justify-start gap-2">
                <span>WhatsApp Support</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                  Fast Reply
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                অর্ডার সংক্রান্ত যেকোনো সাহায্য বা সমস্যায় সরাসরি আমাদের WhatsApp-এ মেসেজ দিন।
              </p>
            </div>
          </div>

          <a
            href={`https://wa.me/${formatBdWhatsappForUrl(shopSettings.adminWhatsapp || shopSettings.whatsapp)}?text=${encodeURIComponent("আসসালামু আলাইকুম NextGen Efootball, আমার হেল্প ও সাপোর্ট প্রয়োজন।")}`}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp Support-এ মেসেজ দিন</span>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 px-4 pt-8 pb-28 relative z-10 text-xs text-slate-400 w-full">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={SITE.logo} alt="NextGen" className="w-9 h-9 rounded-xl object-contain bg-slate-900 border border-slate-800" />
            <div>
              <p className="font-bold text-white text-sm">{shopSettings.siteName} — eFootball Hub</p>
              <p className="text-[11px] text-slate-500">অফিসিয়াল কয়েন টপ-আপ ও প্লেয়ার প্যাক প্ল্যাটফর্ম</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <a
              href={`https://wa.me/${formatBdWhatsappForUrl(shopSettings.adminWhatsapp || shopSettings.whatsapp)}?text=${encodeURIComponent("আসসালামু আলাইকুম NextGen Efootball, আমার হেল্প ও সাপোর্ট প্রয়োজন।")}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1.5 transition"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Support</span>
            </a>

            <button
              onClick={() => {
                setAccountModalSection("dashboard");
                setShowAccountModal(true);
              }}
              className="hover:text-white transition cursor-pointer"
            >
              আমার অ্যাকাউন্ট
            </button>

            <button
              onClick={() => setShowTrackModal(true)}
              className="hover:text-white transition cursor-pointer"
            >
              ট্র্যাক অর্ডার
            </button>

            <button
              onClick={() => setShowAdminPanel(true)}
              className="hover:text-cyan-400 transition cursor-pointer flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>অ্যাডমিন লগইন</span>
            </button>
          </div>
        </div>
      </footer>

      {/* STICKY BOTTOM NAVIGATION BAR (Matching Screenshot 1) */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#080e1e]/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-1.5 shadow-2xl"
      >
        <div className="max-w-lg mx-auto grid grid-cols-5 items-center text-center">
          {/* 1. হোম (Home) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center justify-center gap-0.5 py-1 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
          >
            <Home className="w-5 h-5 text-cyan-400" />
            <span className="text-[10px] sm:text-[11px] font-bold">হোম</span>
          </button>

          {/* 2. আমার অর্ডার (My Orders) */}
          <button
            type="button"
            onClick={() => {
              setAccountModalSection("orders");
              setShowAccountModal(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 py-1 text-slate-300 hover:text-cyan-400 transition cursor-pointer relative"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px] sm:text-[11px] font-bold">আমার অর্ডার</span>
            {activeCustomer && activeCustomer.totalOrders > 0 && (
              <span className="absolute top-0 right-4 px-1.5 rounded-full bg-cyan-500 text-black text-[9px] font-black">
                {toBn(activeCustomer.totalOrders)}
              </span>
            )}
          </button>

          {/* 3. Center Floating + Button (Quick Order / Cart like Screenshot 1) */}
          <div className="flex flex-col items-center justify-center -mt-5">
            <button
              type="button"
              onClick={() => {
                document.getElementById("order-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              aria-label="অর্ডার ফরম"
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 text-black flex items-center justify-center shadow-lg shadow-cyan-500/30 border-4 border-[#070d1d] hover:scale-105 transition cursor-pointer relative"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center border border-black">
                  {toBn(totalCartCount)}
                </span>
              )}
            </button>
            <span className="text-[10px] font-bold text-cyan-300 mt-0.5">অর্ডার</span>
          </div>

          {/* 4. Track Order (ট্র্যাক অর্ডার) */}
          <button
            type="button"
            onClick={() => setShowTrackModal(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] sm:text-[11px] font-bold">Track Order</span>
          </button>

          {/* 5. প্রোফাইল (Profile) */}
          <button
            type="button"
            onClick={() => {
              setAccountModalSection("dashboard");
              setShowAccountModal(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 py-1 text-slate-300 hover:text-cyan-400 transition cursor-pointer relative"
          >
            <div className="relative">
              <User className="w-5 h-5" />
              {isUserUsingDefaultPassword(activeUser) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-[#080e1e] animate-pulse" />
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold">প্রোফাইল</span>
          </button>
        </div>
      </nav>

      {/* SORTING RADIO MODAL (Matching Screenshot 3) */}
      {showSortModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowSortModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[#1c1f26] border border-slate-700 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                { id: "default", label: "Default sorting" },
                { id: "popularity", label: "Sort by popularity" },
                { id: "latest", label: "Sort by latest" },
                { id: "price_asc", label: "Sort by price: low to high" },
                { id: "price_desc", label: "Sort by price: high to low" },
              ] as const
            ).map((opt) => {
              const selected = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSortBy(opt.id);
                    setShowSortModal(false);
                  }}
                  className="w-full px-5 py-4 text-left flex items-center justify-between border-b border-slate-800/80 last:border-none hover:bg-slate-800/60 transition cursor-pointer"
                >
                  <span className={`text-sm sm:text-base font-medium ${selected ? "text-cyan-300 font-bold" : "text-slate-100"}`}>
                    {opt.label}
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selected ? "border-cyan-400" : "border-slate-400"
                    }`}
                  >
                    {selected && <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALS */}
      {successOrder && (
        <OrderSuccessModal
          order={successOrder}
          onViewReceipt={() => {
            const ord = successOrder;
            setSuccessOrder(null);
            setActiveReceiptOrder(ord);
          }}
          onClose={() => setSuccessOrder(null)}
        />
      )}

      {activeReceiptOrder && (
        <OrderReceiptModal
          order={activeReceiptOrder}
          onClose={() => setActiveReceiptOrder(null)}
        />
      )}

      {showTrackModal && (
        <TrackOrderModal
          onClose={() => setShowTrackModal(false)}
          onViewReceipt={(ord) => {
            setShowTrackModal(false);
            setActiveReceiptOrder(ord);
          }}
        />
      )}

      {showAccountModal && (
        <CustomerAccountModal
          onClose={() => setShowAccountModal(false)}
          initialSection={accountModalSection}
          onViewReceipt={(ord) => {
            setShowAccountModal(false);
            setActiveReceiptOrder(ord);
          }}
          onOrderAgain={() => {
            document.getElementById("order-section")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {showAdminPanel && (
        <AdminPanel
          onClose={() => setShowAdminPanel(false)}
          onViewReceipt={(ord) => {
            setActiveReceiptOrder(ord);
          }}
        />
      )}
    </div>
  );
}
