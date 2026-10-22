import React, { useState, useEffect } from "react";
import { 
  Order, 
  OrderStatus, 
  AdminSecurityConfig, 
  BlockedUser, 
  CustomerAccount, 
  ShopSettings,
  PaymentOptionConfig,
  CartItem
} from "../types";
import { 
  getOrders, 
  saveOrder,
  updateOrderStatus, 
  deleteOrder, 
  updateOrderDetails,
  updateOrderItems,
  getCatalogProducts,
  getAdminOnlineStatus, 
  setAdminOnlineStatus,
  getAdminSecurityConfig,
  updateAdminSecurityConfig,
  verifySecurityCredentials,
  getShopSettings,
  updateShopSettings,
  getBlockedUsers,
  blockUserManual,
  unblockUser,
  recordFailedStrike,
  resetCustomerStrikes,
  getAllCustomerAccounts,
  updateRegisteredUser,
  registerUserAccount,
  deleteRegisteredUser,
  deleteCustomerAccount,
  getActiveCustomerPhone,
  getNotificationLogs,
  getAppNotifications,
  broadcastAdminAnnouncement,
  sendDirectCustomerNotification,
  deleteAppNotification,
  getPaymentOptions,
  updatePaymentOption,
  togglePaymentMethod,
  exportFullStoreBackup,
  importFullStoreBackup,
  forceSyncAllToServerAndCloud
} from "../utils/storage";
import { 
  playOrderNotificationSound, 
  requestNotificationPermission, 
  triggerDesktopNotification 
} from "../utils/notification";
import { 
  formatBdWhatsappForUrl, 
  formatBdPhonePretty, 
  toBn, 
  convertBnToEnDigits, 
  getLoginStartWhatsappMessage,
  getOtpRequestWhatsappMessage,
  getCompletedOrderWhatsappMessage 
} from "../utils/order";
import { SITE } from "../config";
import { 
  Lock, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Copy, 
  Check, 
  MessageCircle, 
  Eye, 
  EyeOff, 
  Trash2, 
  FileText, 
  RefreshCw,
  LogOut,
  TrendingUp,
  Package,
  ArrowLeft,
  Bell,
  BellRing,
  Volume2,
  Power,
  Phone,
  Edit2,
  ExternalLink,
  Shield,
  ShieldAlert,
  Settings,
  Users,
  KeyRound,
  Share2,
  Ban,
  Headphones,
  Send,
  MessageSquare,
  Gift,
  HelpCircle,
  Play,
  Megaphone,
  Flame,
  Sparkles,
  Plus,
  Minus,
  Download,
  Upload,
  UserPlus
} from "lucide-react";
import {
  sendTestAutoWhatsappAlert,
  sendTestTelegramAlert,
  sendTestAdminEmailAlert,
  sendTestDiscordAlert,
  autoDiscoverTelegramChatId,
  sendTestGreenApiAlert,
  checkGreenApiInstanceStatus,
  dispatchOrderStatusNotification,
} from "../utils/autoNotify";
import {
  getEventTypeForStatus,
  getOrderStatusLabelBn,
} from "../utils/orderNotification";
import { AdminProductManager } from "./AdminProductManager";

interface Props {
  onClose: () => void;
  onViewReceipt: (order: Order) => void;
}

type AdminTab = "orders" | "products" | "security" | "settings" | "fraud" | "customers" | "announcements";

export function AdminPanel({ onClose, onViewReceipt }: Props) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("nextgen_admin_auth") === "true";
  });
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [isAdminOnline, setIsAdminOnline] = useState<boolean>(getAdminOnlineStatus);
  const [pinInput, setPinInput] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinError, setPinError] = useState("");
  // Per-User / Per-Device Lockout Tracking (so other users never lock out the Admin)
  const getCurrentUserLockKey = (): { key: string; label: string; phone: string } => {
    const activePhone = getActiveCustomerPhone();
    let deviceId = localStorage.getItem("nextgen_visitor_user_id");
    if (!deviceId) {
      deviceId = "USR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem("nextgen_visitor_user_id", deviceId);
    }
    if (activePhone) {
      return { key: `USER_${activePhone}`, label: `ইউজার (${activePhone})`, phone: activePhone };
    }
    return { key: `DEV_${deviceId}`, label: `ইউজার আইডি (${deviceId})`, phone: "" };
  };

  const getUserLockRecord = () => {
    try {
      const { key } = getCurrentUserLockKey();
      const raw = localStorage.getItem("nextgen_admin_user_locks_v2");
      const map = raw ? JSON.parse(raw) : {};
      return map[key] || { attempts: 0, lockoutUntil: 0 };
    } catch {
      return { attempts: 0, lockoutUntil: 0 };
    }
  };

  const [failedLoginAttempts, setFailedLoginAttempts] = useState<number>(() => getUserLockRecord().attempts);
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => getUserLockRecord().lockoutUntil);
  const [showResetPinOnLogin, setShowResetPinOnLogin] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showPasswords, setShowPasswords] = useState<{ [orderNo: string]: boolean }>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  });
  const [editingOrder, setEditingOrder] = useState<{ orderNo: string; phone: string; otpWhatsapp: string } | null>(null);
  const [editingOrderItems, setEditingOrderItems] = useState<{
    orderNo: string;
    customerName: string;
    phone: string;
    items: CartItem[];
    adminNote: string;
    selectedAddProductId: string;
  } | null>(null);

  // Full Order Details Edit Modal State
  const [editingFullOrder, setEditingFullOrder] = useState<{
    orderNo: string;
    name: string;
    phone: string;
    otpWhatsapp: string;
    konamiIdOrEmail: string;
    konamiPassword: string;
    paymentMethod: string;
    senderNumber: string;
    trxId: string;
    adminNotes: string;
    customerNote: string;
  } | null>(null);

  // Manual Order Creation Modal State
  const [creatingManualOrder, setCreatingManualOrder] = useState<{
    name: string;
    phone: string;
    konamiIdOrEmail: string;
    konamiPassword: string;
    productId: string;
    paymentMethod: string;
    senderNumber: string;
    trxId: string;
    status: OrderStatus;
    adminNotes: string;
  } | null>(null);

  // Direct Customer In-App Notification Modal State
  const [directNotifTarget, setDirectNotifTarget] = useState<{
    phone: string;
    customerName: string;
    orderNo?: string;
    title: string;
    message: string;
  } | null>(null);

  // Security Credentials State
  const [secConfig, setSecConfig] = useState<AdminSecurityConfig>(getAdminSecurityConfig);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [isSecUnlocked, setIsSecUnlocked] = useState(false);
  const [secVerifyError, setSecVerifyError] = useState("");
  const [newAdminPin, setNewAdminPin] = useState("");
  const [confirmNewAdminPin, setConfirmNewAdminPin] = useState("");
  const [newSecEmail, setNewSecEmail] = useState("");
  const [newSecPassword, setNewSecPassword] = useState("");
  const [secSuccessMsg, setSecSuccessMsg] = useState("");

  // Shop Settings State
  const [shopSettings, setShopSettingsState] = useState<ShopSettings>(getShopSettings);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState("");

  // Blocked Users State
  const [blockedList, setBlockedList] = useState<BlockedUser[]>(getBlockedUsers);

  // Ready-to-send WhatsApp Message Drafts per Order (Start / OTP / Complete)
  const [activeWhatsappDrafts, setActiveWhatsappDrafts] = useState<
    Record<
      string,
      {
        step: "start" | "otp" | "complete";
        stepLabel: string;
        message: string;
        whatsappUrl: string;
      }
    >
  >({});

  // Automatic Order Notification Loading, Feedback & Log Viewer State
  const [notifyingOrders, setNotifyingOrders] = useState<Record<string, boolean>>({});
  const [notificationFeedback, setNotificationFeedback] = useState<{
    type: "success" | "warning" | "error";
    text: string;
    orderNo?: string;
    status?: OrderStatus;
  } | null>(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordFeedback, setDiscordFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [detectingChatId, setDetectingChatId] = useState(false);
  const [testingGreenApi, setTestingGreenApi] = useState(false);
  const [checkingGreenApiStatus, setCheckingGreenApiStatus] = useState(false);
  const [greenApiFeedback, setGreenApiFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [expandedLogOrderNo, setExpandedLogOrderNo] = useState<string | null>(null);
  const [manualBlockPhone, setManualBlockPhone] = useState("");
  const [manualBlockReason, setManualBlockReason] = useState("");

  // Announcements & In-app Notifications State
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [announcementType, setAnnouncementType] = useState<"announcement" | "limited_offer">("announcement");
  const [announcementFeedback, setAnnouncementFeedback] = useState<string | null>(null);
  const [allAppNotifs, setAllAppNotifs] = useState(() => getAppNotifications());

  // Customer accounts & Admin user management state
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<"all" | "loyal" | "blocked">("all");
  const [creatingNewCustomer, setCreatingNewCustomer] = useState<{
    name: string;
    username: string;
    email: string;
    phone: string;
    password: string;
  } | null>(null);
  const [showUserPassMap, setShowUserPassMap] = useState<{ [key: string]: boolean }>({});
  const [editingUser, setEditingUser] = useState<{
    id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    emailVerified: boolean;
  } | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerAccount | null>(null);
  const [alsoDeleteCustomerOrders, setAlsoDeleteCustomerOrders] = useState<boolean>(false);
  const [userAdminMsg, setUserAdminMsg] = useState("");

  const updateShopSettingField = (patch: Partial<ShopSettings>) => {
    setShopSettingsState((prev) => {
      const next = { ...prev, ...patch };
      updateShopSettings(next);
      return next;
    });
  };

  const loadData = () => {
    setOrders(getOrders());
    setBlockedList(getBlockedUsers());
    setCustomers(getAllCustomerAccounts());
    setSecConfig(getAdminSecurityConfig());
    setShopSettingsState(getShopSettings());
    setAllAppNotifs(getAppNotifications());
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("nextgen_orders_updated", handleUpdate);
    window.addEventListener("nextgen_blocked_users_updated", handleUpdate);
    window.addEventListener("nextgen_shop_settings_updated", handleUpdate);
    window.addEventListener("nextgen_user_account_updated", handleUpdate);
    window.addEventListener("nextgen_app_notifications_changed", handleUpdate);
    window.addEventListener("nextgen_payment_options_updated", handleUpdate);
    return () => {
      window.removeEventListener("nextgen_orders_updated", handleUpdate);
      window.removeEventListener("nextgen_blocked_users_updated", handleUpdate);
      window.removeEventListener("nextgen_shop_settings_updated", handleUpdate);
      window.removeEventListener("nextgen_user_account_updated", handleUpdate);
      window.removeEventListener("nextgen_app_notifications_changed", handleUpdate);
      window.removeEventListener("nextgen_payment_options_updated", handleUpdate);
    };
  }, [isAuthenticated]);

  const saveUserLockRecord = (attempts: number, lockTime: number) => {
    try {
      const { key, label } = getCurrentUserLockKey();
      const raw = localStorage.getItem("nextgen_admin_user_locks_v2");
      const map = raw ? JSON.parse(raw) : {};
      if (attempts === 0 && lockTime === 0) {
        delete map[key];
      } else {
        map[key] = { attempts, lockoutUntil: lockTime, label, updatedAt: new Date().toISOString() };
      }
      localStorage.setItem("nextgen_admin_user_locks_v2", JSON.stringify(map));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const currentConfig = getAdminSecurityConfig();
    const cleanInput = pinInput.trim();
    const userInfo = getCurrentUserLockKey();

    // Real Admin Master Password ALWAYS works immediately (never locked out even if someone else tried on this device)
    if (cleanInput === currentConfig.securityPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem("nextgen_admin_auth", "true");
      saveUserLockRecord(0, 0);
      setFailedLoginAttempts(0);
      setLockoutUntil(0);
      setPinError("");
      loadData();
      return;
    }

    // Check if THIS specific user/account is currently locked from PIN guessing
    if (lockoutUntil > now) {
      const minsLeft = Math.ceil((lockoutUntil - now) / 60000);
      setPinError(
        `⛔ আপনার ${userInfo.label} থেকে ৫ বার ভুল পিন দেওয়ার কারণে শুধু আপনার অ্যাকাউন্টটি ${toBn(minsLeft)} মিনিটের জন্য লক করা হয়েছে। (আসল অ্যাডমিন নিচে মাস্টার পাসওয়ার্ড দিয়ে যেকোনো সময় ঢুকতে পারবেন)`
      );
      return;
    }

    if (cleanInput === currentConfig.adminPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem("nextgen_admin_auth", "true");
      saveUserLockRecord(0, 0);
      setFailedLoginAttempts(0);
      setLockoutUntil(0);
      setPinError("");
      loadData();
    } else {
      const nextAttempts = failedLoginAttempts + 1;
      setFailedLoginAttempts(nextAttempts);

      if (nextAttempts >= 5) {
        const lockTime = Date.now() + 15 * 60 * 1000; // 15 minutes lockout for THIS user only
        setLockoutUntil(lockTime);
        saveUserLockRecord(nextAttempts, lockTime);
        if (userInfo.phone) {
          blockUserManual(userInfo.phone, "৫ বার ভুল অ্যাডমিন পিন দিয়ে অনুপ্রবেশের চেষ্টা করায় অটো-ব্লক");
        }
        setPinError(
          `⛔ ৫ বার ভুল পিন দেওয়ায় শুধুমাত্র আপনার ${userInfo.label} ১৫ মিনিটের জন্য লক করা হয়েছে! (মূল অ্যাডমিনের অ্যাক্সেস সম্পূর্ণ সচল আছে)`
        );
      } else {
        saveUserLockRecord(nextAttempts, 0);
        setPinError(
          `ভুল সিকিউরিটি পিন! আপনার (${userInfo.label}) চেষ্টা বাকি: ${toBn(5 - nextAttempts)} বার`
        );
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("nextgen_admin_auth");
    setIsSecUnlocked(false);
  };

  const handleToggleOnlineStatus = () => {
    const nextStatus = !isAdminOnline;
    setIsAdminOnline(nextStatus);
    setAdminOnlineStatus(nextStatus);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      triggerDesktopNotification("নোটিফিকেশন সক্রিয়", "NextGen Efootball নতুন অর্ডার নোটিফিকেশন চালু হয়েছে!");
    }
  };

  const handleTestSound = () => {
    playOrderNotificationSound();
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePasswordVisibility = (orderNo: string) => {
    setShowPasswords(prev => ({ ...prev, [orderNo]: !prev[orderNo] }));
  };

  const triggerAdminStatusNotification = async (
    updatedOrder: Order,
    status: OrderStatus,
    forceRetry = false
  ) => {
    setNotifyingOrders((prev) => ({ ...prev, [updatedOrder.orderNo]: true }));
    try {
      const eventType = getEventTypeForStatus(status, false);
      const res = await dispatchOrderStatusNotification({
        order: updatedOrder,
        eventType,
        forceRetry,
        isAdminAuthorized: isAuthenticated,
      });

      setNotificationFeedback({
        type: res.skippedDuplicate ? "warning" : res.ok ? "success" : "error",
        text: res.message,
        orderNo: updatedOrder.orderNo,
        status,
      });
      loadData();
    } catch (err: any) {
      setNotificationFeedback({
        type: "error",
        text: `ইমেইল পাঠাতে ত্রুটি (${err?.message || "Error"}), তবে অর্ডার স্ট্যাটাস সফলভাবে আপডেট হয়েছে।`,
        orderNo: updatedOrder.orderNo,
        status,
      });
    } finally {
      setNotifyingOrders((prev) => ({ ...prev, [updatedOrder.orderNo]: false }));
    }
  };

  const handleStatusChange = async (
    orderNo: string,
    status: OrderStatus,
    forceRetry = false
  ) => {
    if (!isAuthenticated) {
      setNotificationFeedback({
        type: "error",
        text: "শুধুমাত্র অনুমোদিত অ্যাডমিন অর্ডার স্ট্যাটাস পরিবর্তন করতে পারবেন।",
      });
      return;
    }

    const updated = updateOrderStatus(orderNo, status, undefined, {
      requireAdminAuth: true,
      updatedBy: "admin",
    });
    loadData();

    if (updated) {
      await triggerAdminStatusNotification(updated, status, forceRetry);
    }
  };

  const handleDelete = (orderNo: string) => {
    if (window.confirm(`আপনি কি নিশ্চিত অর্ডার #${orderNo} মুছে ফেলতে চান?`)) {
      deleteOrder(orderNo);
      loadData();
    }
  };

  // ORDER PROGRESSION PIPELINE HANDLERS
  // Step 1: Confirm Payment -> Move to Processing & Send Processing Notification
  const handleConfirmPayment = (order: Order) => {
    updateOrderDetails(order.orderNo, {
      status: "processing",
      paymentConfirmed: true,
    });
    loadData();
  };

  // Step 2: Start Login -> Generate WhatsApp / Manual notice
  const handleStartLogin = (order: Order) => {
    updateOrderDetails(order.orderNo, {
      loginStartSent: true
    });
    loadData();

    const msg = getLoginStartWhatsappMessage(order.name, order.orderNo);
    const whatsappNum = formatBdWhatsappForUrl(order.otpWhatsapp || order.phone);
    const waUrl = whatsappNum
      ? `https://wa.me/${whatsappNum}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    copyToClipboard(msg, `wa_msg_${order.orderNo}`);
    setActiveWhatsappDrafts((prev) => ({
      ...prev,
      [order.orderNo]: {
        step: "start",
        stepLabel: "১. Start (লগইন শুরু মেসেজ)",
        message: msg,
        whatsappUrl: waUrl,
      },
    }));

    if (order.contactMethod === "facebook" || !whatsappNum) {
      if (order.contactHandle && order.contactHandle.startsWith("http")) {
        window.open(order.contactHandle, "_blank");
      }
    } else {
      window.open(waUrl, "_blank");
    }
  };

  const handleToggleUserActiveConfirmed = (order: Order) => {
    const nextVal = !order.userActiveConfirmed;
    updateOrderDetails(order.orderNo, {
      userActiveConfirmed: nextVal
    });
    loadData();
  };

  // Step 3: Request OTP -> Generate WhatsApp / Manual message with 5 min countdown notice
  const handleRequestOtp = (order: Order) => {
    updateOrderDetails(order.orderNo, {
      otpRequested: true,
      otpRequestedAt: new Date().toISOString()
    });
    loadData();

    const msg = getOtpRequestWhatsappMessage(
      order.name,
      order.orderNo,
      order.konamiIdOrEmail
    );
    const whatsappNum = formatBdWhatsappForUrl(order.otpWhatsapp || order.phone);
    const waUrl = whatsappNum
      ? `https://wa.me/${whatsappNum}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    copyToClipboard(msg, `wa_msg_${order.orderNo}`);
    setActiveWhatsappDrafts((prev) => ({
      ...prev,
      [order.orderNo]: {
        step: "otp",
        stepLabel: "২. OTP Verification মেসেজ",
        message: msg,
        whatsappUrl: waUrl,
      },
    }));

    if (order.contactMethod === "facebook" || !whatsappNum) {
      if (order.contactHandle && order.contactHandle.startsWith("http")) {
        window.open(order.contactHandle, "_blank");
      }
    } else {
      window.open(waUrl, "_blank");
    }
  };

  // Step 4: Complete Order -> Generates completion message with Facebook review link & receipt
  const handleCompleteOrder = (order: Order) => {
    const updated = updateOrderDetails(order.orderNo, {
      status: "completed"
    });
    loadData();
    if (updated) {
      triggerAdminStatusNotification(updated, "completed", false).catch(() => {});
    }

    const msg = getCompletedOrderWhatsappMessage(
      order.name,
      order.orderNo,
      order.packageName,
      shopSettings.facebookUrl
    );
    const whatsappNum = formatBdWhatsappForUrl(order.otpWhatsapp || order.phone);
    const waUrl = whatsappNum
      ? `https://wa.me/${whatsappNum}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    copyToClipboard(msg, `wa_msg_${order.orderNo}`);
    setActiveWhatsappDrafts((prev) => ({
      ...prev,
      [order.orderNo]: {
        step: "complete",
        stepLabel: "৩. অর্ডার কমপ্লিট মেসেজ",
        message: msg,
        whatsappUrl: waUrl,
      },
    }));

    if (order.contactMethod === "facebook" || !whatsappNum) {
      if (order.contactHandle && order.contactHandle.startsWith("http")) {
        window.open(order.contactHandle, "_blank");
      }
    } else {
      window.open(waUrl, "_blank");
    }
  };

  // Wrong Password notice
  const handleWrongPasswordNotice = (order: Order) => {
    const msg = `আসসালামু আলাইকুম ${order.name} ভাই, NextGen Efootball থেকে বলছি।\n\n` +
      `আপনার অর্ডার #${order.orderNo} এ দেওয়া Konami আইডি বা পাসওয়ার্ড ভুল দেখাচ্ছে। দয়া করে সঠিক পাসওয়ার্ড দিন।`;
    const whatsappNum = formatBdWhatsappForUrl(order.otpWhatsapp || order.phone);
    if (order.contactMethod === "facebook" || !whatsappNum) {
      copyToClipboard(msg, `wrong_${order.orderNo}`);
    } else {
      window.open(`https://wa.me/${whatsappNum}?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  // 3-strike Fraud/Invalid TrxID
  const handleMarkFakeOrStrike = (order: Order) => {
    if (window.confirm(`আপনি কি নিশ্চিত ${order.phone} কে ১টি স্ট্রাইক দিতে চান? ৩টি স্ট্রাইক হলে নম্বরটি অটোমেটিক ব্লক হবে।`)) {
      const res = recordFailedStrike(order.phone, `ভুল TrxID/পাসওয়ার্ড (অর্ডার #${order.orderNo})`);
      const updated = updateOrderDetails(order.orderNo, {
        isFakeOrInvalidStrike: true,
        status: "cancelled",
        adminNotes: "ভুল TrxID বা লগইন তথ্যের কারণে বাতিল করা হয়েছে",
      });
      loadData();
      if (updated) {
        triggerAdminStatusNotification(updated, "cancelled", false).catch(() => {});
      }
      if (res.blocked) {
        alert(`🚨 কাস্টমার ${order.phone} ৩ বার ভুল তথ্য দেওয়ায় সম্পূর্ণ ব্লক হয়েছে!`);
      } else {
        alert(`⚠️ কাস্টমার ${order.phone} এর স্ট্রাইক সংখ্যা: ${res.strikes}/৩`);
      }
    }
  };

  const openOrderItemsEditor = (order: Order) => {
    const initialItems: CartItem[] =
      order.items && order.items.length > 0
        ? order.items.map((it) => ({ ...it, quantity: it.quantity || 1 }))
        : [
            {
              id: `custom_${order.orderNo}`,
              name: order.packageName,
              price: order.price,
              coins: order.coins || 0,
              quantity: 1,
              category: "regular",
            },
          ];
    const catalogProds = getCatalogProducts();
    setEditingOrderItems({
      orderNo: order.orderNo,
      customerName: order.name,
      phone: order.phone,
      items: initialItems,
      adminNote: order.adminNotes || "",
      selectedAddProductId: catalogProds[0]?.id || "",
    });
  };

  const handleSaveEditedOrderItems = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrderItems || editingOrderItems.items.length === 0) return;

    const updated = updateOrderItems(
      editingOrderItems.orderNo,
      editingOrderItems.items,
      editingOrderItems.adminNote
    );

    if (updated) {
      setNotificationFeedback({
        type: "success",
        text: `✅ অর্ডার #${updated.orderNo} এর প্রোডাক্ট সফলভাবে এডিট করা হয়েছে (${updated.packageName} — ৳${toBn(updated.price)}) এবং ওয়েবসাইটের নোটিফিকেশনে বার্তা পাঠানো হয়েছে! (ইমেইল পাঠানো হয়নি)`,
      });
    }
    setEditingOrderItems(null);
    loadData();
  };

  const handleBroadcastAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMsg.trim()) return;
    broadcastAdminAnnouncement({
      title: announcementTitle,
      message: announcementMsg,
      type: announcementType,
    });
    setAnnouncementTitle("");
    setAnnouncementMsg("");
    setAnnouncementFeedback("✅ নোটিফিকেশন সফলভাবে সব ব্যবহারকারী ও ভিজিটরদের কাছে পাঠানো হয়েছে!");
    setAllAppNotifs(getAppNotifications());
    setTimeout(() => setAnnouncementFeedback(null), 3500);
  };

  const handleDeleteNotif = (id: string) => {
    deleteAppNotification(id);
    setAllAppNotifs(getAppNotifications());
  };

  // Unlock Security Settings
  const handleVerifySecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySecurityCredentials(verifyEmail, verifyPassword)) {
      setIsSecUnlocked(true);
      setSecVerifyError("");
      setNewAdminPin(secConfig.adminPin);
      setConfirmNewAdminPin(secConfig.adminPin);
      setNewSecEmail(secConfig.securityEmail);
      setNewSecPassword(secConfig.securityPassword);
    } else {
      setSecVerifyError("ভুল সিকিউরিটি ইমেইল বা সিকিউরিটি পাসওয়ার্ড! সঠিক তথ্য দিন।");
    }
  };

  // Save new security settings
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminPin.trim() !== confirmNewAdminPin.trim()) {
      alert("নতুন পিন এবং নিশ্চিতকরণ পিন মিলছে না!");
      return;
    }
    const updated = updateAdminSecurityConfig({
      adminPin: newAdminPin.trim(),
      securityEmail: newSecEmail.trim() || secConfig.securityEmail,
      securityPassword: newSecPassword.trim() || secConfig.securityPassword
    });
    setSecConfig(updated);
    setSecSuccessMsg("অ্যাডমিন পিন ও সিকিউরিটি ক্রেডেনশিয়াল সফলভাবে আপডেট করা হয়েছে!");
    setTimeout(() => setSecSuccessMsg(""), 4000);
  };

  // Save Shop Settings
  const handleSaveShopSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateShopSettings(shopSettings);
    setShopSettingsState(updated);
    setSettingsSuccessMsg("শপ ও পেমেন্ট সেটিংস সফলভাবে আপডেট হয়েছে!");
    setTimeout(() => setSettingsSuccessMsg(""), 4000);
  };

  const handleSaveEditedNumbers = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    updateOrderDetails(editingOrder.orderNo, {
      phone: editingOrder.phone.trim(),
      otpWhatsapp: formatBdWhatsappForUrl(editingOrder.otpWhatsapp.trim())
    });
    setEditingOrder(null);
    loadData();
  };

  // Metrics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const processingOrders = orders.filter(o => o.status === "processing").length;
  const completedOrders = orders.filter(o => o.status === "completed").length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.price : 0), 0);

  // Filters
  const filteredOrders = orders.filter(o => {
    const matchesStatus = filterStatus === "all" || o.status === filterStatus;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      o.orderNo.toLowerCase().includes(query) ||
      o.name.toLowerCase().includes(query) ||
      o.phone.includes(query) ||
      (o.otpWhatsapp && o.otpWhatsapp.includes(query)) ||
      (o.contactHandle && o.contactHandle.toLowerCase().includes(query)) ||
      o.konamiIdOrEmail.toLowerCase().includes(query) ||
      o.trxId.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  if (!isAuthenticated) {
    const isCurrentlyLocked = lockoutUntil > Date.now();
    const currentUserInfo = getCurrentUserLockKey();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 sm:p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
          
          <div className="text-center mb-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 grid place-items-center mb-3">
              <Shield className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-extrabold text-white">NextGen Efootball অ্যাডমিন সিকিউরিটি</h3>
            <p className="text-xs text-slate-400 mt-1">
              শুধুমাত্র অনুমোদিত অ্যাডমিন প্রবেশের জন্য সিকিউরিটি পিন বা মাস্টার পাসওয়ার্ড দিন
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-semibold">
              <Lock className="w-3 h-3" />
              <span>ইউজার-ভিত্তিক লক: অন্য কেউ ভুল পিন দিলে শুধু সেই ইউজার লক হবে, আপনি নন</span>
            </div>
          </div>

          {!showResetPinOnLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    {isCurrentlyLocked
                      ? "মাস্টার সিকিউরিটি পাসওয়ার্ড দিন (অ্যাডমিন আনলক) *"
                      : "অ্যাডমিন সিকিউরিটি পিন / মাস্টার পাসওয়ার্ড *"}
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {currentUserInfo.label}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPinInput ? "text" : "password"}
                    maxLength={32}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder={
                      isCurrentlyLocked
                        ? "অ্যাডমিন মাস্টার পাসওয়ার্ড লিখুন..."
                        : "সিকিউরিটি পিন বা পাসওয়ার্ড লিখুন..."
                    }
                    autoFocus
                    className="w-full px-4 py-3 pr-11 bg-slate-950 border border-slate-700 rounded-xl text-white text-center text-base tracking-widest focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinInput(!showPinInput)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPinInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {pinError && (
                <p className="text-xs text-rose-400 text-center bg-rose-500/10 py-2 px-3 rounded-lg border border-rose-500/20">
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-sm rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                {isCurrentlyLocked ? "মাস্টার পাসওয়ার্ড দিয়ে প্রবেশ করুন" : "অ্যাডমিন প্যানেলে প্রবেশ করুন"}
              </button>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>অন্য ইউজার ৫ বার ভুল করলে শুধু তার আইডি লক হবে</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPinOnLogin(true);
                    setSecVerifyError("");
                  }}
                  className="text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  ইমেইল দিয়ে লগইন / পিন রিসেট
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                🔑 পিন রিসেট বা যেকোনো লক আনলক করে সরাসরি ঢুকতে আপনার অ্যাডমিন সিকিউরিটি ইমেইল ও মাস্টার পাসওয়ার্ড দিন:
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (verifySecurityCredentials(verifyEmail, verifyPassword)) {
                    saveUserLockRecord(0, 0);
                    setFailedLoginAttempts(0);
                    setLockoutUntil(0);
                    setIsAuthenticated(true);
                    sessionStorage.setItem("nextgen_admin_auth", "true");
                    setIsSecUnlocked(true);
                    setActiveTab("security");
                    loadData();
                  } else {
                    setSecVerifyError("ভুল সিকিউরিটি ইমেইল বা মাস্টার পাসওয়ার্ড!");
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    সিকিউরিটি ইমেইল *
                  </label>
                  <input
                    type="email"
                    required
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    placeholder="আপনার অ্যাডমিন সিকিউরিটি ইমেইল দিন"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    মাস্টার সিকিউরিটি পাসওয়ার্ড *
                  </label>
                  <input
                    type="password"
                    required
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    placeholder="আপনার মাস্টার পাসওয়ার্ড দিন"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                {secVerifyError && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 py-1.5 px-3 rounded-lg border border-rose-500/20">
                    {secVerifyError}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowResetPinOnLogin(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    ফিরে যান
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs cursor-pointer"
                  >
                    ভেরিফাই করে প্রবেশ করুন
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur px-4 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="মূল ওয়েবসাইটে ফিরুন"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
                  <span>{shopSettings.siteName} অ্যাডমিন ড্যাশবোর্ড</span>
                  <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    Pro Hub
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">রিয়েলটাইম অর্ডার পাইপলাইন, প্রোডাক্ট কন্ট্রোল ও সেটিংস</p>
              </div>
            </div>

            {/* Mobile close */}
            <button
              onClick={handleLogout}
              className="md:hidden p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Action Controls in Header */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* ONLINE / OFFLINE TOGGLE */}
            <button
              onClick={handleToggleOnlineStatus}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer border shadow-sm ${
                isAdminOnline 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 animate-pulse"
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${isAdminOnline ? "text-emerald-400" : "text-rose-400"}`} />
              <span>{isAdminOnline ? "🟢 অনলাইন (ডেলিভারি চালু)" : "🔴 অফলাইন / ব্যস্ত"}</span>
            </button>

            {/* Notification controls */}
            <button
              onClick={handleEnableNotifications}
              className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                notificationsEnabled
                  ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title={notificationsEnabled ? "নোটিফিকেশন সক্রিয়" : "নোটিফিকেশন চালু করুন"}
            >
              {notificationsEnabled ? <BellRing className="w-4 h-4 text-cyan-400" /> : <Bell className="w-4 h-4" />}
            </button>

            <button
              onClick={handleTestSound}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="সাউন্ড অ্যালার্ট টেস্ট"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition cursor-pointer border border-rose-500/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Navigation Tabs */}
      <nav className="border-b border-slate-800 bg-slate-900/60 px-4 shrink-0 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2 py-2">
          <button
            onClick={() => setActiveTab("orders")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "orders"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>অর্ডার পাইপলাইন ({toBn(orders.length)})</span>
            {pendingOrders > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[10px] font-black animate-pulse">
                {toBn(pendingOrders)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "products"
                ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-md shadow-cyan-500/20"
                : "text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>🛍️ প্রোডাক্ট, অফার ও পেমেন্ট কন্ট্রোল</span>
          </button>

          <button
            onClick={() => setActiveTab("customers")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "customers"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>কাস্টমার তালিকা ({toBn(customers.length)})</span>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "security"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>পাসওয়ার্ড ও সিকিউরিটি</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>শপ ও পেমেন্ট সেটিংস</span>
          </button>

          <button
            onClick={() => {
              setAllAppNotifs(getAppNotifications());
              setActiveTab("announcements");
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "announcements"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>📢 নোটিফিকেশন ও অফার ঘোষণা</span>
          </button>

          <button
            onClick={() => setActiveTab("fraud")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "fraud"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>ফ্রড ও ব্লক তালিকা ({toBn(blockedList.length)})</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#070d1d]">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* TAB 1: ORDERS PIPELINE */}
          {activeTab === "orders" && (
            <div className="space-y-6">
              {/* Automatic Order Notification Status Banner */}
              {shopSettings.telegramBotToken?.trim() && shopSettings.telegramChatId?.trim() ? (
                <div className="px-4 py-2.5 rounded-xl bg-sky-950/40 border border-sky-500/40 flex items-center justify-between text-xs text-sky-200">
                  <span className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    <span>⚡ অটোমেটিক Telegram অর্ডার বট সক্রিয়! প্রতিটি অর্ডারের সাথে সাথে আপনার টেলিগ্রামে মেসেজ ও সাউন্ড অ্যালার্ট যাবে।</span>
                  </span>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="text-[11px] underline text-cyan-300 hover:text-cyan-200 cursor-pointer font-semibold ml-2 shrink-0"
                  >
                    বট সেটিংস
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 via-emerald-950/40 to-slate-900 border border-sky-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm font-extrabold text-sky-300 flex items-center gap-1.5">
                      <BellRing className="w-4 h-4 text-sky-400 animate-bounce" />
                      <span>অটোমেটিক ইনস্ট্যান্ট অর্ডার অ্যালার্ট (Telegram Bot / WhatsApp / জিমেইল)</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      WhatsApp বট সার্ভার ফুল বা সমস্যা করলে <span className="font-bold text-sky-300">Telegram Bot</span> ব্যবহার করুন — এটি আজীবন ১০০% ফ্রি, ইনস্ট্যান্ট এবং এতে কোনো সার্ভার জ্যাম নেই!
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-black font-extrabold text-xs shrink-0 cursor-pointer shadow-md shadow-sky-500/20"
                  >
                    ⚙️ ইনস্ট্যান্ট অ্যালার্ট চালু করুন
                  </button>
                </div>
              )}

              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">মোট অর্ডার</span>
                    <span className="text-2xl font-black text-white font-mono mt-0.5 block">{toBn(totalOrders)}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-cyan-400 flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-amber-300 font-medium">পেন্ডিং যাচাই</span>
                    <span className="text-2xl font-black text-amber-400 font-mono mt-0.5 block">{toBn(pendingOrders)}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-sky-300 font-medium">প্রসেসিং (লগইন/OTP)</span>
                    <span className="text-2xl font-black text-sky-400 font-mono mt-0.5 block">{toBn(processingOrders)}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                    <Play className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-emerald-300 font-medium">মোট ডেলিভারি</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">{toBn(completedOrders)}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between col-span-2 sm:col-span-1">
                  <div>
                    <span className="text-xs text-emerald-300 font-bold">মোট বিক্রি (আয়)</span>
                    <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">৳ {toBn(totalRevenue)}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Filters, Search & Super-Admin Quick Order Tools */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                  {(["all", "pending", "processing", "completed", "cancelled"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        filterStatus === st
                          ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                          : "bg-slate-800/80 text-slate-300 hover:text-white"
                      }`}
                    >
                      {st === "all" && `সবগুলো (${toBn(orders.length)})`}
                      {st === "pending" && `🟡 পেন্ডিং (${toBn(orders.filter(o => o.status === "pending").length)})`}
                      {st === "processing" && `🔵 প্রসেসিং (${toBn(orders.filter(o => o.status === "processing").length)})`}
                      {st === "completed" && `🟢 কমপ্লিট (${toBn(orders.filter(o => o.status === "completed").length)})`}
                      {st === "cancelled" && `🔴 বাতিল (${toBn(orders.filter(o => o.status === "cancelled").length)})`}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[210px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="অর্ডার নম্বর, ফোন বা TrxID..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const prods = getCatalogProducts();
                      setCreatingManualOrder({
                        name: "",
                        phone: "",
                        konamiIdOrEmail: "",
                        konamiPassword: "",
                        productId: prods[0]?.id || "p1",
                        paymentMethod: "bKash (বিকাশ)",
                        senderNumber: "",
                        trxId: "MANUAL-" + Math.floor(1000 + Math.random() * 9000),
                        status: "pending",
                        adminNotes: "অ্যাডমিন প্যানেল থেকে ম্যানুয়ালি তৈরি অর্ডার",
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ম্যানুয়াল অর্ডার তৈরি</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const headers = ["OrderNo", "Date", "CustomerName", "Phone", "Package", "Price", "PaymentMethod", "TrxID", "Status"];
                      const rows = orders.map((o) => [
                        o.orderNo,
                        new Date(o.time).toISOString(),
                        `"${(o.name || "").replace(/"/g, '""')}"`,
                        o.phone,
                        `"${(o.packageName || "").replace(/"/g, '""')}"`,
                        o.price,
                        `"${(o.paymentMethod || "").replace(/"/g, '""')}"`,
                        o.trxId,
                        o.status,
                      ]);
                      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `nextgen_orders_${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    title="সকল অর্ডারের এক্সেল/CSV রিপোর্ট ডাউনলোড করুন"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV রিপোর্ট</span>
                  </button>
                </div>
              </div>

              {/* Automatic Notification Status Feedback Banner */}
              {notificationFeedback && (
                <div
                  className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                    notificationFeedback.type === "success"
                      ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                      : notificationFeedback.type === "warning"
                      ? "bg-amber-950/60 border-amber-500/40 text-amber-200"
                      : "bg-rose-950/60 border-rose-500/40 text-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span>{notificationFeedback.text}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {notificationFeedback.orderNo && notificationFeedback.status && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetOrd = orders.find(
                            (o) => o.orderNo === notificationFeedback.orderNo
                          );
                          if (targetOrd && notificationFeedback.status) {
                            triggerAdminStatusNotification(
                              targetOrd,
                              notificationFeedback.status,
                              true
                            );
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-bold cursor-pointer"
                      >
                        পুনরায় ইমেইল পাঠান (Force Retry)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setNotificationFeedback(null)}
                      className="px-2 py-1 rounded-lg bg-slate-900/80 text-slate-400 hover:text-white cursor-pointer"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                </div>
              )}

              {/* Order Cards Grid */}
              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                  <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-sm font-semibold">কোনো অর্ডার পাওয়া যায়নি।</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredOrders.map((order) => {
                    const normWhatsapp = formatBdWhatsappForUrl(order.otpWhatsapp || order.phone);
                    const isPwdVisible = showPasswords[order.orderNo] || false;
                    const isFbContact = order.contactMethod === "facebook";
                    const isTgContact = order.contactMethod === "telegram";

                    return (
                      <div
                        key={order.orderNo}
                        className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-700 transition flex flex-col justify-between ${
                          order.status === "pending"
                            ? "border-amber-500/40 shadow-lg shadow-amber-500/5"
                            : order.status === "processing"
                            ? "border-sky-500/40 shadow-lg shadow-sky-500/5"
                            : "border-slate-800"
                        }`}
                      >
                        <div>
                          {/* Order Header */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-base text-cyan-400">
                                #{order.orderNo}
                              </span>
                              <button
                                onClick={() => copyToClipboard(order.orderNo, `ord_${order.orderNo}`)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="কপি করুন"
                              >
                                {copiedKey === `ord_${order.orderNo}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {notifyingOrders[order.orderNo] && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  নোটিফিকেশন যাচ্ছে...
                                </span>
                              )}
                              <select
                                aria-label={`Order status for ${order.orderNo}`}
                                disabled={Boolean(notifyingOrders[order.orderNo])}
                                value={order.status}
                                onChange={(e) => handleStatusChange(order.orderNo, e.target.value as OrderStatus)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer focus:outline-none ${
                                  order.status === "completed"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : order.status === "processing"
                                    ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                                    : order.status === "cancelled"
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                }`}
                              >
                                <option value="pending" className="bg-slate-900 text-amber-300">🟡 Pending (পেন্ডিং)</option>
                                <option value="processing" className="bg-slate-900 text-sky-300">🔵 Processing (প্রসেসিং)</option>
                                <option value="completed" className="bg-slate-900 text-emerald-300">🟢 Completed (কমপ্লিটেড)</option>
                                <option value="cancelled" className="bg-slate-900 text-rose-300">🔴 Cancelled (বাতিল)</option>
                              </select>
                            </div>
                          </div>

                          {/* Status Update Timestamp & Notification Log Bar */}
                          <div className="mt-2 px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="text-slate-400">
                              সর্বশেষ আপডেট:{" "}
                              <b className="text-slate-200">
                                {new Date(order.statusUpdatedAt || order.time).toLocaleString("bn-BD", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </b>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  triggerAdminStatusNotification(order, order.status, true)
                                }
                                disabled={Boolean(notifyingOrders[order.orderNo])}
                                className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold cursor-pointer"
                                title="এই স্ট্যাটাসের ইমেইল নোটিফিকেশন পুনরায় পাঠান"
                              >
                                ↻ ইমেইল রিট্রাই
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLogOrderNo(
                                    expandedLogOrderNo === order.orderNo ? null : order.orderNo
                                  )
                                }
                                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold cursor-pointer"
                              >
                                ইমেইল লগ ({toBn(getNotificationLogs(order.orderNo).length)})
                              </button>
                            </div>
                          </div>

                          {expandedLogOrderNo === order.orderNo && (
                            <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-cyan-300">
                                  📧 নোটিফিকেশন লগ ও Idempotency রেকর্ড (#{order.orderNo})
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Resend Server API
                                </span>
                              </div>
                              {getNotificationLogs(order.orderNo).length === 0 ? (
                                <p className="text-slate-500 text-xs">
                                  এই অর্ডারের জন্য এখনো কোনো ইমেইল নোটিফিকেশন লগ নেই।
                                </p>
                              ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                  {getNotificationLogs(order.orderNo).map((log) => (
                                    <div
                                      key={log.id}
                                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-1"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-white">
                                          {getOrderStatusLabelBn(log.orderStatus)} → {log.recipientEmail}
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            log.deliveryStatus === "sent"
                                              ? "bg-emerald-500/20 text-emerald-300"
                                              : log.deliveryStatus === "skipped_duplicate"
                                              ? "bg-amber-500/20 text-amber-300"
                                              : "bg-rose-500/20 text-rose-300"
                                          }`}
                                        >
                                          {log.deliveryStatus === "sent"
                                            ? `Sent (${log.attempts}x)`
                                            : log.deliveryStatus === "skipped_duplicate"
                                            ? "Idempotent Skip"
                                            : "Failed"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                        <span>Key: {log.idempotencyKey}</span>
                                        <span>
                                          {new Date(log.timestamp).toLocaleTimeString("bn-BD")}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Customer & Package Details */}
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                              <span className="text-[11px] text-slate-400 block">গ্রাহকের নাম:</span>
                              <span className="font-bold text-white text-sm mt-0.5 block">{order.name}</span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[11px] text-slate-400 block">প্যাকেজ ও মূল্য:</span>
                                <span className="font-bold text-emerald-400 text-sm mt-0.5 block truncate">
                                  ৳ {toBn(order.price)} {order.coins ? `(${toBn(order.coins)} কয়েন)` : ""}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => openOrderItemsEditor(order)}
                                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-extrabold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer transition"
                                title="অর্ডারের প্রোডাক্ট বা আইটেম পরিবর্তন/এডিট করুন"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>প্রোডাক্ট এডিট</span>
                              </button>
                            </div>
                          </div>

                          {/* Ordered Products Breakdown Box */}
                          <div className="mt-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold">
                                🛍️ অর্ডারকৃত প্রোডাক্ট ({toBn(order.items?.length || 1)} টি):
                              </span>
                              <button
                                type="button"
                                onClick={() => openOrderItemsEditor(order)}
                                className="text-[11px] text-cyan-400 hover:underline font-bold cursor-pointer"
                              >
                                ✏️ আইটেম বাদ দিন / এডিট করুন
                              </button>
                            </div>
                            {order.items && order.items.length > 0 ? (
                              <div className="space-y-1">
                                {order.items.map((it, iIdx) => (
                                  <div
                                    key={`${it.id}_${iIdx}`}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px]"
                                  >
                                    <span className="text-white font-semibold truncate pr-2">
                                      {iIdx + 1}. {it.name}{" "}
                                      {(it.quantity || 1) > 1 && (
                                        <span className="text-cyan-300 font-mono">× {toBn(it.quantity || 1)}</span>
                                      )}
                                    </span>
                                    <span className="font-mono text-emerald-400 font-bold shrink-0">
                                      ৳ {toBn(it.price * (it.quantity || 1))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-white font-semibold">
                                {order.packageName}
                              </div>
                            )}
                          </div>

                          {/* Contact Method & Channels */}
                          <div className="mt-2 p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">মোবাইল:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-white font-semibold">{formatBdPhonePretty(order.phone)}</span>
                                <a
                                  href={`tel:${order.phone}`}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400"
                                  title="সরাসরি কল দিন"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>

                            {/* Contact Method Indicator (OTP & Communication) */}
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80 gap-2">
                              <span className="text-slate-400 flex items-center gap-1 shrink-0">
                                {isFbContact ? "🔵 FB (OTP যোগাযোগ):" : isTgContact ? "✈️ Telegram (OTP):" : "🟢 WhatsApp (OTP):"}
                              </span>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isFbContact ? (
                                  order.contactHandle?.startsWith("http") ? (
                                    <a
                                      href={order.contactHandle}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-400 hover:underline flex items-center gap-1 text-[11px] font-semibold truncate max-w-[140px]"
                                    >
                                      <span>ফেসবুক প্রোফাইল</span>
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-blue-300 font-mono text-[11px] truncate max-w-[140px]">{order.contactHandle || "FB Provided"}</span>
                                  )
                                ) : isTgContact ? (
                                  <span className="text-sky-300 font-mono text-[11px] truncate max-w-[140px]">{order.contactHandle}</span>
                                ) : (
                                  <span className="font-mono text-emerald-300 font-semibold">{order.otpWhatsapp || order.phone}</span>
                                )}

                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      isFbContact || isTgContact ? (order.contactHandle || order.phone) : (order.otpWhatsapp || order.phone),
                                      `contact-${order.orderNo}`
                                    )
                                  }
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0"
                                  title="কন্টাক্ট কপি করুন"
                                >
                                  {copiedKey === `contact-${order.orderNo}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Konami Account Credentials OR Payment Link Info */}
                          {order.serviceMethod === "payment_link" ? (
                            <div className="mt-2 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-amber-300 font-bold">🔗 সার্ভিস ধরন:</span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-black text-[10px]">
                                  আইডি পাসওয়ার্ড ছাড়া (পেমেন্ট লিংক)
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 gap-2">
                                <span className="text-amber-200 font-medium shrink-0">জাপান পেমেন্ট লিংক:</span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate max-w-[180px]">
                                    {order.paymentLinkJapan || "N/A"}
                                  </span>
                                  {order.paymentLinkJapan && (
                                    <button
                                      onClick={() => copyToClipboard(order.paymentLinkJapan!, `plink_${order.orderNo}`)}
                                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white shrink-0"
                                      title="লিংক কপি করুন"
                                    >
                                      {copiedKey === `plink_${order.orderNo}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
                                <span className="text-amber-200 font-medium">পেমেন্ট লিংক Gmail:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                    {order.paymentLinkGmail || order.konamiIdOrEmail}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(order.paymentLinkGmail || order.konamiIdOrEmail, `id_${order.orderNo}`)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                    title="কপি করুন"
                                  >
                                    {copiedKey === `id_${order.orderNo}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-cyan-300 font-medium">Konami ID / Gmail:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                    {order.konamiIdOrEmail}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(order.konamiIdOrEmail, `id_${order.orderNo}`)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                    title="কপি করুন"
                                  >
                                    {copiedKey === `id_${order.orderNo}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-cyan-500/20">
                                <span className="text-cyan-300 font-medium">Konami পাসওয়ার্ড:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                    {isPwdVisible ? order.konamiPassword : "••••••••••••"}
                                  </span>
                                  <button
                                    onClick={() => togglePasswordVisibility(order.orderNo)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                    title={isPwdVisible ? "লুকান" : "দেখুন"}
                                  >
                                    {isPwdVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(order.konamiPassword, `pwd_${order.orderNo}`)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                    title="কপি করুন"
                                  >
                                    {copiedKey === `pwd_${order.orderNo}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Payment Details */}
                          <div className="mt-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between gap-2">
                            {order.paymentSource === "shop" ? (
                              <span className="text-amber-300 font-bold">
                                🏪 {order.paymentMethod} — দোকান থেকে (লাস্ট ডিজিট: <span className="font-mono text-white underline">{order.shopLastDigits || order.senderNumber}</span>)
                              </span>
                            ) : order.paymentSource === "bank" ? (
                              <span className="text-cyan-300 font-bold">
                                🏦 {order.paymentMethod} — প্রেরক একাউন্ট: <span className="font-mono text-white underline">{order.senderBankAccountName || order.senderNumber}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                📱 {order.paymentMethod} (প্রেরক: <span className="text-white font-mono">{order.senderNumber}</span>)
                              </span>
                            )}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="font-mono text-amber-400 font-bold">
                                {order.paymentSource === "shop" && order.shopLastDigits
                                  ? `শেষ ডিজিট: ${order.shopLastDigits}`
                                  : order.trxId}
                              </span>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    order.paymentSource === "shop" && order.shopLastDigits
                                      ? order.shopLastDigits
                                      : order.trxId,
                                    `trx_${order.orderNo}`
                                  )
                                }
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="কপি করুন"
                              >
                                {copiedKey === `trx_${order.orderNo}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Customer Note / Description if entered */}
                          {order.customerNote && (
                            <div className="mt-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                              <span className="font-bold text-indigo-300 block mb-0.5">📝 কাস্টমার চাহিদা / নোট:</span>
                              <p className="italic">"{order.customerNote}"</p>
                            </div>
                          )}
                        </div>

                        {/* ORDER PROGRESSION PIPELINE CONTROLS */}
                        <div className="space-y-2.5 pt-3 border-t border-slate-800">
                          {/* 4-Step Visual Progress Bar */}
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                              অর্ডার ডেলিভারি পাইপলাইন:
                            </span>

                            {/* Step Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {/* STEP 1: CONFIRM PAYMENT */}
                              {order.status === "pending" ? (
                                <button
                                  onClick={() => handleConfirmPayment(order)}
                                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>১. পেমেন্ট কনফার্ম করুন</span>
                                </button>
                              ) : (
                                <div className="py-1.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1.5 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>১. পেমেন্ট কনফার্মড ✅</span>
                                </div>
                              )}

                              {/* STEP 2: START BUTTON (LOGIN START NOTICE) */}
                              <button
                                onClick={() => handleStartLogin(order)}
                                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                  order.loginStartSent
                                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                                    : "bg-sky-500 hover:bg-sky-400 text-black shadow-md shadow-sky-500/20"
                                }`}
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>২. Start (লগইন মেসেজ)</span>
                              </button>
                            </div>

                            {/* Step 2 Confirmation check & Step 3: Request OTP */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                              {/* Confirm user is active */}
                              <button
                                onClick={() => handleToggleUserActiveConfirmed(order)}
                                className={`py-1.5 px-3 rounded-xl font-semibold flex items-center justify-between border cursor-pointer ${
                                  order.userActiveConfirmed
                                    ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                                    : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                                }`}
                              >
                                <span>ইউজার এক্টিভ নিশ্চিত?</span>
                                <span>{order.userActiveConfirmed ? "✅ হ্যাঁ, আছি" : "❌ অপেক্ষা"}</span>
                              </button>

                              {/* STEP 3: OTP REQUEST MESSAGE */}
                              <button
                                onClick={() => handleRequestOtp(order)}
                                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                  order.otpRequested
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : "bg-gradient-to-r from-cyan-500 to-teal-400 text-black shadow-md shadow-cyan-500/20"
                                }`}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>৩. OTP চান (৫ মিনিট)</span>
                              </button>
                            </div>

                            {/* STEP 4: ORDER COMPLETED BUTTON */}
                            <button
                              onClick={() => handleCompleteOrder(order)}
                              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>৪. অর্ডার কমপ্লিট ও ডিজিটাল রশিদ পাঠান</span>
                            </button>

                            {/* Generated WhatsApp Message Preview & Easy Send Box */}
                            {activeWhatsappDrafts[order.orderNo] && (
                              <div className="mt-2.5 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-extrabold text-emerald-300 flex items-center gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{activeWhatsappDrafts[order.orderNo].stepLabel} (রেডি ও কপি হয়েছে)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveWhatsappDrafts((prev) => {
                                        const next = { ...prev };
                                        delete next[order.orderNo];
                                        return next;
                                      })
                                    }
                                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    ✕ বন্ধ
                                  </button>
                                </div>

                                <pre className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-slate-100 whitespace-pre-wrap font-sans leading-relaxed select-all">
                                  {activeWhatsappDrafts[order.orderNo].message}
                                </pre>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        activeWhatsappDrafts[order.orderNo].message,
                                        `wa_msg_${order.orderNo}`
                                      )
                                    }
                                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                                  >
                                    {copiedKey === `wa_msg_${order.orderNo}` ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-300">কপি হয়েছে!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>মেসেজ কপি করুন</span>
                                      </>
                                    )}
                                  </button>

                                  <a
                                    href={activeWhatsappDrafts[order.orderNo].whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>WhatsApp-এ পাঠান</span>
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick Secondary Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingFullOrder({
                                    orderNo: order.orderNo,
                                    name: order.name,
                                    phone: order.phone,
                                    otpWhatsapp: order.otpWhatsapp || order.phone,
                                    konamiIdOrEmail: order.konamiIdOrEmail,
                                    konamiPassword: order.konamiPassword,
                                    paymentMethod: order.paymentMethod,
                                    senderNumber: order.senderNumber,
                                    trxId: order.trxId,
                                    adminNotes: order.adminNotes || "",
                                    customerNote: order.customerNote || "",
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold cursor-pointer"
                                title="অর্ডারের নাম, ফোন, Konami আইডি/পাসওয়ার্ড, TrxID বা নোট এডিট করুন"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>পূর্ণাঙ্গ তথ্য এডিট</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setDirectNotifTarget({
                                    phone: order.phone,
                                    customerName: order.name,
                                    orderNo: order.orderNo,
                                    title: `🔔 অর্ডার #${order.orderNo} সংক্রান্ত জরুরি বার্তা`,
                                    message: "",
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold cursor-pointer"
                                title="এই কাস্টমারের ওয়েবসাইট নোটিফিকেশনে সরাসরি মেসেজ পাঠান"
                              >
                                <BellRing className="w-3 h-3" />
                                <span>নোটিফিকেশন পাঠান</span>
                              </button>

                              <button
                                onClick={() => handleWrongPasswordNotice(order)}
                                className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>ভুল পাসওয়ার্ড</span>
                              </button>

                              <button
                                onClick={() => handleMarkFakeOrStrike(order)}
                                className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                                title="৩ বার ভুল দিলে অটো ব্লক হবে"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>+১ স্ট্রাইক</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => onViewReceipt(order)}
                                className="inline-flex items-center gap-1 text-cyan-400 hover:text-white cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>রিসিপ্ট</span>
                              </button>

                              <button
                                onClick={() => handleDelete(order.orderNo)}
                                className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>মুছুন</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOMERS & USER ACCOUNTS (FULL ADMIN ACCESS) */}
          {activeTab === "customers" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span>ইউজার অ্যাকাউন্টস ও কাস্টমার কন্ট্রোল প্যানেল (Full Admin Access)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    যেকোনো ইউজার পাসওয়ার্ড ভুলে গেলে বা সমস্যায় পড়লে এখান থেকে তার ইউজারনেম, ইমেইল, পাসওয়ার্ড দেখা, পরিবর্তন, নোটিফিকেশন পাঠানো ও সব অর্ডার ম্যানেজ করুন
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCreatingNewCustomer({
                      name: "",
                      username: "",
                      email: "",
                      phone: "",
                      password: "",
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ নতুন কাস্টমার অ্যাকাউন্ট খুলুন</span>
                </button>
              </div>

              {/* Customer Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomerFilter("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                      customerFilter === "all"
                        ? "bg-cyan-500 text-black"
                        : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    সব কাস্টমার ({toBn(customers.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerFilter("loyal")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                      customerFilter === "loyal"
                        ? "bg-amber-400 text-black"
                        : "bg-slate-800 text-amber-300 hover:text-white"
                    }`}
                  >
                    👑 লয়্যাল ইউজার ({toBn(customers.filter(c => c.totalOrders >= 2 || c.completedOrders >= 2 || c.totalSpent >= 2000).length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerFilter("blocked")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                      customerFilter === "blocked"
                        ? "bg-rose-500 text-white"
                        : "bg-slate-800 text-rose-300 hover:text-white"
                    }`}
                  >
                    🚫 ব্লকড ({toBn(customers.filter(c => c.isBlocked).length)})
                  </button>
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="কাস্টমারের নাম, মোবাইল বা ইমেইল খুঁজুন..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {userAdminMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{userAdminMsg}</span>
                </div>
              )}

              {/* Edit User Account Modal / Box if Admin clicked Edit */}
              {editingUser && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateRegisteredUser(editingUser.id, {
                      name: editingUser.name.trim(),
                      username: editingUser.username.trim().toLowerCase(),
                      email: editingUser.email.trim().toLowerCase(),
                      phone: convertBnToEnDigits(editingUser.phone.trim()),
                      password: editingUser.password.trim(),
                      emailVerified: editingUser.emailVerified,
                    });
                    setEditingUser(null);
                    loadData();
                    setUserAdminMsg("✅ ইউজারের অ্যাকাউন্ট তথ্য ও পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে!");
                    setTimeout(() => setUserAdminMsg(""), 4000);
                  }}
                  className="p-5 rounded-2xl bg-slate-900 border-2 border-cyan-500/50 space-y-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="text-sm font-extrabold text-cyan-300">
                      🔑 ইউজার অ্যাকাউন্ট ও পাসওয়ার্ড এডিট করুন (@{editingUser.username})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕ বন্ধ করুন
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">নাম</label>
                      <input
                        type="text"
                        value={editingUser.name}
                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">ইউজারনেম</label>
                      <input
                        type="text"
                        required
                        value={editingUser.username}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-300 mb-1">
                        পাসওয়ার্ড (রিসেট / পরিবর্তন) *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingUser.password}
                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-amber-300 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">ইমেইল অ্যাড্রেস</label>
                      <input
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">মোবাইল নম্বর</label>
                      <input
                        type="tel"
                        value={editingUser.phone}
                        onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.emailVerified}
                        onChange={(e) =>
                          setEditingUser({ ...editingUser, emailVerified: e.target.checked })
                        }
                        className="w-4 h-4 accent-emerald-500 rounded"
                      />
                      <span>ইমেইল ভেরিফাইড (Verified)</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const targetCust = customers.find((c) => c.id === editingUser.id || (editingUser.phone && c.phone === editingUser.phone));
                        setDeletingCustomer(
                          targetCust || {
                            id: editingUser.id,
                            name: editingUser.name,
                            username: editingUser.username,
                            email: editingUser.email,
                            phone: editingUser.phone,
                            totalOrders: 0,
                            completedOrders: 0,
                            cancelledOrders: 0,
                            processingOrders: 0,
                            pendingOrders: 0,
                            totalSpent: 0,
                            failedAttempts: 0,
                            isBlocked: false,
                            referralCode: editingUser.phone,
                            referredFriendsCount: 0,
                            completedReferralsCount: 0,
                            earnedReferralBonus: 0,
                            usedReferralBonus: 0,
                            availableReferralBonus: 0,
                          }
                        );
                        setAlsoDeleteCustomerOrders(false);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>এই কাস্টমার ডিলিট করুন</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold text-xs cursor-pointer"
                      >
                        ইউজার আপডেট সেভ করুন
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5">কাস্টমার / ইউজারনেম</th>
                        <th className="p-3.5">ইমেইল ও মোবাইল</th>
                        <th className="p-3.5">পাসওয়ার্ড (Admin Access)</th>
                        <th className="p-3.5">লয়্যালটি ও সর্বশেষ সক্রিয় (Last Active)</th>
                        <th className="p-3.5">মোট খরচ</th>
                        <th className="p-3.5 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {customers
                        .filter((c) => {
                          const isLoyal = c.totalOrders >= 2 || c.completedOrders >= 2 || c.totalSpent >= 2000;
                          if (customerFilter === "loyal" && !isLoyal) return false;
                          if (customerFilter === "blocked" && !c.isBlocked) return false;
                          const q = customerSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            (c.name || "").toLowerCase().includes(q) ||
                            (c.phone || "").toLowerCase().includes(q) ||
                            (c.email || "").toLowerCase().includes(q) ||
                            (c.username || "").toLowerCase().includes(q)
                          );
                        })
                        .map((c, idx) => {
                        const rowKey = c.id || c.phone || String(idx);
                        const isPassShown = !!showUserPassMap[rowKey];
                        const isLoyal = c.totalOrders >= 2 || c.completedOrders >= 2 || c.totalSpent >= 2000;
                        const lastActiveIso = c.lastActiveAt || c.createdAt;
                        const lastActiveFormatted = lastActiveIso
                          ? new Date(lastActiveIso).toLocaleDateString("bn-BD", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "তথ্য নেই";

                        return (
                          <tr key={rowKey} className="hover:bg-slate-850 transition">
                            <td className="p-3.5">
                              <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                <span>{c.name}</span>
                                {isLoyal && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black">
                                    👑 লয়্যাল ইউজার
                                  </span>
                                )}
                                {c.emailVerified && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                                    Verified
                                  </span>
                                )}
                                {c.googleConnected && (
                                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">
                                    Google
                                  </span>
                                )}
                                {c.isBlocked && (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                                    ব্লকড
                                  </span>
                                )}
                              </div>
                              {c.username ? (
                                <span className="text-[11px] font-mono text-cyan-400 block mt-0.5">
                                  @{c.username}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  গেস্ট অর্ডার (অ্যাকাউন্ট নেই)
                                </span>
                              )}
                            </td>

                            <td className="p-3.5">
                              {c.email && (
                                <div className="text-slate-200 font-mono text-[11px]">{c.email}</div>
                              )}
                              <div className="font-mono text-cyan-400 text-[11px]">
                                {c.phone ? formatBdPhonePretty(c.phone) : "N/A"}
                              </div>
                            </td>

                            <td className="p-3.5">
                              {c.password ? (
                                <div className="flex items-center gap-1.5">
                                  <code className="px-2 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-amber-300 text-xs">
                                    {isPassShown ? c.password : "••••••"}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowUserPassMap((prev) => ({
                                        ...prev,
                                        [rowKey]: !prev[rowKey],
                                      }))
                                    }
                                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                                    title="পাসওয়ার্ড দেখুন"
                                  >
                                    {isPassShown ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        `ইউজারনেম: ${c.username || c.email}\nপাসওয়ার্ড: ${c.password}`,
                                        `upass_${rowKey}`
                                      )
                                    }
                                    className="p-1 text-cyan-400 hover:text-cyan-300 cursor-pointer"
                                    title="ইউজারনেম ও পাসওয়ার্ড কপি করুন"
                                  >
                                    {copiedKey === `upass_${rowKey}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-[11px]">—</span>
                              )}
                            </td>

                            <td className="p-3.5">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-extrabold">
                                    🛍️ আজীবন অর্ডার: {toBn(c.totalOrders)} টি
                                  </span>
                                  <span className="text-slate-400 text-[10px] font-mono">
                                    (🟢 {toBn(c.completedOrders)} • 🔴 {toBn(c.cancelledOrders)})
                                  </span>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                  <Clock className="w-3 h-3 text-emerald-400" />
                                  <span>Last Active: <b className="text-slate-200">{lastActiveFormatted}</b></span>
                                </span>
                              </div>
                            </td>

                            <td className="p-3.5 font-mono font-bold text-emerald-400">
                              ৳ {toBn(c.totalSpent)}
                            </td>

                            <td className="p-3.5 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                {c.phone && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSearchQuery(c.phone);
                                        setFilterStatus("all");
                                        setActiveTab("orders");
                                      }}
                                      className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-bold cursor-pointer border border-cyan-500/30"
                                      title="এই কাস্টমারের সকল অর্ডার দেখুন"
                                    >
                                      অর্ডারসমূহ ({toBn(c.totalOrders)})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDirectNotifTarget({
                                          phone: c.phone,
                                          customerName: c.name,
                                          title: `🔔 ${shopSettings.siteName} এডমিন বার্তা`,
                                          message: "",
                                        })
                                      }
                                      className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-bold cursor-pointer border border-purple-500/30"
                                      title="এই কাস্টমারের ওয়েবসাইট নোটিফিকেশনে সরাসরি মেসেজ পাঠান"
                                    >
                                      🔔 মেসেজ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (c.isBlocked) {
                                          resetCustomerStrikes(c.phone);
                                          setUserAdminMsg(`✅ ${c.name} (${c.phone}) কে আনব্লক ও স্ট্রাইক রিসেট করা হয়েছে!`);
                                        } else {
                                          blockUserManual(c.phone, "অ্যাডমিন প্যানেল থেকে ব্লক করা হয়েছে");
                                          setUserAdminMsg(`🚫 ${c.name} (${c.phone}) কে ব্লক করা হয়েছে!`);
                                        }
                                        loadData();
                                        setTimeout(() => setUserAdminMsg(""), 3500);
                                      }}
                                      className={`px-2 py-1 rounded-lg font-bold cursor-pointer border ${
                                        c.isBlocked
                                          ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30"
                                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                                      }`}
                                    >
                                      {c.isBlocked ? "আনব্লক" : "ব্লক"}
                                    </button>
                                  </>
                                )}
                                {c.id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingUser({
                                        id: c.id!,
                                        name: c.name || "",
                                        username: c.username || "",
                                        email: c.email || "",
                                        phone: c.phone || "",
                                        password: c.password || "",
                                        emailVerified: !!c.emailVerified,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold cursor-pointer border border-amber-500/30"
                                  >
                                    পাসওয়ার্ড / এডিট
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingCustomer(c);
                                    setAlsoDeleteCustomerOrders(false);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold cursor-pointer border border-rose-500/30 inline-flex items-center gap-1 transition"
                                  title="কাস্টমার তালিকা থেকে ডিলিট করুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>ডিলিট</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delete Customer Confirmation Modal */}
              {deletingCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <div className="w-full max-w-md rounded-2xl bg-slate-900 border-2 border-rose-500/50 p-5 space-y-4 shadow-2xl">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm sm:text-base font-extrabold text-white">
                          কাস্টমার ডিলিট নিশ্চিত করুন
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          আপনি কি নিশ্চিতভাবে কাস্টমার{" "}
                          <b className="text-cyan-300">{deletingCustomer.name}</b>{" "}
                          {deletingCustomer.phone ? `(${formatBdPhonePretty(deletingCustomer.phone)})` : ""} কে কাস্টমার তালিকা থেকে ডিলিট করতে চান?
                        </p>
                      </div>
                    </div>

                    {deletingCustomer.totalOrders > 0 && (
                      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-rose-500/30 text-xs text-rose-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alsoDeleteCustomerOrders}
                          onChange={(e) => setAlsoDeleteCustomerOrders(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-rose-500 rounded cursor-pointer shrink-0"
                        />
                        <span>
                          এই কাস্টমারের পূর্বের সকল অর্ডারও মুছে ফেলুন ({toBn(deletingCustomer.totalOrders)} টি অর্ডার)
                        </span>
                      </label>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingCustomer(null);
                          setAlsoDeleteCustomerOrders(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                      >
                        বাতিল করুন
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const deletedName = deletingCustomer.name || deletingCustomer.phone || "কাস্টমার";
                          deleteCustomerAccount({
                            id: deletingCustomer.id,
                            phone: deletingCustomer.phone,
                            deleteOrders: alsoDeleteCustomerOrders,
                          });
                          if (editingUser && (editingUser.id === deletingCustomer.id || editingUser.phone === deletingCustomer.phone)) {
                            setEditingUser(null);
                          }
                          setDeletingCustomer(null);
                          setAlsoDeleteCustomerOrders(false);
                          loadData();
                          setUserAdminMsg(
                            `🗑️ কাস্টমার "${deletedName}" কে সফলভাবে কাস্টমার তালিকা থেকে মুছে ফেলা হয়েছে!`
                          );
                          setTimeout(() => setUserAdminMsg(""), 4000);
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-rose-500/20 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>হ্যাঁ, ডিলিট করুন</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PASSWORD & SECURITY CREDENTIALS */}
          {activeTab === "security" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">অ্যাডমিন পাসওয়ার্ড ও সিকিউরিটি পরিবর্তন</h3>
                    <p className="text-xs text-slate-400">সিকিউরিটি ইমেইল ও পাসওয়ার্ড ভেরিফাই করে পিন পরিবর্তন করুন</p>
                  </div>
                </div>

                {!isSecUnlocked ? (
                  <form onSubmit={handleVerifySecurity} className="space-y-4 pt-2">
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                      🔒 অ্যাডমিন পিন পরিবর্তন করতে প্রথমে আপনার সিকিউরিটি ইমেইল ও সিকিউরিটি পাসওয়ার্ড দিয়ে আনলক করুন।
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        সিকিউরিটি ইমেইল (Security Email)
                      </label>
                      <input
                        type="email"
                        required
                        value={verifyEmail}
                        onChange={(e) => setVerifyEmail(e.target.value)}
                        placeholder="আপনার সিকিউরিটি ইমেইল লিখুন..."
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        সিকিউরিটি পাসওয়ার্ড (Security Password)
                      </label>
                      <input
                        type="password"
                        required
                        value={verifyPassword}
                        onChange={(e) => setVerifyPassword(e.target.value)}
                        placeholder="সিকিউরিটি পাসওয়ার্ড দিন..."
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {secVerifyError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 py-1.5 px-3 rounded-lg border border-rose-500/20">
                        {secVerifyError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer"
                    >
                      যাচাই করুন ও আনলক করুন
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSaveSecurity} className="space-y-4 pt-2">
                    {secSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{secSuccessMsg}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          নতুন অ্যাডমিন পিন (New Admin PIN)
                        </label>
                        <input
                          type="text"
                          required
                          value={newAdminPin}
                          onChange={(e) => setNewAdminPin(e.target.value)}
                          placeholder="যেমন: 2026"
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          পিন পুনরায় নিশ্চিত করুন (Confirm PIN)
                        </label>
                        <input
                          type="text"
                          required
                          value={confirmNewAdminPin}
                          onChange={(e) => setConfirmNewAdminPin(e.target.value)}
                          placeholder="পুনরায় নতুন পিন লিখুন"
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        সিকিউরিটি ইমেইল আপডেট
                      </label>
                      <input
                        type="email"
                        value={newSecEmail}
                        onChange={(e) => setNewSecEmail(e.target.value)}
                        placeholder="shuaivehasanfahim@gmail.com"
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        নতুন সিকিউরিটি পাসওয়ার্ড
                      </label>
                      <input
                        type="text"
                        value={newSecPassword}
                        onChange={(e) => setNewSecPassword(e.target.value)}
                        placeholder="NextGen2026@Secure"
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      পাসওয়ার্ড ও সিকিউরিটি সংরক্ষণ করুন
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SHOP & PAYMENT SETTINGS */}
          {activeTab === "settings" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">শপ ও পেমেন্ট কনফিগারেশন</h3>
                    <p className="text-xs text-slate-400">বিকাশ, নগদ, ফেসবুক পেজ ও ঘোষণা ব্যানার পরিবর্তন করুন</p>
                  </div>
                </div>

                {settingsSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{settingsSuccessMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSaveShopSettings} className="space-y-4">
                  {/* Website Branding & Support Control */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>ওয়েবসাইটের নাম, স্লোগান ও সাপোর্ট নম্বর নিয়ন্ত্রণ</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          ওয়েবসাইটের নাম (Site Name)
                        </label>
                        <input
                          type="text"
                          value={shopSettings.siteName}
                          onChange={(e) => updateShopSettingField({ siteName: e.target.value })}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          ট্যাগলাইন / সাবটাইটেল (Tagline)
                        </label>
                        <input
                          type="text"
                          value={shopSettings.tagline}
                          onChange={(e) => updateShopSettingField({ tagline: e.target.value })}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          অফিসিয়াল সাপোর্ট WhatsApp নম্বর (আন্তর্জাতিক ফরম্যাট)
                        </label>
                        <input
                          type="text"
                          value={shopSettings.whatsapp}
                          onChange={(e) => updateShopSettingField({ whatsapp: e.target.value })}
                          placeholder="8801629802989"
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-300 font-mono text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          সাপোর্ট সময়সূচী (Support Hours)
                        </label>
                        <input
                          type="text"
                          value={shopSettings.supportHours}
                          onChange={(e) => updateShopSettingField({ supportHours: e.target.value })}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Full Database Backup, Restore & Cloud Sync */}
                  <div className="p-4 rounded-2xl bg-cyan-950/25 border border-cyan-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4 text-cyan-400" />
                          <span>☁️ সার্ভার ও ক্লাউড ডেটা ব্যাকআপ / রিস্টোর কন্ট্রোল</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          আপনার সকল অর্ডার, প্রোডাক্ট, অফার, কাস্টমার ও এপিআই সেটিংস সার্ভার এবং Firebase ডাটাবেসে সুরক্ষিত আছে। চাইলে ১-ক্লিকে JSON ব্যাকআপ ডাউনলোড বা রিস্টোর করতে পারেন।
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await forceSyncAllToServerAndCloud();
                          setSettingsSuccessMsg("☁️ সকল ডেটা সফলভাবে সার্ভার এবং ক্লাউড ডাটাবেসে সিঙ্ক করা হয়েছে!");
                          setTimeout(() => setSettingsSuccessMsg(""), 4000);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>১-ক্লিক ক্লাউড ও সার্ভার সিঙ্ক</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const jsonStr = exportFullStoreBackup();
                          const blob = new Blob([jsonStr], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `nextgen_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          setSettingsSuccessMsg("📥 সম্পূর্ণ ওয়েবসাইটের ডেটা ব্যাকআপ ফাইল ডাউনলোড হয়েছে!");
                          setTimeout(() => setSettingsSuccessMsg(""), 4000);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>পূর্ণাঙ্গ ব্যাকআপ ডাউনলোড (JSON)</span>
                      </button>

                      <label className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>ব্যাকআপ ফাইল রিস্টোর করুন</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const content = String(reader.result || "");
                              const res = importFullStoreBackup(content);
                              if (res.ok) {
                                loadData();
                                setSettingsSuccessMsg("✅ ব্যাকআপ ফাইল থেকে সকল ডেটা সফলভাবে রিস্টোর ও সার্ভারে সেভ হয়েছে!");
                              } else {
                                setSettingsSuccessMsg(`⚠️ ${res.error}`);
                              }
                              setTimeout(() => setSettingsSuccessMsg(""), 5000);
                            };
                            reader.readAsText(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        bKash পার্সোনাল নম্বর (Send Money)
                      </label>
                      <input
                        type="tel"
                        required
                        value={shopSettings.bkashNumber}
                        onChange={(e) => updateShopSettingField({ bkashNumber: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nagad পার্সোনাল নম্বর (Send Money)
                      </label>
                      <input
                        type="tel"
                        required
                        value={shopSettings.nagadNumber}
                        onChange={(e) => updateShopSettingField({ nagadNumber: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {/* Quick Payment Method Enable/Disable inside Settings Tab as well */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                          <Power className="w-4 h-4 text-emerald-400" />
                          <span>পেমেন্ট অপশন চালু / বন্ধ সিস্টেম (হঠাৎ সমস্যা হলে বন্ধ করুন)</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          কোনো পেমেন্ট গেটওয়েতে সমস্যা হলে এখান থেকে বন্ধ করে দিলে গ্রাহকরা চেকআউটে সেটি সিলেক্ট করতে পারবে না
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("products")}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition cursor-pointer shrink-0"
                      >
                        প্রোডাক্ট ও অফার প্যানেল ➔
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {getPaymentOptions().map((pay) => (
                        <div
                          key={pay.id}
                          className={`p-3 rounded-xl border flex flex-col gap-2 ${
                            pay.isEnabled
                              ? "bg-slate-900/90 border-emerald-500/30"
                              : "bg-rose-950/30 border-rose-500/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-white text-xs block">{pay.label}</span>
                              <span
                                className={`text-[10px] font-extrabold ${
                                  pay.isEnabled ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {pay.isEnabled ? "● বর্তমানে চালু আছে" : "🚫 সাময়িকভাবে বন্ধ"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                togglePaymentMethod(pay.id, !pay.isEnabled, pay.disabledReason);
                                setSettingsSuccessMsg(
                                  !pay.isEnabled
                                    ? `✅ ${pay.label} আবার চালু করা হয়েছে!`
                                    : `🚫 ${pay.label} সাময়িকভাবে বন্ধ করা হয়েছে!`
                                );
                                setTimeout(() => setSettingsSuccessMsg(""), 3000);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                                pay.isEnabled
                                  ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-500 hover:bg-emerald-400 text-black"
                              }`}
                            >
                              {pay.isEnabled ? "বন্ধ করুন" : "চালু করুন"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      অফিসিয়াল ফেসবুক পেজ লিংক (Facebook Review & Invite Link)
                    </label>
                    <input
                      type="url"
                      required
                      value={shopSettings.facebookUrl}
                      onChange={(e) => updateShopSettingField({ facebookUrl: e.target.value })}
                      placeholder="https://facebook.com/nextgenefootball01"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      হোমপেজ টপ নোটিশ ও ঘোষণা ব্যানার
                    </label>
                    <textarea
                      rows={2}
                      value={shopSettings.noticeText}
                      onChange={(e) => updateShopSettingField({ noticeText: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* INSTANT MULTI-CHANNEL ORDER NOTIFICATION SYSTEM */}
                  <div className="space-y-4">
                    <div className="border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-extrabold text-cyan-300 flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-cyan-400" />
                        <span>অটোমেটিক ইনস্ট্যান্ট অর্ডার অ্যালার্ট চ্যানেল (Telegram, Email, WhatsApp)</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        ওয়েবসাইটে কোনো গ্রাহক অর্ডার দিলে সাথে সাথে অ্যাডমিনের ফোনে সাউন্ড ও নোটিফিকেশন পাওয়ার একাধিক নির্ভরযোগ্য মাধ্যম:
                      </p>
                    </div>

                    {/* METHOD 1: TELEGRAM ORDER BOT (100% FREE, NO SERVER-FULL RISK, INSTANT) */}
                    <div className="p-4 rounded-2xl bg-sky-950/30 border-2 border-sky-500/50 space-y-3.5 shadow-lg shadow-sky-950/30">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-black uppercase tracking-wider mb-1">
                            <span>⭐ সর্বাধিক নির্ভরযোগ্য ও সুপারিশকৃত</span>
                          </div>
                          <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                            <span>✈️ টেলিগ্রাম অর্ডার বট (Telegram Order Bot)</span>
                          </h4>
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                            CallMeBot WhatsApp-এ প্রায়ই সার্ভার ফুল সমস্যা হয়। কিন্তু <b className="text-sky-300">Telegram Bot</b> হলো সম্পূর্ণ অফিসিয়াল, আজীবন ফ্রি, আনলিমিটেড এবং কোনো সার্ভার জ্যাম নেই। অর্ডার হওয়ামাত্র আপনার টেলিগ্রাম অ্যাপে ইনস্ট্যান্ট সাউন্ডসহ কাস্টমারের সব তথ্য (আইডি, পাসওয়ার্ড, ট্রানজেকশন) চলে আসবে!
                          </p>
                        </div>
                      </div>

                      {/* How to setup Telegram Bot in 1 minute */}
                      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-2.5 text-slate-200">
                        <p className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>⚡ কীভাবে মাত্র ১ মিনিটে টেলিগ্রাম বট চালু করবেন:</span>
                        </p>
                        <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                          <li>
                            নিচের <b>"@BotFather ওপেন করুন"</b> বাটনে চাপ দিয়ে টেলিগ্রামে যান এবং মেসেজ লিখুন <code>/newbot</code>।
                          </li>
                          <li>
                            বটের একটি নাম ও ইউজারনেম দিন (যেমন: <code>NextGen_Order_Bot</code>)। BotFather সাথে সাথে আপনাকে একটি <b>Bot Token</b> দিবে।
                          </li>
                          <li>
                            তৈরি করা বটের লিংকে ঢুকে <b>Start</b> বাটনে চাপ দিন (যাতে বট আপনাকে মেসেজ পাঠাতে পারে)।
                          </li>
                          <li>
                            এরপর নিচের <b>"@userinfobot"</b> বাটনে গিয়ে আপনার নিজের <b>Chat ID</b> (যেমন: <code>123456789</code>) কপি করে নিন।
                          </li>
                          <li>
                            নিচের ঘরে Bot Token ও Chat ID বসিয়ে <b>"🔔 সেভ ও টেস্ট টেলিগ্রাম মেসেজ পাঠান"</b> চাপুন — কাজ শেষ!
                          </li>
                        </ol>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <a
                            href="https://t.me/BotFather"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-extrabold text-[11px] transition cursor-pointer shadow"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>১. @BotFather ওপেন করুন (Token নিন)</span>
                          </a>
                          <a
                            href="https://t.me/userinfobot"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 font-bold text-[11px] transition cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>২. @userinfobot (Chat ID নিন)</span>
                          </a>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-sky-200">
                              Telegram Bot Token *
                            </label>
                            <span className="text-[10px] text-slate-400">@BotFather থেকে প্রাপ্ত</span>
                          </div>
                          <input
                            type="text"
                            value={shopSettings.telegramBotToken || ""}
                            onChange={(e) =>
                              updateShopSettingField({ telegramBotToken: e.target.value.trim() })
                            }
                            placeholder="যেমন: 7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sky-200 font-mono text-xs focus:outline-none focus:border-sky-400"
                          />
                          {shopSettings.telegramBotToken?.trim() && (
                            <div className="mt-1 text-[10px]">
                              {shopSettings.telegramBotToken.includes(":") &&
                              (shopSettings.telegramBotToken.split(":")[1]?.length || 0) < 32 ? (
                                <span className="text-amber-400 font-medium">
                                  ⚠️ টোকেনটি অসম্পূর্ণ মনে হচ্ছে ({shopSettings.telegramBotToken.length} অক্ষর, সাধারণত ৪৬ অক্ষর থাকে)। @BotFather থেকে সম্পূর্ণ টোকেন কপি করুন।
                                </span>
                              ) : shopSettings.telegramBotToken.includes(":") ? (
                                <span className="text-emerald-400 font-medium">
                                  ✓ টোকেন ফরম্যাট ও দৈর্ঘ্য সঠিক ({shopSettings.telegramBotToken.length} অক্ষর)
                                </span>
                              ) : (
                                <span className="text-rose-400 font-medium">
                                  ⚠️ টোকেনে কোলন (:) থাকা আবশ্যক (যেমন: 123456789:AAH...)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-sky-200">
                              আপনার Telegram Chat ID *
                            </label>
                            <button
                              type="button"
                              disabled={detectingChatId || !shopSettings.telegramBotToken?.trim()}
                              onClick={async () => {
                                setDetectingChatId(true);
                                setTelegramFeedback(null);
                                const res = await autoDiscoverTelegramChatId(shopSettings.telegramBotToken || "");
                                setDetectingChatId(false);
                                if (res.ok && res.chatId) {
                                  updateShopSettingField({ telegramChatId: res.chatId });
                                  setTelegramFeedback({
                                    ok: true,
                                    msg: `🎉 আপনার Telegram আইডি (${res.username}: ${res.chatId}) সফলভাবে সেভ হয়েছে! টেস্ট মেসেজ পাঠানো হচ্ছে...`,
                                  });
                                  const testRes = await sendTestTelegramAlert(shopSettings.telegramBotToken || "", res.chatId);
                                  setTelegramFeedback({
                                    ok: testRes.ok,
                                    msg: `🎉 চ্যাট আইডি পাওয়া গেছে (${res.username}: ${res.chatId}) এবং আপনার টেলিগ্রামে টেস্ট মেসেজ সফলভাবে পৌঁছেছে!`,
                                  });
                                } else {
                                  setTelegramFeedback({
                                    ok: false,
                                    msg: res.error || "চ্যাট আইডি পাওয়া যায়নি। টেলিগ্রাম বটে 'Start' চাপ দিয়ে আবার চেষ্টা করুন।",
                                  });
                                }
                              }}
                              className="text-[10px] font-extrabold text-cyan-300 hover:text-cyan-200 underline cursor-pointer disabled:opacity-40"
                            >
                              {detectingChatId ? "শনাক্ত হচ্ছে..." : "🔍 ১-ক্লিকে অটোমেটিক বের করুন"}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={shopSettings.telegramChatId || ""}
                            onChange={(e) =>
                              updateShopSettingField({ telegramChatId: e.target.value.trim() })
                            }
                            placeholder="যেমন: 123456789"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sky-200 font-mono text-xs focus:outline-none focus:border-sky-400"
                          />
                        </div>
                      </div>

                      {telegramFeedback && (
                        <div
                          className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                            telegramFeedback.ok
                              ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-300"
                              : "bg-rose-950/80 border border-rose-500/50 text-rose-300"
                          }`}
                        >
                          <span>{telegramFeedback.msg}</span>
                          <button
                            type="button"
                            onClick={() => setTelegramFeedback(null)}
                            className="text-slate-400 hover:text-white ml-2 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-400">
                          💡 পরামর্শ: Bot Token বসানোর পর আপনার বটে <b>Start</b> চাপুন এবং <b>"১-ক্লিকে অটোমেটিক বের করুন"</b> চাপলেই Chat ID নিজে নিজে বসে যাবে!
                        </span>
                        <button
                          type="button"
                          disabled={testingTelegram}
                          onClick={async () => {
                            updateShopSettings(shopSettings);
                            setTestingTelegram(true);
                            setTelegramFeedback(null);
                            const res = await sendTestTelegramAlert(
                              shopSettings.telegramBotToken || "",
                              shopSettings.telegramChatId || ""
                            );
                            setTestingTelegram(false);
                            setTelegramFeedback({ ok: res.ok, msg: res.message });
                          }}
                          className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-extrabold text-xs cursor-pointer transition shadow-md shadow-sky-500/20 disabled:opacity-50"
                        >
                          {testingTelegram ? "মেসেজ পাঠানো হচ্ছে..." : "🔔 সেভ ও টেস্ট টেলিগ্রাম মেসেজ পাঠান"}
                        </button>
                      </div>
                    </div>

                    {/* METHOD 2: ADMIN EMAIL ALERTS (RESEND) */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-cyan-300 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-cyan-400" />
                            <span>অ্যাডমিন জিমেইল নোটিফিকেশন (Email Alerts)</span>
                          </h4>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            টেলিগ্রাম ও WhatsApp কানেক্ট থাকায় অ্যাডমিনের ইনবক্সে অতিরিক্ত ইমেইল অ্যালার্ট বন্ধ রাখা হয়েছে। তবে <b>গ্রাহক/ইউজারের জিমেইলে</b> অর্ডার কনফার্মেশন ও ডিজিটাল রিসিট ১০০% স্বয়ংক্রিয়ভাবে পাঠানো হয়।
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={testingEmail}
                          onClick={async () => {
                            setTestingEmail(true);
                            setEmailFeedback(null);
                            const res = await sendTestAdminEmailAlert(
                              secConfig.securityEmail || "shuaivehasanfahim@gmail.com"
                            );
                            setTestingEmail(false);
                            setEmailFeedback({ ok: res.ok, msg: res.message });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-bold text-xs cursor-pointer transition shrink-0 disabled:opacity-50"
                        >
                          {testingEmail ? "পাঠানো হচ্ছে..." : "✉️ টেস্ট ইমেইল পাঠান"}
                        </button>
                      </div>

                      {emailFeedback && (
                        <div
                          className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                            emailFeedback.ok
                              ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-300"
                              : "bg-rose-950/80 border border-rose-500/50 text-rose-300"
                          }`}
                        >
                          <span>{emailFeedback.msg}</span>
                          <button
                            type="button"
                            onClick={() => setEmailFeedback(null)}
                            className="text-slate-400 hover:text-white ml-2 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* METHOD 3: DISCORD WEBHOOK (OPTIONAL) */}
                    <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-indigo-300 flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-indigo-400" />
                            <span>Discord Webhook অ্যালার্ট (ঐচ্ছিক)</span>
                          </h4>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            আপনি চাইলে আপনার নিজস্ব Discord সার্ভারের যেকোনো চ্যানেলে ইনস্ট্যান্ট অর্ডার অ্যালার্ট পেতে পারেন।
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          value={shopSettings.discordWebhookUrl || ""}
                          onChange={(e) =>
                            updateShopSettingField({ discordWebhookUrl: e.target.value.trim() })
                          }
                          placeholder="https://discord.com/api/webhooks/..."
                          className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-indigo-200 font-mono text-xs focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          disabled={testingDiscord}
                          onClick={async () => {
                            updateShopSettings(shopSettings);
                            setTestingDiscord(true);
                            setDiscordFeedback(null);
                            const res = await sendTestDiscordAlert(shopSettings.discordWebhookUrl || "");
                            setTestingDiscord(false);
                            setDiscordFeedback({ ok: res.ok, msg: res.message });
                          }}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition shrink-0 disabled:opacity-50"
                        >
                          {testingDiscord ? "চেক হচ্ছে..." : "🎮 টেস্ট Discord"}
                        </button>
                      </div>

                      {discordFeedback && (
                        <div
                          className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                            discordFeedback.ok
                              ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-300"
                              : "bg-rose-950/80 border border-rose-500/50 text-rose-300"
                          }`}
                        >
                          <span>{discordFeedback.msg}</span>
                          <button
                            type="button"
                            onClick={() => setDiscordFeedback(null)}
                            className="text-slate-400 hover:text-white ml-2 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* METHOD 4: WHATSAPP NOTIFICATION SYSTEMS */}
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <span>WhatsApp অর্ডার নোটিফিকেশন সিস্টেম</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                          WhatsApp-এ স্বয়ংক্রিয় মেসেজ পাঠানোর জন্য নিচের ২টি বিকল্প সিস্টেম রাখা হয়েছে:
                        </p>
                      </div>

                      {/* WhatsApp System A: Green-API (Dedicated WhatsApp Gateway - No "Server Full" Issues) */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-300">
                            🟢 বিকল্প ১: Green-API (স্থায়ী WhatsApp গেটওয়ে - কোনো সার্ভার ফুল সমস্যা নেই)
                          </span>
                          <a
                            href="https://green-api.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-cyan-300 underline font-semibold flex items-center gap-1"
                          >
                            <span>green-api.com-এ ফ্রি সাইন আপ</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        
                        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-slate-300 space-y-1">
                          <p className="font-bold text-emerald-200">📌 কীভাবে ১ মিনিটে কানেক্ট করবেন:</p>
                          <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                            <li><a href="https://green-api.com" target="_blank" rel="noreferrer" className="text-cyan-300 underline font-semibold">green-api.com</a> এ ফ্রি একাউন্ট খুলে <b>Free Developer Instance</b> তৈরি করুন।</li>
                            <li>গ্রিন-এপিআই ড্যাশবোর্ডে <b>QR code</b> অপশনে যান এবং আপনার WhatsApp অ্যাপ দিয়ে QR স্ক্যান করুন (স্ট্যাটাস <b>Authorized</b> হবে)।</li>
                            <li>ড্যাশবোর্ড থেকে <b>IdInstance</b> এবং <b>ApiTokenInstance</b> কপি করে নিচের ঘরে পেস্ট করুন।</li>
                          </ol>
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
                          <p className="font-bold flex items-center gap-1 text-amber-200">
                            <span>🔔 কেন নোটিফিকেশন সাউন্ড বা রিংটোন আসেনি?</span>
                          </p>
                          <p className="text-slate-300 leading-relaxed">
                            আপনি যে নম্বর দিয়ে QR স্ক্যান করেছেন, সেই একই নম্বরে মেসেজ পাঠালে WhatsApp সেটিকে <b>"Message yourself" (নিজের পাঠানো নোট)</b> মনে করে এবং <b>কোনো সাউন্ড বা ব্যানার নোটিফিকেশন দেয় না</b> (মেসেজটি সাইলেন্টলি চ্যাটে চলে আসে, যা আপনার স্ক্রিনশটেও সফলভাবে দেখা যাচ্ছে)।
                          </p>
                          <div className="text-slate-300 leading-relaxed pt-0.5 space-y-1">
                            <p className="font-semibold text-emerald-300">💡 সাউন্ড অ্যালার্ট পাওয়ার সহজ উপায়:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                              <li><b>উপায় ১:</b> গ্রিন-এপিআই ড্যাশবোর্ডে <b>অন্য কোনো সিম/ফোনের WhatsApp দিয়ে QR স্ক্যান করুন</b> (সেটি প্রেরক বট হবে), আর নিচের নম্বরের ঘরে আপনার আসল পার্সোনাল নম্বর দিন। তাহলে প্রতিটি অর্ডারে আপনার ফোনে জোরে রিংটোন বেজে উঠবে!</li>
                              <li><b>উপায় ২:</b> অথবা সবচেয়ে সেরা হলো উপরের <b>Telegram Bot</b> ব্যবহার করা — টেলিগ্রাম যেকোনো অর্ডারে সাথে সাথে স্ক্রিন জ্বালিয়ে ১০০% নির্ভরযোগ্য সাউন্ড নোটিফিকেশন দেয়!</li>
                            </ul>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                              Green-API IdInstance
                            </label>
                            <input
                              type="text"
                              value={shopSettings.greenApiIdInstance || "71072277414"}
                              onChange={(e) =>
                                updateShopSettingField({ greenApiIdInstance: e.target.value.trim() })
                              }
                              placeholder="71072277414"
                              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-200 font-mono text-xs focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                              Green-API ApiTokenInstance
                            </label>
                            <input
                              type="text"
                              value={shopSettings.greenApiApiToken || ""}
                              onChange={(e) =>
                                updateShopSettingField({ greenApiApiToken: e.target.value.trim() })
                              }
                              placeholder="ড্যাশবোর্ড থেকে টোকেন পেস্ট করুন..."
                              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-200 font-mono text-xs focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                              📱 প্রাপক নম্বর (যেখানে রিংটোন বাজবে)
                            </label>
                            <input
                              type="tel"
                              value={shopSettings.autoWhatsappPhone || "01629802989"}
                              onChange={(e) =>
                                updateShopSettingField({ autoWhatsappPhone: e.target.value.trim() })
                              }
                              placeholder="01629802989"
                              className="w-full px-3.5 py-2 bg-slate-900 border border-emerald-500/50 rounded-xl text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-slate-300 space-y-1">
                          <p className="font-bold text-emerald-300">✅ ২টি আলাদা নম্বরের নিয়ম:</p>
                          <p className="text-slate-300 leading-relaxed">
                            ১. <b>প্রেরক (বট):</b> Green-API তে যে অন্য নম্বর দিয়ে QR স্ক্যান করছেন।<br />
                            ২. <b>প্রাপক (আপনি):</b> উপরের ঘরে দেওয়া আপনার আসল নম্বর (<b>{shopSettings.autoWhatsappPhone || "01629802989"}</b>)। অন্য নম্বর থেকে আপনার নম্বরে মেসেজ আসলেই WhatsApp-এ সাথে সাথে <b>জোরে রিংটোন ও পপআপ নোটিফিকেশন</b> বাজবে!
                          </p>
                        </div>

                        {greenApiFeedback && (
                          <div
                            className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                              greenApiFeedback.ok
                                ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-300"
                                : "bg-rose-950/80 border border-rose-500/50 text-rose-300"
                            }`}
                          >
                            <span className="leading-relaxed">{greenApiFeedback.msg}</span>
                            <button
                              type="button"
                              onClick={() => setGreenApiFeedback(null)}
                              className="text-slate-400 hover:text-white ml-2 text-xs shrink-0 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={checkingGreenApiStatus || !shopSettings.greenApiIdInstance?.trim()}
                            onClick={async () => {
                              updateShopSettings(shopSettings);
                              setCheckingGreenApiStatus(true);
                              setGreenApiFeedback(null);
                              const res = await checkGreenApiInstanceStatus(
                                shopSettings.greenApiIdInstance || "71072277414",
                                shopSettings.greenApiApiToken || ""
                              );
                              setCheckingGreenApiStatus(false);
                              setGreenApiFeedback({ ok: res.ok, msg: res.message });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-emerald-300 font-bold text-xs cursor-pointer transition disabled:opacity-50"
                          >
                            {checkingGreenApiStatus ? "স্ট্যাটাস চেক হচ্ছে..." : "🔍 QR/কানেকশন স্ট্যাটাস চেক"}
                          </button>
                          <button
                            type="button"
                            disabled={testingGreenApi}
                            onClick={async () => {
                              updateShopSettings(shopSettings);
                              setTestingGreenApi(true);
                              setGreenApiFeedback(null);
                              const res = await sendTestGreenApiAlert(
                                shopSettings.greenApiIdInstance || "71072277414",
                                shopSettings.greenApiApiToken || "",
                                shopSettings.autoWhatsappPhone || "01629802989"
                              );
                              setTestingGreenApi(false);
                              setGreenApiFeedback({ ok: res.ok, msg: res.message });
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition shadow disabled:opacity-50"
                          >
                            {testingGreenApi ? "পাঠানো হচ্ছে..." : "🔔 টেস্ট Green-API WhatsApp"}
                          </button>
                        </div>
                      </div>

                      {/* WhatsApp System B: CallMeBot / Custom Webhook (Public Bot) */}
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                        <div className="text-xs font-bold text-slate-300">
                          🟡 বিকল্প ২: CallMeBot ফ্রি পাবলিক বট (যদি তাদের সার্ভার ফ্রি থাকে)
                        </div>
                        <p className="text-[10px] text-amber-300/80">
                          ⚠️ নোট: CallMeBot-এর পাবলিক সার্ভারে বিশ্বের সবাই একসাথে মেসেজ দেওয়ায় এটি প্রায়ই "Server is full" দেখায়। কাজ না করলে Green-API বা Telegram Bot ব্যবহার করুন।
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-300 mb-1">
                              আপনার WhatsApp নম্বর
                            </label>
                            <input
                              type="tel"
                              value={shopSettings.autoWhatsappPhone || shopSettings.whatsapp || "01629802989"}
                              onChange={(e) =>
                                updateShopSettingField({ autoWhatsappPhone: e.target.value })
                              }
                              placeholder="01629802989"
                              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-300 mb-1">
                              WhatsApp Bot API Key (CallMeBot)
                            </label>
                            <input
                              type="text"
                              value={shopSettings.callmebotApiKey || ""}
                              onChange={(e) =>
                                updateShopSettingField({ callmebotApiKey: e.target.value })
                              }
                              placeholder="API Key..."
                              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            কাস্টম WhatsApp Webhook URL (যদি অন্য কোনো গেটওয়ে ব্যবহার করেন)
                          </label>
                          <input
                            type="url"
                            value={shopSettings.whatsappWebhookUrl || ""}
                            onChange={(e) =>
                              updateShopSettingField({ whatsappWebhookUrl: e.target.value })
                            }
                            placeholder="https://..."
                            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-mono text-xs focus:outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              updateShopSettings(shopSettings);
                              const ok = await sendTestAutoWhatsappAlert(
                                shopSettings.autoWhatsappPhone || shopSettings.whatsapp,
                                shopSettings.callmebotApiKey || "",
                                shopSettings.whatsappWebhookUrl
                              );
                              if (ok) {
                                setSettingsSuccessMsg("✅ WhatsApp টেস্ট রিকোয়েস্ট পাঠানো হয়েছে!");
                              } else {
                                setSettingsSuccessMsg("⚠️ CallMeBot সার্ভার ওভারলোড। অনুগ্রহ করে Telegram Bot অথবা Green-API ব্যবহার করুন।");
                              }
                              setTimeout(() => setSettingsSuccessMsg(""), 5000);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
                          >
                            🔔 টেস্ট CallMeBot
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    সেটিংস সেভ করুন
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 6: FRAUD & BLOCK LIST */}
          {activeTab === "fraud" && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">ফ্রড প্রতিরোধ ও ৩-স্ট্রাইক ব্লক সিস্টেম</h3>
                    <p className="text-xs text-slate-400">যে কোনো নম্বর ৩ বার ভুল তথ্য দিলে স্বয়ংক্রিয়ভাবে ব্লক হয়ে যায়</p>
                  </div>
                </div>

                {/* Manual Block Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!manualBlockPhone) return;
                    blockUserManual(manualBlockPhone, manualBlockReason);
                    setManualBlockPhone("");
                    setManualBlockReason("");
                    loadData();
                  }}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <h4 className="text-xs font-bold text-white">ম্যানুয়ালি নম্বর ব্লক করুন:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="tel"
                      required
                      value={manualBlockPhone}
                      onChange={(e) => setManualBlockPhone(e.target.value)}
                      placeholder="মোবাইল নম্বর (01XXXXXXXXX)"
                      className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-rose-400"
                    />
                    <input
                      type="text"
                      value={manualBlockReason}
                      onChange={(e) => setManualBlockReason(e.target.value)}
                      placeholder="ব্লক করার কারণ (যেমন: ভুয়া TrxID)"
                      className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    ব্লক তালিকায় যোগ করুন
                  </button>
                </form>

                {/* Blocked Users Table */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-300 mb-3">
                    বর্তমান ব্লক তালিকা ({toBn(blockedList.length)} টি নম্বর):
                  </h4>

                  {blockedList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      বর্তমানে কোনো ব্লকড ব্যবহারকারী নেই।
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {blockedList.map((b) => (
                        <div
                          key={b.phone}
                          className="p-3.5 rounded-xl bg-slate-950 border border-rose-500/30 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-rose-300 block">{formatBdPhonePretty(b.phone)}</span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">{b.reason}</span>
                          </div>

                          <button
                            onClick={() => {
                              unblockUser(b.phone);
                              loadData();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
                          >
                            আনব্লক করুন
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ANNOUNCEMENTS & LIMITED-TIME OFFERS BROADCAST */}
          {activeTab === "announcements" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <Megaphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">ইন-অ্যাপ নোটিফিকেশন ও অফার ব্রডকাস্ট</h3>
                    <p className="text-xs text-slate-400">
                      ওয়েবসাইটের হেডারে থাকা 🔔 নোটিফিকেশন বেল আইকনে গ্রাহকদের জন্য জরুরি ঘোষণা বা স্পেশাল অফার পাঠান
                    </p>
                  </div>
                </div>

                {/* Broadcast Form */}
                <form onSubmit={handleBroadcastAnnouncement} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <h4 className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>নতুন নোটিফিকেশন বা অফার ঘোষণা তৈরি করুন</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        নোটিফিকেশন টাইটেল (Title) *
                      </label>
                      <input
                        type="text"
                        required
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        placeholder="যেমন: 🔥 সীমিত সময়ের জন্য স্পেশাল অফার! অথবা ⚠️ জরুরি রক্ষণাবেক্ষণ"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        ক্যাটাগরি / ধরন
                      </label>
                      <select
                        value={announcementType}
                        onChange={(e) => setAnnouncementType(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        <option value="announcement">📢 গুরুত্বপূর্ণ ঘোষণা (Announcement)</option>
                        <option value="limited_offer">🔥 লিমিটেড টাইম অফার (Limited Offer)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      বিস্তারিত বার্তা (Message) *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={announcementMsg}
                      onChange={(e) => setAnnouncementMsg(e.target.value)}
                      placeholder="বিস্তারিত লিখুন... যেমন: আজ রাত ১২টা পর্যন্ত যেকোনো কয়েন অর্ডারে আকর্ষণীয় ক্যাশব্যাক ও দ্রুততম ডেলিভারি!"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>

                  {announcementFeedback && (
                    <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{announcementFeedback}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>📢 সবার নোটিফিকেশনে পাঠান (Broadcast Now)</span>
                  </button>
                </form>

                {/* Active Notifications List */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-cyan-400" />
                      <span>বর্তমান নোটিফিকেশন তালিকা ({toBn(allAppNotifs.length)} টি)</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      গ্রাহকরা তাদের হেডারের বেল আইকনে এগুলো দেখতে পান
                    </span>
                  </div>

                  {allAppNotifs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800">
                      বর্তমানে কোনো নোটিফিকেশন নেই।
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {allAppNotifs.map((n) => (
                        <div
                          key={n.id}
                          className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {n.badge && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                  n.badgeColor === "emerald"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : n.badgeColor === "amber"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    : n.badgeColor === "rose"
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                                }`}>
                                  {n.badge}
                                </span>
                              )}
                              <span className="text-white font-bold">{n.title}</span>
                              <span className="text-slate-500 text-[10px]">
                                • {new Date(n.createdAt).toLocaleString("bn-BD")}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                            {n.orderNo && (
                              <span className="text-[10px] font-mono text-cyan-400 font-bold block">
                                অর্ডার নম্বর: #{n.orderNo}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteNotif(n.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer shrink-0"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: PRODUCTS, SECTIONS, OFFERS & PAYMENT CONTROL */}
          {activeTab === "products" && <AdminProductManager />}

        </div>
      </main>

      {/* Edit Phone/WhatsApp Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-white text-sm">গ্রাহকের নম্বর আপডেট করুন</h3>
            <form onSubmit={handleSaveEditedNumbers} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">মোবাইল নম্বর:</label>
                <input
                  type="tel"
                  value={editingOrder.phone}
                  onChange={(e) => setEditingOrder({ ...editingOrder, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">WhatsApp নম্বর:</label>
                <input
                  type="tel"
                  value={editingOrder.otpWhatsapp}
                  onChange={(e) => setEditingOrder({ ...editingOrder, otpWhatsapp: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-bold text-xs cursor-pointer"
                >
                  সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Order Products / Items Modal (Website Notification Only - No Email) */}
      {editingOrderItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-xl space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-cyan-400" />
                  <span>অর্ডার #{editingOrderItems.orderNo} এর প্রোডাক্ট এডিট করুন</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  কাস্টমার: <b className="text-slate-200">{editingOrderItems.customerName}</b> ({editingOrderItems.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrderItems(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 leading-relaxed">
              💡 ইউজার যদি ভুল করে একাধিক প্রোডাক্ট অর্ডার করে বা কোনো প্রোডাক্ট বাদ দিতে চায়, তবে এখান থেকে প্রোডাক্ট বাদ দিন, সংখ্যা পরিবর্তন করুন বা নতুন প্রোডাক্ট যুক্ত করুন। সেভ করলে <b>শুধুমাত্র ওয়েবসাইটের নোটিফিকেশনে</b> আপডেট যাবে (কোনো ইমেইল পাঠানো হবে না)।
            </div>

            <form onSubmit={handleSaveEditedOrderItems} className="space-y-4">
              {/* Current Items List */}
              <div className="space-y-2.5">
                <label className="text-xs font-extrabold text-slate-300 block">
                  বর্তমান অর্ডারকৃত প্রোডাক্টসমূহ ({toBn(editingOrderItems.items.length)} টি):
                </label>

                {editingOrderItems.items.map((item, idx) => (
                  <div
                    key={`${item.id}_${idx}`}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        required
                        value={item.name}
                        onChange={(e) => {
                          const next = [...editingOrderItems.items];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setEditingOrderItems({ ...editingOrderItems, items: next });
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        placeholder="প্রোডাক্টের নাম"
                      />

                      {editingOrderItems.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = editingOrderItems.items.filter((_, i) => i !== idx);
                            setEditingOrderItems({ ...editingOrderItems, items: next });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                          title="এই প্রোডাক্টটি অর্ডার থেকে বাদ দিন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>বাদ দিন</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">একক মূল্য (৳)</label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={item.price}
                          onChange={(e) => {
                            const next = [...editingOrderItems.items];
                            next[idx] = { ...next[idx], price: Number(e.target.value) || 0 };
                            setEditingOrderItems({ ...editingOrderItems, items: next });
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-emerald-300 font-mono font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">কয়েন সংখ্যা</label>
                        <input
                          type="number"
                          min={0}
                          value={item.coins || 0}
                          onChange={(e) => {
                            const next = [...editingOrderItems.items];
                            next[idx] = { ...next[idx], coins: Number(e.target.value) || 0 };
                            setEditingOrderItems({ ...editingOrderItems, items: next });
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-mono font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">পরিমাণ (Quantity)</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...editingOrderItems.items];
                              const q = Math.max(1, (next[idx].quantity || 1) - 1);
                              next[idx] = { ...next[idx], quantity: q };
                              setEditingOrderItems({ ...editingOrderItems, items: next });
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="flex-1 text-center font-mono font-bold text-white">
                            {toBn(item.quantity || 1)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...editingOrderItems.items];
                              const q = (next[idx].quantity || 1) + 1;
                              next[idx] = { ...next[idx], quantity: q };
                              setEditingOrderItems({ ...editingOrderItems, items: next });
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Another Product from Catalog */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-cyan-300 block">
                  ➕ ক্যাটালগ থেকে অন্য কোনো প্রোডাক্ট যোগ করুন:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={editingOrderItems.selectedAddProductId}
                    onChange={(e) =>
                      setEditingOrderItems({
                        ...editingOrderItems,
                        selectedAddProductId: e.target.value,
                      })
                    }
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {getCatalogProducts().map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ৳{toBn(p.price)} ({toBn(p.coins)} কয়েন)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const found = getCatalogProducts().find(
                        (p) => p.id === editingOrderItems.selectedAddProductId
                      );
                      if (!found) return;
                      const newItem: CartItem = {
                        id: found.id,
                        name: found.name,
                        price: found.price,
                        coins: found.coins,
                        quantity: 1,
                        category: (found.category as any) || "regular",
                        image: found.image,
                      };
                      setEditingOrderItems({
                        ...editingOrderItems,
                        items: [...editingOrderItems.items, newItem],
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-extrabold text-xs cursor-pointer shrink-0"
                  >
                    + যুক্ত করুন
                  </button>
                </div>
              </div>

              {/* Admin Note for Customer Notification */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  কাস্টমারের নোটিফিকেশনের জন্য নোট (ঐচ্ছিক):
                </label>
                <input
                  type="text"
                  value={editingOrderItems.adminNote}
                  onChange={(e) =>
                    setEditingOrderItems({ ...editingOrderItems, adminNote: e.target.value })
                  }
                  placeholder="যেমন: আপনার অনুরোধ অনুযায়ী ২টি প্রোডাক্ট বাদ দিয়ে ১টি রাখা হয়েছে"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Summary Footer */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">নতুন সর্বমোট মূল্য ও কয়েন:</span>
                <span className="font-mono font-black text-sm text-emerald-400">
                  ৳{" "}
                  {toBn(
                    editingOrderItems.items.reduce(
                      (s, i) => s + Number(i.price || 0) * (Number(i.quantity) || 1),
                      0
                    )
                  )}{" "}
                  (
                  {toBn(
                    editingOrderItems.items.reduce(
                      (s, i) => s + Number(i.coins || 0) * (Number(i.quantity) || 1),
                      0
                    )
                  )}{" "}
                  কয়েন)
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOrderItems(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  ✅ অর্ডার আপডেট ও ওয়েবসাইট নোটিফিকেশন পাঠান
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Order Details Edit Modal */}
      {editingFullOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                <span>অর্ডার #{editingFullOrder.orderNo} এর সকল তথ্য এডিট করুন</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingFullOrder(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateOrderDetails(editingFullOrder.orderNo, {
                  name: editingFullOrder.name.trim(),
                  phone: convertBnToEnDigits(editingFullOrder.phone.trim()),
                  otpWhatsapp: convertBnToEnDigits(editingFullOrder.otpWhatsapp.trim()),
                  konamiIdOrEmail: editingFullOrder.konamiIdOrEmail.trim(),
                  konamiPassword: editingFullOrder.konamiPassword.trim(),
                  paymentMethod: editingFullOrder.paymentMethod.trim(),
                  senderNumber: convertBnToEnDigits(editingFullOrder.senderNumber.trim()),
                  trxId: editingFullOrder.trxId.trim(),
                  adminNotes: editingFullOrder.adminNotes.trim(),
                  customerNote: editingFullOrder.customerNote.trim(),
                });
                sendDirectCustomerNotification({
                  targetPhone: convertBnToEnDigits(editingFullOrder.phone.trim()),
                  title: `✏️ অর্ডার #${editingFullOrder.orderNo} এর তথ্য আপডেট করা হয়েছে`,
                  message: `অ্যাডমিন আপনার অর্ডার #${editingFullOrder.orderNo} এর তথ্য আপডেট করেছেন।${
                    editingFullOrder.adminNotes ? ` নোট: ${editingFullOrder.adminNotes}` : ""
                  }`,
                  orderNo: editingFullOrder.orderNo,
                  badge: "অর্ডার আপডেট",
                });
                setEditingFullOrder(null);
                loadData();
                setNotificationFeedback({
                  type: "success",
                  text: `✅ অর্ডার #${editingFullOrder.orderNo} এর সকল তথ্য সফলভাবে আপডেট করা হয়েছে এবং ওয়েবসাইট নোটিফিকেশনে জানানো হয়েছে!`,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">গ্রাহকের নাম *</label>
                  <input
                    type="text"
                    required
                    value={editingFullOrder.name}
                    onChange={(e) => setEditingFullOrder({ ...editingFullOrder, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="tel"
                    required
                    value={editingFullOrder.phone}
                    onChange={(e) => setEditingFullOrder({ ...editingFullOrder, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-cyan-300 font-bold mb-1">Konami ID / Gmail</label>
                  <input
                    type="text"
                    value={editingFullOrder.konamiIdOrEmail}
                    onChange={(e) =>
                      setEditingFullOrder({ ...editingFullOrder, konamiIdOrEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-amber-300 font-bold mb-1">Konami পাসওয়ার্ড</label>
                  <input
                    type="text"
                    value={editingFullOrder.konamiPassword}
                    onChange={(e) =>
                      setEditingFullOrder({ ...editingFullOrder, konamiPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">পেমেন্ট মাধ্যম</label>
                  <input
                    type="text"
                    value={editingFullOrder.paymentMethod}
                    onChange={(e) =>
                      setEditingFullOrder({ ...editingFullOrder, paymentMethod: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">প্রেরক নম্বর (Sender)</label>
                  <input
                    type="text"
                    value={editingFullOrder.senderNumber}
                    onChange={(e) =>
                      setEditingFullOrder({ ...editingFullOrder, senderNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-bold mb-1">TrxID / শেষ ডিজিট</label>
                  <input
                    type="text"
                    value={editingFullOrder.trxId}
                    onChange={(e) => setEditingFullOrder({ ...editingFullOrder, trxId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">OTP WhatsApp নম্বর</label>
                  <input
                    type="text"
                    value={editingFullOrder.otpWhatsapp}
                    onChange={(e) =>
                      setEditingFullOrder({ ...editingFullOrder, otpWhatsapp: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">অ্যাডমিন নোট (রিসিপ্ট ও নোটিফিকেশনে যাবে)</label>
                <input
                  type="text"
                  value={editingFullOrder.adminNotes}
                  onChange={(e) =>
                    setEditingFullOrder({ ...editingFullOrder, adminNotes: e.target.value })
                  }
                  placeholder="যেমন: পেমেন্ট যাচাই সম্পন্ন"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingFullOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold cursor-pointer"
                >
                  সেভ ও আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Manual Order Modal */}
      {creatingManualOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>অ্যাডমিন ম্যানুয়াল অর্ডার তৈরি করুন</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreatingManualOrder(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const prods = getCatalogProducts();
                const selectedProd = prods.find((p) => p.id === creatingManualOrder.productId) || prods[0];
                const orderNo = "EF" + Math.floor(1000000 + Math.random() * 9000000);
                const cleanPhone = convertBnToEnDigits(creatingManualOrder.phone.trim());
                const newOrd: Order = {
                  orderNo,
                  time: new Date().toISOString(),
                  name: creatingManualOrder.name.trim() || "গ্রাহক",
                  phone: cleanPhone,
                  contactMethod: "whatsapp",
                  contactHandle: cleanPhone,
                  otpWhatsapp: cleanPhone,
                  konamiIdOrEmail: creatingManualOrder.konamiIdOrEmail.trim() || "N/A",
                  konamiPassword: creatingManualOrder.konamiPassword.trim() || "N/A",
                  platform: "Android",
                  items: selectedProd
                    ? [
                        {
                          id: selectedProd.id,
                          name: selectedProd.name,
                          price: selectedProd.price,
                          coins: selectedProd.coins,
                          quantity: 1,
                          category: (selectedProd.category as any) || "regular",
                          image: selectedProd.image,
                        },
                      ]
                    : [],
                  packageName: selectedProd ? selectedProd.name : "Custom Package",
                  price: selectedProd ? selectedProd.price : 0,
                  coins: selectedProd ? selectedProd.coins : 0,
                  paymentMethod: creatingManualOrder.paymentMethod,
                  senderNumber: convertBnToEnDigits(creatingManualOrder.senderNumber.trim()) || cleanPhone,
                  trxId: creatingManualOrder.trxId.trim() || "ADMIN",
                  status: creatingManualOrder.status,
                  adminNotes: creatingManualOrder.adminNotes.trim(),
                };
                saveOrder(newOrd);
                setCreatingManualOrder(null);
                loadData();
                setNotificationFeedback({
                  type: "success",
                  text: `🎉 ম্যানুয়াল অর্ডার #${orderNo} সফলভাবে তৈরি ও ডাটাবেসে সেভ হয়েছে!`,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">গ্রাহকের নাম *</label>
                  <input
                    type="text"
                    required
                    value={creatingManualOrder.name}
                    onChange={(e) =>
                      setCreatingManualOrder({ ...creatingManualOrder, name: e.target.value })
                    }
                    placeholder="কাস্টমারের নাম"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="tel"
                    required
                    value={creatingManualOrder.phone}
                    onChange={(e) =>
                      setCreatingManualOrder({ ...creatingManualOrder, phone: e.target.value })
                    }
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-cyan-300 font-bold mb-1">প্রোডাক্ট / প্যাকেজ নির্বাচন করুন *</label>
                <select
                  value={creatingManualOrder.productId}
                  onChange={(e) =>
                    setCreatingManualOrder({ ...creatingManualOrder, productId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                >
                  {getCatalogProducts().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ৳{toBn(p.price)} ({toBn(p.coins)} কয়েন)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Konami ID / Gmail</label>
                  <input
                    type="text"
                    value={creatingManualOrder.konamiIdOrEmail}
                    onChange={(e) =>
                      setCreatingManualOrder({
                        ...creatingManualOrder,
                        konamiIdOrEmail: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Konami পাসওয়ার্ড</label>
                  <input
                    type="text"
                    value={creatingManualOrder.konamiPassword}
                    onChange={(e) =>
                      setCreatingManualOrder({
                        ...creatingManualOrder,
                        konamiPassword: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">পেমেন্ট মাধ্যম</label>
                  <input
                    type="text"
                    value={creatingManualOrder.paymentMethod}
                    onChange={(e) =>
                      setCreatingManualOrder({
                        ...creatingManualOrder,
                        paymentMethod: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">TrxID</label>
                  <input
                    type="text"
                    value={creatingManualOrder.trxId}
                    onChange={(e) =>
                      setCreatingManualOrder({ ...creatingManualOrder, trxId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreatingManualOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold cursor-pointer"
                >
                  অর্ডার তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Customer Website Notification Modal (No Email) */}
      {directNotifTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-purple-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-purple-400" />
                  <span>কাস্টমারকে সরাসরি ওয়েবসাইট নোটিফিকেশন পাঠান</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  প্রাপক: <b className="text-purple-300">{directNotifTarget.customerName}</b> ({directNotifTarget.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDirectNotifTarget(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!directNotifTarget.message.trim()) return;
                sendDirectCustomerNotification({
                  targetPhone: directNotifTarget.phone,
                  title: directNotifTarget.title,
                  message: directNotifTarget.message,
                  orderNo: directNotifTarget.orderNo,
                });
                const targetName = directNotifTarget.customerName;
                setDirectNotifTarget(null);
                loadData();
                setNotificationFeedback({
                  type: "success",
                  text: `🔔 "${targetName}" এর ওয়েবসাইট নোটিফিকেশন বেল আইকনে বার্তা পাঠানো হয়েছে!`,
                });
                setUserAdminMsg(`🔔 "${targetName}" এর কাছে ওয়েবসাইট নোটিফিকেশন পাঠানো হয়েছে!`);
                setTimeout(() => setUserAdminMsg(""), 4000);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-bold mb-1">টাইটেল *</label>
                <input
                  type="text"
                  required
                  value={directNotifTarget.title}
                  onChange={(e) =>
                    setDirectNotifTarget({ ...directNotifTarget, title: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">বার্তা / মেসেজ *</label>
                <textarea
                  rows={3}
                  required
                  value={directNotifTarget.message}
                  onChange={(e) =>
                    setDirectNotifTarget({ ...directNotifTarget, message: e.target.value })
                  }
                  placeholder="যেমন: ভাই, আপনার Konami টু-স্টেপ ওটিপি কোডটি দ্রুত আমাদের হোয়াটসঅ্যাপে পাঠান..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDirectNotifTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-black font-extrabold cursor-pointer"
                >
                  🔔 নোটিফিকেশন পাঠান
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Customer Account Modal */}
      {creatingNewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                <span>নতুন কাস্টমার অ্যাকাউন্ট তৈরি করুন</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreatingNewCustomer(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const res = registerUserAccount({
                  name: creatingNewCustomer.name,
                  username: creatingNewCustomer.username,
                  email: creatingNewCustomer.email,
                  phone: creatingNewCustomer.phone,
                  password: creatingNewCustomer.password,
                });
                if (!res.ok) {
                  setUserAdminMsg(`⚠️ ${res.error}`);
                  return;
                }
                setCreatingNewCustomer(null);
                loadData();
                setUserAdminMsg(`✅ নতুন কাস্টমার অ্যাকাউন্ট "${creatingNewCustomer.name}" সফলভাবে তৈরি হয়েছে!`);
                setTimeout(() => setUserAdminMsg(""), 4000);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-bold mb-1">গ্রাহকের নাম *</label>
                <input
                  type="text"
                  required
                  value={creatingNewCustomer.name}
                  onChange={(e) =>
                    setCreatingNewCustomer({ ...creatingNewCustomer, name: e.target.value })
                  }
                  placeholder="যেমন: সাকিব আল হাসান"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">ইউজারনেম *</label>
                <input
                  type="text"
                  required
                  value={creatingNewCustomer.username}
                  onChange={(e) =>
                    setCreatingNewCustomer({ ...creatingNewCustomer, username: e.target.value })
                  }
                  placeholder="যেমন: sakib_pes"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  value={creatingNewCustomer.phone}
                  onChange={(e) =>
                    setCreatingNewCustomer({ ...creatingNewCustomer, phone: e.target.value })
                  }
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">ইমেইল অ্যাড্রেস *</label>
                <input
                  type="email"
                  required
                  value={creatingNewCustomer.email}
                  onChange={(e) =>
                    setCreatingNewCustomer({ ...creatingNewCustomer, email: e.target.value })
                  }
                  placeholder="customer@gmail.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-amber-300 font-bold mb-1">পাসওয়ার্ড *</label>
                <input
                  type="text"
                  required
                  value={creatingNewCustomer.password}
                  onChange={(e) =>
                    setCreatingNewCustomer({ ...creatingNewCustomer, password: e.target.value })
                  }
                  placeholder="কমপক্ষে ৪ অক্ষর"
                  className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-amber-300 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreatingNewCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold cursor-pointer"
                >
                  অ্যাকাউন্ট তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
