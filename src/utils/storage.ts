import { 
  Order, 
  OrderStatus, 
  OrderStatusHistoryEntry,
  OrderNotificationLog,
  AdminSecurityConfig, 
  BlockedUser, 
  CustomerAccount, 
  RegisteredUserAccount,
  ShopSettings,
  LiveChatMessage 
} from "../types";
import { triggerDesktopNotification, playOrderNotificationSound } from "./notification";
import { SITE, PAYMENTS } from "../config";
import { convertBnToEnDigits, formatBdWhatsappForUrl } from "./order";
import {
  computeOrderOwnershipSignature,
  verifyOrderUserRelationship,
} from "./orderNotification";

const STORAGE_KEY = "nextgen_efootball_orders_v2";
const ADMIN_STATUS_KEY = "nextgen_admin_online_status";
const ADMIN_SECURITY_KEY = "nextgen_admin_security_v1";
const BLOCKED_USERS_KEY = "nextgen_blocked_users_v1";
const FAILED_STRIKES_KEY = "nextgen_failed_strikes_v1";
const SHOP_SETTINGS_KEY = "nextgen_shop_settings_v1";
const ACTIVE_CUSTOMER_PHONE_KEY = "nextgen_active_customer_phone";
const REGISTERED_USERS_KEY = "nextgen_registered_users_v1";
const ACTIVE_USER_ID_KEY = "nextgen_active_user_id_v1";
const LIVE_CHAT_KEY = "nextgen_live_chat_messages_v1";
const NOTIFICATION_LOGS_KEY = "nextgen_order_notification_logs_v1";

export function isAdminSessionAuthorized(): boolean {
  try {
    return sessionStorage.getItem("nextgen_admin_auth") === "true";
  } catch {
    return false;
  }
}

// ===== 1. ADMIN ONLINE / OFFLINE STATUS =====
export function getAdminOnlineStatus(): boolean {
  try {
    const val = localStorage.getItem(ADMIN_STATUS_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setAdminOnlineStatus(isOnline: boolean): void {
  try {
    localStorage.setItem(ADMIN_STATUS_KEY, isOnline ? "true" : "false");
    window.dispatchEvent(new CustomEvent("nextgen_admin_status_changed", { detail: isOnline }));
  } catch (err) {
    console.error("Failed to save admin status", err);
  }
}

// ===== 2. ADMIN PASSWORD & SECURITY CREDENTIALS =====
const DEFAULT_SECURITY_CONFIG: AdminSecurityConfig = {
  adminPin: SITE.adminPin || "2026",
  securityEmail: "shuaivehasanfahim@gmail.com",
  securityPassword: "NextGen2026@Secure",
  updatedAt: new Date().toISOString()
};

export function getAdminSecurityConfig(): AdminSecurityConfig {
  try {
    const raw = localStorage.getItem(ADMIN_SECURITY_KEY);
    if (!raw) {
      localStorage.setItem(ADMIN_SECURITY_KEY, JSON.stringify(DEFAULT_SECURITY_CONFIG));
      return DEFAULT_SECURITY_CONFIG;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SECURITY_CONFIG;
  }
}

export function updateAdminSecurityConfig(newConfig: Partial<AdminSecurityConfig>): AdminSecurityConfig {
  const current = getAdminSecurityConfig();
  const updated: AdminSecurityConfig = {
    ...current,
    ...newConfig,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(ADMIN_SECURITY_KEY, JSON.stringify(updated));
  return updated;
}

export function verifySecurityCredentials(email: string, pass: string): boolean {
  const current = getAdminSecurityConfig();
  return (
    current.securityEmail.trim().toLowerCase() === email.trim().toLowerCase() &&
    current.securityPassword.trim() === pass.trim()
  );
}

// ===== 3. SHOP & PRICING SETTINGS =====
const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  siteName: SITE.name,
  tagline: SITE.tagline,
  whatsapp: SITE.whatsapp,
  whatsappDisplay: SITE.whatsappDisplay,
  facebookUrl: "https://facebook.com/nextgenefootball01",
  supportHours: SITE.supportHours,
  noticeText: "🔥 eFootball 2026 স্পেশাল অফার! ১০০% নিরাপদ অফিশিয়াল টপ-আপ ও ৫-১০ মিনিটে ফাস্ট ডেলিভারি।",
  bkashNumber: PAYMENTS[0]?.number || "01629802989",
  nagadNumber: PAYMENTS[1]?.number || "01629802989",
  autoWhatsappPhone: "01629802989",
  callmebotApiKey: "",
  whatsappWebhookUrl: "",
  telegramBotToken: "",
  telegramChatId: "",
  discordWebhookUrl: ""
};

export function getShopSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(SHOP_SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(SHOP_SETTINGS_KEY, JSON.stringify(DEFAULT_SHOP_SETTINGS));
      return DEFAULT_SHOP_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    if (parsed.noticeText && parsed.noticeText.includes("রেফার")) {
      parsed.noticeText = DEFAULT_SHOP_SETTINGS.noticeText;
      localStorage.setItem(SHOP_SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SHOP_SETTINGS, ...parsed }));
    }
    return { ...DEFAULT_SHOP_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SHOP_SETTINGS;
  }
}

export function updateShopSettings(updates: Partial<ShopSettings>): ShopSettings {
  const current = getShopSettings();
  const updated = { ...current, ...updates };
  localStorage.setItem(SHOP_SETTINGS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("nextgen_shop_settings_updated", { detail: updated }));
  return updated;
}

// ===== 4. BLOCKED USERS & 3-STRIKE FRAUD PROTECTION =====
export function getBlockedUsers(): BlockedUser[] {
  try {
    const raw = localStorage.getItem(BLOCKED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getStrikesMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FAILED_STRIKES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function normalizePhoneKey(phone: string): string {
  if (!phone) return "";
  const en = convertBnToEnDigits(phone);
  let digits = en.replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(2);
  else if (digits.startsWith("88") && digits.length > 11) digits = digits.slice(2);
  return digits;
}

export function isPhoneBlocked(phone: string): { blocked: boolean; reason?: string } {
  if (!phone) return { blocked: false };
  const key = normalizePhoneKey(phone);
  const list = getBlockedUsers();
  const found = list.find(b => normalizePhoneKey(b.phone) === key);
  if (found) {
    return { blocked: true, reason: found.reason };
  }
  return { blocked: false };
}

export function blockUserManual(phone: string, reason: string): void {
  const key = normalizePhoneKey(phone);
  const list = getBlockedUsers().filter(b => normalizePhoneKey(b.phone) !== key);
  const strikes = getStrikesMap();
  const count = strikes[key] || 3;
  list.unshift({
    phone,
    reason: reason || "৩ বার ভুল Konami আইডি বা পেমেন্ট সাবমিট করায় ব্লক",
    blockedAt: new Date().toISOString(),
    failedStrikes: count
  });
  localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("nextgen_blocked_users_updated"));
}

export function unblockUser(phone: string): void {
  const key = normalizePhoneKey(phone);
  const list = getBlockedUsers().filter(b => normalizePhoneKey(b.phone) !== key);
  localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(list));
  
  const strikes = getStrikesMap();
  delete strikes[key];
  localStorage.setItem(FAILED_STRIKES_KEY, JSON.stringify(strikes));

  window.dispatchEvent(new Event("nextgen_blocked_users_updated"));
}

export function recordFailedStrike(phone: string, reason: string): { strikes: number; blocked: boolean } {
  const key = normalizePhoneKey(phone);
  const strikes = getStrikesMap();
  const current = (strikes[key] || 0) + 1;
  strikes[key] = current;
  localStorage.setItem(FAILED_STRIKES_KEY, JSON.stringify(strikes));

  let blocked = false;
  if (current >= 3) {
    blocked = true;
    blockUserManual(phone, `৩ বার ভুল তথ্য সাবমিট (${reason})`);
  }
  return { strikes: current, blocked };
}

// ===== 5. ACTIVE CUSTOMER PHONE =====
export function getActiveCustomerPhone(): string {
  try {
    return localStorage.getItem(ACTIVE_CUSTOMER_PHONE_KEY) || "";
  } catch {
    return "";
  }
}

export function setActiveCustomerPhone(phone: string): void {
  try {
    localStorage.setItem(ACTIVE_CUSTOMER_PHONE_KEY, phone.trim());
    window.dispatchEvent(new CustomEvent("nextgen_customer_phone_changed", { detail: phone.trim() }));
  } catch (err) {
    console.error("Failed to set active customer phone", err);
  }
}

// ===== 6. REFERRAL BONUS LOGIC =====
export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  completedReferrals: number;
  earnedBonus: number; // 10 Tk per completed referral
  usedBonus: number;
  availableBonus: number;
}

export function getReferralStats(phone: string): ReferralStats {
  const cleanPhone = normalizePhoneKey(phone);
  if (!cleanPhone) {
    return {
      referralCode: "",
      totalReferrals: 0,
      completedReferrals: 0,
      earnedBonus: 0,
      usedBonus: 0,
      availableBonus: 0
    };
  }

  const allOrders = getOrders();
  
  // Find orders where another person used this phone as their referral code
  const referredOrders = allOrders.filter(o => {
    if (!o.referredBy) return false;
    const refKey = normalizePhoneKey(o.referredBy);
    const selfKey = normalizePhoneKey(o.phone);
    // Ignore self-referrals
    return refKey === cleanPhone && selfKey !== cleanPhone;
  });

  const totalReferrals = referredOrders.length;
  const completedReferrals = referredOrders.filter(o => o.status === "completed").length;
  const earnedBonus = completedReferrals * 10;

  // Find how much discount this user has already applied on their own orders
  const myOrders = allOrders.filter(o => normalizePhoneKey(o.phone) === cleanPhone);
  const usedBonus = myOrders.reduce((sum, o) => sum + (o.referralDiscountApplied || 0), 0);
  const availableBonus = Math.max(0, earnedBonus - usedBonus);

  return {
    referralCode: phone,
    totalReferrals,
    completedReferrals,
    earnedBonus,
    usedBonus,
    availableBonus
  };
}

// ===== 7. REGISTERED USER ACCOUNTS & FULL ADMIN ACCESS =====
const INITIAL_DEMO_USERS: RegisteredUserAccount[] = [
  {
    id: "usr_tanvir_01",
    username: "tanvir26",
    email: "tanvir.konami@gmail.com",
    phone: "01711223344",
    name: "তানভীর আহমেদ",
    password: "tanvir123",
    googleConnected: true,
    emailVerified: true,
    createdAt: "2026-01-15T10:00:00.000Z"
  },
  {
    id: "usr_rakib_02",
    username: "rakib_pes",
    email: "rakib_efootball26@gmail.com",
    phone: "01855667788",
    name: "রাকিবুল হাসান",
    password: "rakib2026",
    googleConnected: false,
    emailVerified: false,
    createdAt: "2026-02-10T14:30:00.000Z"
  }
];

export function getRegisteredUsers(): RegisteredUserAccount[] {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (!raw) {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(INITIAL_DEMO_USERS));
      return INITIAL_DEMO_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_USERS;
  }
}

export function saveRegisteredUsers(users: RegisteredUserAccount[]): void {
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event("nextgen_user_account_updated"));
  } catch (err) {
    console.error("Failed to save registered users", err);
  }
}

export function getActiveUserAccount(): RegisteredUserAccount | null {
  try {
    const id = localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (!id) return null;
    const users = getRegisteredUsers();
    return users.find(u => u.id === id) || null;
  } catch {
    return null;
  }
}

export function setActiveUserAccount(userId: string | null): void {
  try {
    if (!userId) {
      localStorage.removeItem(ACTIVE_USER_ID_KEY);
    } else {
      localStorage.setItem(ACTIVE_USER_ID_KEY, userId);
      const users = getRegisteredUsers();
      const found = users.find(u => u.id === userId);
      if (found && found.phone) {
        setActiveCustomerPhone(found.phone);
      }
    }
    window.dispatchEvent(new Event("nextgen_user_account_updated"));
  } catch (err) {
    console.error("Failed to set active user account", err);
  }
}

export function registerUserAccount(params: {
  username: string;
  email?: string;
  phone?: string;
  name?: string;
  password: string;
}): { ok: boolean; error?: string; user?: RegisteredUserAccount } {
  const users = getRegisteredUsers();
  const rawIdentifier = params.username.trim();
  const isEmailInput = rawIdentifier.includes("@");
  const email = (params.email?.trim() || (isEmailInput ? rawIdentifier : "")).toLowerCase();
  const username = (isEmailInput ? rawIdentifier.split("@")[0] : rawIdentifier).trim().toLowerCase();
  const phone = params.phone ? convertBnToEnDigits(params.phone.trim()) : "";
  const password = params.password.trim();

  if (!username && !email) {
    return { ok: false, error: "ইউজারনেম অথবা ইমেইল দিন।" };
  }
  if (!password || password.length < 4) {
    return { ok: false, error: "কমপক্ষে ৪ অক্ষরের একটি পাসওয়ার্ড দিন।" };
  }

  // Check duplicate username or email
  const exists = users.find(
    u =>
      (username && u.username.toLowerCase() === username) ||
      (email && u.email && u.email.toLowerCase() === email) ||
      (phone && u.phone && normalizePhoneKey(u.phone) === normalizePhoneKey(phone))
  );

  if (exists) {
    return {
      ok: false,
      error: "এই ইউজারনেম, ইমেইল বা নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে! অনুগ্রহ করে লগইন করুন।"
    };
  }

  const newUser: RegisteredUserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    username: username || email.split("@")[0] || `user${Date.now().toString().slice(-4)}`,
    email,
    phone,
    name: params.name?.trim() || username || email.split("@")[0] || "গ্রাহক",
    password,
    googleConnected: false,
    emailVerified: false,
    createdAt: new Date().toISOString()
  };

  const updated = [newUser, ...users];
  saveRegisteredUsers(updated);
  setActiveUserAccount(newUser.id);
  if (newUser.phone) {
    setActiveCustomerPhone(newUser.phone);
  }
  return { ok: true, user: newUser };
}

export function loginUserAccount(
  identifier: string,
  password: string
): { ok: boolean; error?: string; user?: RegisteredUserAccount } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPhone = normalizePhoneKey(identifier);
  const cleanPass = password.trim();

  if (!cleanId || !cleanPass) {
    return { ok: false, error: "ইউজারনেম/ইমেইল এবং পাসওয়ার্ড লিখুন।" };
  }

  const users = getRegisteredUsers();
  const found = users.find(
    u =>
      u.username.toLowerCase() === cleanId ||
      (u.email && u.email.toLowerCase() === cleanId) ||
      (cleanPhone && u.phone && normalizePhoneKey(u.phone) === cleanPhone)
  );

  if (!found) {
    return {
      ok: false,
      error: "এই ইউজারনেম বা ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করুন।"
    };
  }

  if (found.password !== cleanPass) {
    return {
      ok: false,
      error: "পাসওয়ার্ড সঠিক নয়! পাসওয়ার্ড ভুলে গেলে নিচে এডমিনের সাথে যোগাযোগ করুন।"
    };
  }

  setActiveUserAccount(found.id);
  if (found.phone) {
    setActiveCustomerPhone(found.phone);
  }
  return { ok: true, user: found };
}

export function connectGoogleUserAccount(params: {
  email: string;
  name?: string;
  phone?: string;
}): RegisteredUserAccount {
  const cleanEmail = params.email.trim().toLowerCase();
  const users = getRegisteredUsers();
  const existingIdx = users.findIndex(
    u =>
      (u.email && u.email.toLowerCase() === cleanEmail) ||
      u.username.toLowerCase() === cleanEmail.split("@")[0]
  );

  if (existingIdx !== -1) {
    const updatedUser: RegisteredUserAccount = {
      ...users[existingIdx],
      email: cleanEmail,
      name: params.name?.trim() || users[existingIdx].name,
      phone: params.phone?.trim() || users[existingIdx].phone,
      googleConnected: true,
      emailVerified: true
    };
    users[existingIdx] = updatedUser;
    saveRegisteredUsers(users);
    setActiveUserAccount(updatedUser.id);
    if (updatedUser.phone) setActiveCustomerPhone(updatedUser.phone);
    return updatedUser;
  }

  const baseUsername = cleanEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase() || "gamer";
  const newUser: RegisteredUserAccount = {
    id: `usr_g_${Date.now()}`,
    username: baseUsername,
    email: cleanEmail,
    phone: params.phone ? convertBnToEnDigits(params.phone.trim()) : "",
    name: params.name?.trim() || cleanEmail.split("@")[0],
    password: `G-${Math.random().toString(36).slice(2, 8)}`,
    googleConnected: true,
    emailVerified: true,
    createdAt: new Date().toISOString()
  };

  saveRegisteredUsers([newUser, ...users]);
  setActiveUserAccount(newUser.id);
  if (newUser.phone) setActiveCustomerPhone(newUser.phone);
  return newUser;
}

export function updateRegisteredUser(
  userId: string,
  updates: Partial<RegisteredUserAccount>
): RegisteredUserAccount | null {
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;

  users[idx] = {
    ...users[idx],
    ...updates
  };
  saveRegisteredUsers(users);
  if (users[idx].phone && getActiveUserAccount()?.id === userId) {
    setActiveCustomerPhone(users[idx].phone);
  }
  return users[idx];
}

export function changeUserEmailWithPassword(params: {
  userId: string;
  newEmail: string;
  password: string;
}): { ok: boolean; error?: string; user?: RegisteredUserAccount } {
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => u.id === params.userId);
  if (idx === -1) {
    return { ok: false, error: "ইউজার অ্যাকাউন্ট পাওয়া যায়নি।" };
  }

  const targetUser = users[idx];
  const cleanNewEmail = params.newEmail.trim().toLowerCase();
  const cleanPass = params.password.trim();

  if (!cleanNewEmail || !cleanNewEmail.includes("@") || !cleanNewEmail.includes(".")) {
    return { ok: false, error: "অনুগ্রহ করে একটি সঠিক নতুন ইমেইল অ্যাড্রেস লিখুন।" };
  }

  if (cleanNewEmail === (targetUser.email || "").trim().toLowerCase()) {
    return { ok: false, error: "নতুন ইমেইল অ্যাড্রেসটি আপনার বর্তমান ইমেইলের মতোই। আলাদা ইমেইল দিন।" };
  }

  if (!cleanPass) {
    return { ok: false, error: "ইমেইল অ্যাড্রেস পরিবর্তন করতে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।" };
  }

  if (targetUser.password && cleanPass !== targetUser.password.trim()) {
    return { ok: false, error: "আপনার দেওয়া পাসওয়ার্ডটি সঠিক নয়! পাসওয়ার্ড ভুলে গেলে এডমিনের সাথে যোগাযোগ করুন।" };
  }

  // Check if another user already uses this email
  const duplicate = users.find(
    u => u.id !== targetUser.id && u.email && u.email.trim().toLowerCase() === cleanNewEmail
  );
  if (duplicate) {
    return { ok: false, error: "এই ইমেইল অ্যাড্রেস দিয়ে ইতিমধ্যে অন্য একটি অ্যাকাউন্ট খোলা আছে!" };
  }

  const updatedUser: RegisteredUserAccount = {
    ...targetUser,
    email: cleanNewEmail,
    emailVerified: false,
    verificationCode: undefined
  };

  users[idx] = updatedUser;
  saveRegisteredUsers(users);
  return { ok: true, user: updatedUser };
}

export function deleteRegisteredUser(userId: string): void {
  const users = getRegisteredUsers().filter(u => u.id !== userId);
  saveRegisteredUsers(users);
  if (getActiveUserAccount()?.id === userId) {
    setActiveUserAccount(null);
  }
}

export function getOrdersForUserAccount(user: RegisteredUserAccount): Order[] {
  const allOrders = getOrders();
  return allOrders.filter(o => verifyOrderUserRelationship(o, user).verified);
}

export function getCustomerAccount(phoneOrIdentifier: string): CustomerAccount {
  const regUsers = getRegisteredUsers();
  const cleanKey = normalizePhoneKey(phoneOrIdentifier);
  const lowerId = phoneOrIdentifier.trim().toLowerCase();

  const matchedUser = regUsers.find(
    u =>
      u.id === phoneOrIdentifier ||
      u.username.toLowerCase() === lowerId ||
      (u.email && u.email.toLowerCase() === lowerId) ||
      (cleanKey && u.phone && normalizePhoneKey(u.phone) === cleanKey)
  );

  const orders = matchedUser
    ? getOrdersForUserAccount(matchedUser)
    : getOrdersByPhone(phoneOrIdentifier);

  const effectivePhone = matchedUser?.phone || phoneOrIdentifier;
  const effectivePhoneKey = normalizePhoneKey(effectivePhone);
  const strikes = effectivePhoneKey ? getStrikesMap()[effectivePhoneKey] || 0 : 0;
  const blockCheck = effectivePhone ? isPhoneBlocked(effectivePhone) : { blocked: false };

  const completed = orders.filter(o => o.status === "completed");
  const cancelled = orders.filter(o => o.status === "cancelled");
  const processing = orders.filter(o => o.status === "processing");
  const pending = orders.filter(o => o.status === "pending");

  const totalSpent = completed.reduce((sum, o) => sum + o.price, 0);
  const latestName = matchedUser?.name || orders[0]?.name || "গ্রাহক";

  const refStats = getReferralStats(effectivePhone);

  return {
    id: matchedUser?.id,
    username: matchedUser?.username,
    email: matchedUser?.email,
    password: matchedUser?.password,
    googleConnected: matchedUser?.googleConnected,
    emailVerified: matchedUser?.emailVerified,
    createdAt: matchedUser?.createdAt,
    phone: effectivePhone,
    name: latestName,
    totalOrders: orders.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    processingOrders: processing.length,
    pendingOrders: pending.length,
    totalSpent,
    failedAttempts: strikes,
    isBlocked: blockCheck.blocked,
    blockReason: blockCheck.reason,
    referralCode: effectivePhone,
    referredFriendsCount: refStats.totalReferrals,
    completedReferralsCount: refStats.completedReferrals,
    earnedReferralBonus: refStats.earnedBonus,
    usedReferralBonus: refStats.usedBonus,
    availableReferralBonus: refStats.availableBonus
  };
}

export function getAllCustomerAccounts(): CustomerAccount[] {
  const regUsers = getRegisteredUsers();
  const orders = getOrders();
  const seenPhones = new Set<string>();
  const accounts: CustomerAccount[] = [];

  // 1. Add all registered user accounts first
  regUsers.forEach(u => {
    if (u.phone) seenPhones.add(normalizePhoneKey(u.phone));
    accounts.push(getCustomerAccount(u.id));
  });

  // 2. Add any guest order phones that aren't in registered accounts
  const guestPhoneMap = new Map<string, string>();
  orders.forEach(o => {
    if (o.phone) {
      const k = normalizePhoneKey(o.phone);
      if (k && !seenPhones.has(k)) guestPhoneMap.set(k, o.phone);
    }
  });

  guestPhoneMap.forEach((origPhone) => {
    accounts.push(getCustomerAccount(origPhone));
  });

  return accounts.sort((a, b) => b.totalOrders - a.totalOrders || b.totalSpent - a.totalSpent);
}

// ===== 8. ORDERS STORAGE =====
const INITIAL_DEMO_ORDERS: Order[] = [
  {
    orderNo: "EF8839201",
    time: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    statusUpdatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    userId: "usr_tanvir_01",
    customerEmail: "tanvir.konami@gmail.com",
    ownershipSignature: computeOrderOwnershipSignature({
      orderNo: "EF8839201",
      userId: "usr_tanvir_01",
      email: "tanvir.konami@gmail.com",
      phone: "01711223344",
    }),
    statusHistory: [
      {
        status: "pending",
        updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        updatedBy: "customer",
        note: "অর্ডার তৈরি করা হয়েছে",
      },
      {
        status: "processing",
        updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
        updatedBy: "admin",
        note: "পেমেন্ট ভেরিফাই ও লগইন প্রসেসিং শুরু",
      },
      {
        status: "completed",
        updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        updatedBy: "admin",
        note: "কয়েন ইন-গেম ডেলিভারি সফলভাবে সম্পন্ন হয়েছে।",
      },
    ],
    name: "তানভীর আহমেদ",
    phone: "01711223344",
    contactMethod: "whatsapp",
    contactHandle: "01711223344",
    otpWhatsapp: "01711223344",
    konamiIdOrEmail: "tanvir.konami@gmail.com",
    konamiPassword: "Password123#",
    platform: "Android",
    items: [
      {
        id: "p8",
        name: "৫,৭০০ কয়েন",
        price: 5350,
        coins: 5700,
        quantity: 1,
        category: "regular"
      }
    ],
    packageName: "৫,৭০০ কয়েন (সেরা দাম)",
    price: 5350,
    coins: 5700,
    paymentMethod: "bKash (বিকাশ)",
    senderNumber: "01711223344",
    trxId: "9K8M2P4Q1W",
    status: "completed",
    adminNotes: "কয়েন ইন-গেম ডেলিভারি সফলভাবে সম্পন্ন হয়েছে।",
    paymentConfirmed: true,
    loginStartSent: true,
    userActiveConfirmed: true,
    otpRequested: true,
    customerNote: "দ্রুত ডেলিভারি দিলে খুব উপকার হবে।"
  },
  {
    orderNo: "EF9140285",
    time: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    statusUpdatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    userId: "usr_rakib_02",
    customerEmail: "rakib_efootball26@gmail.com",
    ownershipSignature: computeOrderOwnershipSignature({
      orderNo: "EF9140285",
      userId: "usr_rakib_02",
      email: "rakib_efootball26@gmail.com",
      phone: "01855667788",
    }),
    statusHistory: [
      {
        status: "pending",
        updatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        updatedBy: "customer",
        note: "অর্ডার তৈরি করা হয়েছে",
      },
    ],
    name: "রাকিবুল হাসান",
    phone: "01855667788",
    contactMethod: "facebook",
    contactHandle: "https://facebook.com/rakib.pes.gamer",
    otpWhatsapp: "01855667788",
    konamiIdOrEmail: "rakib_efootball26@gmail.com",
    konamiPassword: "KonamiRakib2026",
    platform: "Android",
    items: [
      {
        id: "pp3",
        name: "Combo: Suárez Pack + Casillas Pack",
        price: 420,
        coins: 150,
        quantity: 1,
        category: "player_pack",
        image: "/assets/aistudio/Screenshot_20260929-225847_72392c40.png"
      }
    ],
    packageName: "Combo: Suárez Pack + Casillas Pack",
    price: 420,
    coins: 150,
    paymentMethod: "Nagad (নগদ)",
    senderNumber: "01855667788",
    trxId: "7H3L9J2N4V",
    status: "pending",
    referredBy: "01711223344",
    customerNote: "আমার হোয়াটসঅ্যাপ নেই, ফেসবুক বা ওয়েবসাইটের লাইভ চ্যাটে যোগাযোগ করবেন প্লিজ।"
  }
];

export function getOrders(): Order[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
      return INITIAL_DEMO_ORDERS;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load orders from storage", err);
    return INITIAL_DEMO_ORDERS;
  }
}

export function saveOrder(order: Order): void {
  try {
    const orders = getOrders();
    const nowIso = order.time || new Date().toISOString();
    const enrichedOrder: Order = {
      ...order,
      statusUpdatedAt: order.statusUpdatedAt || nowIso,
      ownershipSignature:
        order.ownershipSignature ||
        computeOrderOwnershipSignature({
          orderNo: order.orderNo,
          userId: order.userId,
          email:
            order.customerEmail ||
            order.paymentLinkGmail ||
            (order.konamiIdOrEmail?.includes("@") ? order.konamiIdOrEmail : ""),
          phone: order.phone,
        }),
      statusHistory:
        order.statusHistory && order.statusHistory.length > 0
          ? order.statusHistory
          : [
              {
                status: order.status || "pending",
                updatedAt: nowIso,
                updatedBy: "customer",
                note: "অর্ডার তৈরি করা হয়েছে (Order Created)",
              },
            ],
    };

    const updated = [enrichedOrder, ...orders.filter(o => o.orderNo !== enrichedOrder.orderNo)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Automatically set active customer phone
    if (enrichedOrder.phone) {
      setActiveCustomerPhone(enrichedOrder.phone);
    }

    window.dispatchEvent(new CustomEvent("nextgen_orders_updated", { detail: enrichedOrder }));
    
    // Trigger desktop notification & sound
    triggerDesktopNotification(
      `🔔 নতুন অর্ডার: ${enrichedOrder.orderNo}`,
      `${enrichedOrder.name} - ${enrichedOrder.packageName} (৳ ${enrichedOrder.price.toLocaleString("bn-BD")})`
    );
  } catch (err) {
    console.error("Failed to save order to storage", err);
  }
}

export function getOrderById(orderNo: string): Order | undefined {
  const orders = getOrders();
  return orders.find(o => o.orderNo.toLowerCase() === orderNo.trim().toLowerCase());
}

export function getOrdersByPhone(phone: string): Order[] {
  if (!phone) return [];
  const clean = normalizePhoneKey(phone);
  if (!clean) return [];
  const orders = getOrders();
  return orders.filter(o => {
    const p1 = normalizePhoneKey(o.phone);
    const p2 = normalizePhoneKey(o.otpWhatsapp);
    return p1.includes(clean) || p2.includes(clean) || clean.includes(p1) || clean.includes(p2);
  });
}

export function updateOrderStatus(
  orderNo: string,
  status: OrderStatus,
  adminNotes?: string,
  options?: { requireAdminAuth?: boolean; updatedBy?: "admin" | "customer" }
): Order | undefined {
  if (options?.requireAdminAuth && !isAdminSessionAuthorized()) {
    console.warn("Unauthorized attempt to change order status blocked.");
    return undefined;
  }

  const orders = getOrders();
  const idx = orders.findIndex(o => o.orderNo === orderNo);
  if (idx === -1) return undefined;

  const nowIso = new Date().toISOString();
  const prevHistory: OrderStatusHistoryEntry[] = orders[idx].statusHistory || [
    {
      status: orders[idx].status,
      updatedAt: orders[idx].time,
      updatedBy: "customer",
    },
  ];

  const nextEntry: OrderStatusHistoryEntry = {
    status,
    updatedAt: nowIso,
    updatedBy: options?.updatedBy || "admin",
    note: adminNotes !== undefined ? adminNotes : undefined,
  };

  orders[idx] = {
    ...orders[idx],
    status,
    statusUpdatedAt: nowIso,
    statusHistory: [...prevHistory, nextEntry],
    ...(adminNotes !== undefined ? { adminNotes } : {})
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("nextgen_orders_updated"));
  return orders[idx];
}

export function updateOrderDetails(orderNo: string, updates: Partial<Order>): Order | undefined {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.orderNo === orderNo);
  if (idx === -1) return undefined;

  const nowIso = new Date().toISOString();
  const statusChanged = updates.status && updates.status !== orders[idx].status;
  const prevHistory: OrderStatusHistoryEntry[] = orders[idx].statusHistory || [
    {
      status: orders[idx].status,
      updatedAt: orders[idx].time,
      updatedBy: "customer",
    },
  ];

  orders[idx] = {
    ...orders[idx],
    ...updates,
    ...(statusChanged
      ? {
          statusUpdatedAt: nowIso,
          statusHistory: [
            ...prevHistory,
            {
              status: updates.status!,
              updatedAt: nowIso,
              updatedBy: "admin",
              note: updates.adminNotes,
            },
          ],
        }
      : {}),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("nextgen_orders_updated"));
  return orders[idx];
}

export function deleteOrder(orderNo: string): boolean {
  const orders = getOrders();
  const filtered = orders.filter(o => o.orderNo !== orderNo);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new Event("nextgen_orders_updated"));
  return true;
}

// ===== 8B. ORDER NOTIFICATION LOGS & IDEMPOTENCY STORAGE =====
export function getNotificationLogs(orderNo?: string): OrderNotificationLog[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_LOGS_KEY);
    const logs: OrderNotificationLog[] = raw ? JSON.parse(raw) : [];
    if (!orderNo) return logs;
    const clean = orderNo.trim().toLowerCase();
    return logs.filter(l => l.orderNo.toLowerCase() === clean);
  } catch {
    return [];
  }
}

export function hasSentNotificationForKey(
  idempotencyKey: string
): OrderNotificationLog | undefined {
  if (!idempotencyKey) return undefined;
  const logs = getNotificationLogs();
  return logs.find(
    l =>
      l.idempotencyKey === idempotencyKey &&
      (l.deliveryStatus === "sent" || l.deliveryStatus === "skipped_duplicate")
  );
}

export function saveNotificationLog(log: OrderNotificationLog): void {
  try {
    const logs = getNotificationLogs();
    const updatedLogs = [log, ...logs.filter(l => l.id !== log.id)].slice(0, 300);
    localStorage.setItem(NOTIFICATION_LOGS_KEY, JSON.stringify(updatedLogs));

    // Also attach to the order's notificationLogs list
    const orders = getOrders();
    const idx = orders.findIndex(
      o => o.orderNo.toLowerCase() === log.orderNo.toLowerCase()
    );
    if (idx !== -1) {
      const existingOrderLogs = orders[idx].notificationLogs || [];
      orders[idx] = {
        ...orders[idx],
        notificationLogs: [
          log,
          ...existingOrderLogs.filter(l => l.id !== log.id),
        ],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }

    window.dispatchEvent(new Event("nextgen_notification_logs_updated"));
    window.dispatchEvent(new Event("nextgen_orders_updated"));
  } catch (err) {
    console.error("Failed to save notification log", err);
  }
}

// ===== 9. WEBSITE LIVE CHAT SYSTEM =====
const INITIAL_DEMO_CHATS: LiveChatMessage[] = [
  {
    id: "chat-1",
    orderNo: "EF9140285",
    phone: "01855667788",
    customerName: "রাকিবুল হাসান",
    sender: "customer",
    text: "আসসালামু আলাইকুম ভাই, আমি পেমেন্ট পাঠিয়ে অর্ডার করেছি। আমার হোয়াটসঅ্যাপ নেই, এখানে ওটিপি দেওয়া যাবে?",
    time: "১০ মিনিট আগে",
    timestamp: Date.now() - 1000 * 60 * 10,
    read: true
  },
  {
    id: "chat-2",
    orderNo: "EF9140285",
    phone: "01855667788",
    customerName: "NextGen Admin",
    sender: "admin",
    text: "ওয়ালাইকুম আসসালাম ভাই! হ্যাঁ সমস্যা নেই, আপনার পেমেন্ট পেয়েছি। কিছুক্ষণের মধ্যে আমরা লগইন শুরু করে এই চ্যাটেই ওটিপি চাইবো, আপনি লাইনে থাকুন।",
    time: "৮ মিনিট আগে",
    timestamp: Date.now() - 1000 * 60 * 8,
    read: true
  }
];

export function getLiveChatMessages(phone?: string, orderNo?: string): LiveChatMessage[] {
  try {
    const raw = localStorage.getItem(LIVE_CHAT_KEY);
    const allChats: LiveChatMessage[] = raw ? JSON.parse(raw) : INITIAL_DEMO_CHATS;
    if (!raw) {
      localStorage.setItem(LIVE_CHAT_KEY, JSON.stringify(INITIAL_DEMO_CHATS));
    }

    if (!phone && !orderNo) {
      return allChats.sort((a, b) => a.timestamp - b.timestamp);
    }

    const cleanPhone = phone ? normalizePhoneKey(phone) : "";

    return allChats
      .filter(c => {
        if (cleanPhone && normalizePhoneKey(c.phone) === cleanPhone) return true;
        if (orderNo && c.orderNo && c.orderNo.toLowerCase() === orderNo.toLowerCase()) return true;
        return false;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch (err) {
    console.error("Failed to load chat messages", err);
    return [];
  }
}

export function sendLiveChatMessage(
  msg: Omit<LiveChatMessage, "id" | "timestamp" | "time">
): LiveChatMessage {
  try {
    const raw = localStorage.getItem(LIVE_CHAT_KEY);
    const allChats: LiveChatMessage[] = raw ? JSON.parse(raw) : INITIAL_DEMO_CHATS;

    const newMsg: LiveChatMessage = {
      ...msg,
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }),
      read: msg.sender === "admin"
    };

    allChats.push(newMsg);
    localStorage.setItem(LIVE_CHAT_KEY, JSON.stringify(allChats));
    window.dispatchEvent(new CustomEvent("nextgen_chat_updated", { detail: newMsg }));

    playOrderNotificationSound();

    if (msg.sender === "customer") {
      triggerDesktopNotification(
        `💬 কাস্টমার মেসেজ (${msg.customerName})`,
        msg.text
      );
    }

    return newMsg;
  } catch (err) {
    console.error("Failed to send chat message", err);
    throw err;
  }
}

export function markChatAsRead(phone: string): void {
  try {
    const raw = localStorage.getItem(LIVE_CHAT_KEY);
    if (!raw) return;
    const clean = normalizePhoneKey(phone);
    const allChats: LiveChatMessage[] = JSON.parse(raw);
    let changed = false;
    allChats.forEach(c => {
      if (normalizePhoneKey(c.phone) === clean && !c.read) {
        c.read = true;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(LIVE_CHAT_KEY, JSON.stringify(allChats));
      window.dispatchEvent(new Event("nextgen_chat_updated"));
    }
  } catch (err) {
    console.error("Failed to mark chat as read", err);
  }
}

export function getAllChatConversations(): {
  phone: string;
  name: string;
  orderNo?: string;
  lastMessage: LiveChatMessage;
  unreadCount: number;
}[] {
  const raw = localStorage.getItem(LIVE_CHAT_KEY);
  const allChats: LiveChatMessage[] = raw ? JSON.parse(raw) : INITIAL_DEMO_CHATS;
  const map = new Map<string, LiveChatMessage[]>();

  allChats.forEach(c => {
    const key = normalizePhoneKey(c.phone) || c.phone;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  });

  const convos: {
    phone: string;
    name: string;
    orderNo?: string;
    lastMessage: LiveChatMessage;
    unreadCount: number;
  }[] = [];

  map.forEach((messages) => {
    messages.sort((a, b) => a.timestamp - b.timestamp);
    const last = messages[messages.length - 1];
    const customerMsg = messages.find(m => m.sender === "customer");
    const name = customerMsg?.customerName || last.customerName || "কাস্টমার";
    const unread = messages.filter(m => m.sender === "customer" && !m.read).length;

    convos.push({
      phone: last.phone,
      name,
      orderNo: last.orderNo,
      lastMessage: last,
      unreadCount: unread
    });
  });

  return convos.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
}
