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
  LiveChatMessage,
  AppNotification,
  CatalogProduct,
  CatalogSection,
  PaymentOptionConfig,
  CartItem
} from "../types";
import { triggerDesktopNotification, playOrderNotificationSound } from "./notification";
import { SITE, PAYMENTS } from "../config";
import { convertBnToEnDigits, formatBdWhatsappForUrl, toBn } from "./order";
import {
  computeOrderOwnershipSignature,
  verifyOrderUserRelationship,
} from "./orderNotification";
import {
  saveCloudStateKey,
  loadCloudStateKey,
  subscribeCloudStateKey,
} from "../firebase";

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
const APP_NOTIFICATIONS_KEY = "nextgen_app_notifications_v1";
const DELETED_CUSTOMERS_KEY = "nextgen_deleted_customers_v1";
const CATALOG_SECTIONS_KEY = "nextgen_catalog_sections_v3";
const CATALOG_PRODUCTS_KEY = "nextgen_catalog_products_v3";
const PAYMENT_OPTIONS_KEY = "nextgen_payment_options_v3";

const KEY_EVENT_MAP: Record<string, string> = {
  [STORAGE_KEY]: "nextgen_orders_updated",
  [SHOP_SETTINGS_KEY]: "nextgen_shop_settings_updated",
  [CATALOG_SECTIONS_KEY]: "nextgen_catalog_sections_updated",
  [CATALOG_PRODUCTS_KEY]: "nextgen_catalog_products_updated",
  [PAYMENT_OPTIONS_KEY]: "nextgen_payment_options_updated",
  [REGISTERED_USERS_KEY]: "nextgen_user_account_updated",
  [BLOCKED_USERS_KEY]: "nextgen_blocked_users_updated",
  [FAILED_STRIKES_KEY]: "nextgen_blocked_users_updated",
  [ADMIN_SECURITY_KEY]: "nextgen_orders_updated",
  [APP_NOTIFICATIONS_KEY]: "nextgen_app_notifications_changed",
  [DELETED_CUSTOMERS_KEY]: "nextgen_orders_updated",
  [ADMIN_STATUS_KEY]: "nextgen_admin_status_changed",
  [NOTIFICATION_LOGS_KEY]: "nextgen_notification_logs_updated",
};

function persistKey(key: string, value: any, customEventName?: string, eventDetail?: any): void {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.error(`Failed to write ${key} to localStorage`, err);
  }

  // 1. Save to Express Server persistent disk store (/api/state)
  if (typeof window !== "undefined") {
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).catch(() => {});
  }

  // 2. Save to Firebase Firestore cloud database
  saveCloudStateKey(key, value).catch(() => {});

  // 3. Dispatch event
  if (typeof window !== "undefined") {
    const evtName = customEventName || KEY_EVENT_MAP[key];
    if (evtName) {
      if (eventDetail !== undefined) {
        window.dispatchEvent(new CustomEvent(evtName, { detail: eventDetail }));
      } else {
        window.dispatchEvent(new Event(evtName));
      }
    }
  }
}

function getDeletedCustomerPhones(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_CUSTOMERS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveDeletedCustomerPhones(set: Set<string>): void {
  persistKey(DELETED_CUSTOMERS_KEY, Array.from(set));
}

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
    if (val === null) return true;
    if (val === "true" || val === "false") return val === "true";
    return Boolean(JSON.parse(val));
  } catch {
    return true;
  }
}

export function setAdminOnlineStatus(isOnline: boolean): void {
  persistKey(ADMIN_STATUS_KEY, isOnline ? "true" : "false", "nextgen_admin_status_changed", isOnline);
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
      return DEFAULT_SECURITY_CONFIG;
    }
    return { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(raw) };
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
  persistKey(ADMIN_SECURITY_KEY, updated);
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
  discordWebhookUrl: "",
  greenApiIdInstance: "71072277414",
  greenApiApiToken: ""
};

export function getShopSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(SHOP_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SHOP_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    if (parsed.noticeText && parsed.noticeText.includes("রেফার")) {
      parsed.noticeText = DEFAULT_SHOP_SETTINGS.noticeText;
    }
    return { ...DEFAULT_SHOP_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SHOP_SETTINGS;
  }
}

export function updateShopSettings(updates: Partial<ShopSettings>): ShopSettings {
  const current = getShopSettings();
  const updated = { ...current, ...updates };
  persistKey(SHOP_SETTINGS_KEY, updated, "nextgen_shop_settings_updated", updated);
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
  persistKey(BLOCKED_USERS_KEY, list, "nextgen_blocked_users_updated");
}

export function unblockUser(phone: string): void {
  const key = normalizePhoneKey(phone);
  const list = getBlockedUsers().filter(b => normalizePhoneKey(b.phone) !== key);
  persistKey(BLOCKED_USERS_KEY, list);
  
  const strikes = getStrikesMap();
  delete strikes[key];
  persistKey(FAILED_STRIKES_KEY, strikes, "nextgen_blocked_users_updated");
}

export function recordFailedStrike(phone: string, reason: string): { strikes: number; blocked: boolean } {
  const key = normalizePhoneKey(phone);
  const strikes = getStrikesMap();
  const current = (strikes[key] || 0) + 1;
  strikes[key] = current;
  persistKey(FAILED_STRIKES_KEY, strikes);

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
      return INITIAL_DEMO_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_USERS;
  }
}

export function saveRegisteredUsers(users: RegisteredUserAccount[]): void {
  persistKey(REGISTERED_USERS_KEY, users, "nextgen_user_account_updated");
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

/**
 * Automatically ensures an account exists for guest orders:
 * If an account already exists with this phone, links it.
 * Otherwise creates a new account with:
 * - username: user's mobile number
 * - password: user's mobile number
 * And automatically logs the user in.
 */
export function getOrCreateUserForGuestOrder(params: {
  phone: string;
  name: string;
  email?: string;
}): { user: RegisteredUserAccount; isNewAccount: boolean } {
  const users = getRegisteredUsers();
  const rawPhone = convertBnToEnDigits(params.phone.trim());
  const phoneKey = normalizePhoneKey(rawPhone);
  const cleanEmail = (params.email || "").trim().toLowerCase();

  // 1. Look for existing registered user matching phone, username, or email
  const existing = users.find(
    (u) =>
      (u.phone && normalizePhoneKey(u.phone) === phoneKey) ||
      (u.username && u.username.toLowerCase() === rawPhone.toLowerCase()) ||
      (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
  );

  if (existing) {
    let shouldSave = false;
    let updated = { ...existing };
    if (!updated.email && cleanEmail && cleanEmail.includes("@")) {
      updated.email = cleanEmail;
      shouldSave = true;
    }
    if ((!updated.name || updated.name === "গ্রাহক") && params.name?.trim()) {
      updated.name = params.name.trim();
      shouldSave = true;
    }
    if (shouldSave) {
      const idx = users.findIndex((u) => u.id === existing.id);
      if (idx !== -1) {
        users[idx] = updated;
        saveRegisteredUsers(users);
      }
    }
    setActiveUserAccount(updated.id);
    if (updated.phone) setActiveCustomerPhone(updated.phone);
    return { user: updated, isNewAccount: false };
  }

  // 2. No account exists: Auto-create account with username = phone and password = phone
  const newUser: RegisteredUserAccount = {
    id: `usr_auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    username: rawPhone,
    phone: rawPhone,
    password: rawPhone,
    name: params.name?.trim() || rawPhone,
    email: cleanEmail && cleanEmail.includes("@") ? cleanEmail : "",
    googleConnected: false,
    emailVerified: false,
    autoCreatedFromOrder: true,
    createdAt: new Date().toISOString(),
  };

  const updatedUsers = [newUser, ...users];
  saveRegisteredUsers(updatedUsers);
  setActiveUserAccount(newUser.id);
  setActiveCustomerPhone(rawPhone);
  return { user: newUser, isNewAccount: true };
}

export function isUserUsingDefaultPassword(user: RegisteredUserAccount | null): boolean {
  if (!user) return false;
  if (user.autoCreatedFromOrder && user.password === user.phone) return true;
  if (user.phone && user.password && user.password === user.phone) return true;
  if (user.username && user.password && user.password === user.username) return true;
  return false;
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
  const users = getRegisteredUsers();
  const target = users.find(u => u.id === userId);
  if (target && target.phone) {
    const delSet = getDeletedCustomerPhones();
    delSet.add(normalizePhoneKey(target.phone));
    saveDeletedCustomerPhones(delSet);
  }
  const filtered = users.filter(u => u.id !== userId);
  saveRegisteredUsers(filtered);
  if (getActiveUserAccount()?.id === userId) {
    setActiveUserAccount(null);
  }
}

export function deleteCustomerAccount(params: {
  id?: string;
  phone?: string;
  deleteOrders?: boolean;
}): void {
  const normPhone = params.phone ? normalizePhoneKey(params.phone) : "";

  // 1. Remove from registered users by id or phone
  const users = getRegisteredUsers();
  const filteredUsers = users.filter(u => {
    if (params.id && u.id === params.id) return false;
    if (normPhone && u.phone && normalizePhoneKey(u.phone) === normPhone) return false;
    return true;
  });
  saveRegisteredUsers(filteredUsers);

  // 2. Clear active user/phone session if it matches the deleted customer
  const activeUser = getActiveUserAccount();
  if (
    (params.id && activeUser?.id === params.id) ||
    (normPhone && activeUser?.phone && normalizePhoneKey(activeUser.phone) === normPhone)
  ) {
    setActiveUserAccount(null);
  }
  const activePhone = getActiveCustomerPhone();
  if (normPhone && activePhone && normalizePhoneKey(activePhone) === normPhone) {
    setActiveCustomerPhone("");
  }

  // 3. Record phone in deleted customers set so guest orders don't recreate the customer row
  if (normPhone) {
    const delSet = getDeletedCustomerPhones();
    delSet.add(normPhone);
    saveDeletedCustomerPhones(delSet);
  }

  // 4. Optionally delete all orders belonging to this customer
  if (params.deleteOrders) {
    try {
      const allOrders = getOrders();
      const remainingOrders = allOrders.filter(o => {
        if (params.id && o.userId === params.id) return false;
        if (normPhone && o.phone && normalizePhoneKey(o.phone) === normPhone) return false;
        return true;
      });
      persistKey(STORAGE_KEY, remainingOrders, "nextgen_orders_updated");
    } catch (err) {
      console.error("Failed to delete customer orders", err);
    }
  } else {
    window.dispatchEvent(new Event("nextgen_orders_updated"));
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

  // Compute Last Active timestamp across all orders and account creation
  let latestActiveMs = matchedUser?.createdAt ? new Date(matchedUser.createdAt).getTime() : 0;
  orders.forEach(o => {
    const t = new Date(o.statusUpdatedAt || o.time).getTime();
    if (!isNaN(t) && t > latestActiveMs) {
      latestActiveMs = t;
    }
  });
  const lastActiveAt = latestActiveMs > 0 ? new Date(latestActiveMs).toISOString() : undefined;

  const refStats = getReferralStats(effectivePhone);

  return {
    id: matchedUser?.id,
    username: matchedUser?.username,
    email: matchedUser?.email,
    password: matchedUser?.password,
    googleConnected: matchedUser?.googleConnected,
    emailVerified: matchedUser?.emailVerified,
    createdAt: matchedUser?.createdAt,
    lastActiveAt,
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
  const deletedPhones = getDeletedCustomerPhones();
  const seenPhones = new Set<string>();
  const accounts: CustomerAccount[] = [];

  // 1. Add all registered user accounts first
  regUsers.forEach(u => {
    if (u.phone) seenPhones.add(normalizePhoneKey(u.phone));
    accounts.push(getCustomerAccount(u.id));
  });

  // 2. Add any guest order phones that aren't in registered accounts and haven't been deleted by Admin
  const guestPhoneMap = new Map<string, string>();
  orders.forEach(o => {
    if (o.phone) {
      const k = normalizePhoneKey(o.phone);
      if (k && !seenPhones.has(k) && !deletedPhones.has(k)) {
        guestPhoneMap.set(k, o.phone);
      }
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
    customerNote: "আমার হোয়াটসঅ্যাপ নেই, ফেসবুকে যোগাযোগ করবেন প্লিজ।"
  }
];

export function getOrders(): Order[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
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
    if (order.phone) {
      const delSet = getDeletedCustomerPhones();
      const normKey = normalizePhoneKey(order.phone);
      if (normKey && delSet.has(normKey)) {
        delSet.delete(normKey);
        saveDeletedCustomerPhones(delSet);
      }
    }
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
    persistKey(STORAGE_KEY, updated, "nextgen_orders_updated", enrichedOrder);
    
    // Automatically set active customer phone
    if (enrichedOrder.phone) {
      setActiveCustomerPhone(enrichedOrder.phone);
    }

    // Automatically record in-app customer notification
    saveAppNotification({
      id: `notif_${enrichedOrder.orderNo}_created`,
      type: "order_created",
      title: `🎉 নতুন অর্ডার #${enrichedOrder.orderNo} গৃহীত!`,
      message: `আপনার ${enrichedOrder.packageName} (৳${toBn(enrichedOrder.price)}) অর্ডারটি গ্রহণ করা হয়েছে। ৫-১০ মিনিটে প্রসেসিং শুরু হবে।`,
      orderNo: enrichedOrder.orderNo,
      orderStatus: "pending",
      targetPhone: enrichedOrder.phone,
      badge: "অর্ডার",
      badgeColor: "sky",
      isRead: false,
      createdAt: nowIso
    });

    // Automatically count quota claims for limited-time offers
    if (enrichedOrder.items && enrichedOrder.items.length > 0) {
      try {
        const prods = getCatalogProducts();
        let changed = false;
        enrichedOrder.items.forEach(it => {
          const pIdx = prods.findIndex(p => p.id === it.id);
          if (pIdx !== -1 && prods[pIdx].isOffer) {
            prods[pIdx].soldCount = (prods[pIdx].soldCount || 0) + (it.quantity || 1);
            changed = true;
          }
        });
        if (changed) {
          saveCatalogProducts(prods);
        }
      } catch (err) {
        console.error("Failed to update offer quota count", err);
      }
    }
    
    // Trigger desktop notification & sound
    triggerDesktopNotification(
      `🔔 নতুন অর্ডার: ${enrichedOrder.orderNo}`,
      `${enrichedOrder.name} - ${enrichedOrder.packageName} (৳ ${enrichedOrder.price.toLocaleString("bn-BD")})`
    );
  } catch (err) {
    console.error("Failed to save order to storage", err);
  }
}

export function notifyOrderStatusInApp(order: Order, newStatus: OrderStatus, note?: string) {
  let title = "";
  let message = "";
  let badge = "";
  let badgeColor: "emerald" | "amber" | "rose" | "sky" | "purple" = "sky";

  if (newStatus === "processing") {
    title = `⚡ অর্ডার #${order.orderNo} প্রসেসিং চলছে!`;
    message = `আপনার অ্যাকাউন্টে কয়েন/প্যাক টপ-আপের কাজ শুরু হয়েছে। শীঘ্রই কমপ্লিট হবে।`;
    badge = "প্রসেসিং";
    badgeColor = "amber";
  } else if (newStatus === "completed") {
    title = `✅ অর্ডার #${order.orderNo} কমপ্লিট হয়েছে!`;
    message = `আপনার অ্যাকাউন্টে কয়েন সফলভাবে ডেলিভারি দেওয়া হয়েছে। গেমে লগইন করে ব্যালেন্স চেক করুন!`;
    badge = "কমপ্লিট";
    badgeColor = "emerald";
  } else if (newStatus === "cancelled") {
    title = `❌ অর্ডার #${order.orderNo} বাতিল করা হয়েছে`;
    message = note || "পেমেন্ট TrxID অথবা Konami পাসওয়ার্ডে সমস্যা পাওয়া গেছে। অনুগ্রহ করে সহায়তায় যোগাযোগ করুন।";
    badge = "বাতিল";
    badgeColor = "rose";
  }

  if (title) {
    saveAppNotification({
      id: `notif_${order.orderNo}_${newStatus}_${Date.now()}`,
      type: `order_${newStatus}` as any,
      title,
      message,
      orderNo: order.orderNo,
      orderStatus: newStatus,
      targetPhone: order.phone,
      badge,
      badgeColor,
      isRead: false,
      createdAt: new Date().toISOString()
    });
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

  const oldStatus = orders[idx].status;

  orders[idx] = {
    ...orders[idx],
    status,
    statusUpdatedAt: nowIso,
    statusHistory: [...prevHistory, nextEntry],
    ...(adminNotes !== undefined ? { adminNotes } : {})
  };

  persistKey(STORAGE_KEY, orders, "nextgen_orders_updated");

  if (oldStatus !== status) {
    notifyOrderStatusInApp(orders[idx], status, adminNotes);
  }

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

  persistKey(STORAGE_KEY, orders, "nextgen_orders_updated");

  if (statusChanged && updates.status) {
    notifyOrderStatusInApp(orders[idx], updates.status, updates.adminNotes);
  }

  return orders[idx];
}

/**
 * Allows Admin to edit the ordered products/items of an existing order
 * (e.g., removing unwanted items, changing quantities/prices, or replacing products).
 * Sends an IN-APP WEBSITE NOTIFICATION ONLY (no email).
 */
export function updateOrderItems(
  orderNo: string,
  updatedItems: CartItem[],
  adminNote?: string
): Order | undefined {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.orderNo === orderNo);
  if (idx === -1 || updatedItems.length === 0) return undefined;

  const nowIso = new Date().toISOString();
  const newPrice = updatedItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * (Number(item.quantity) || 1),
    0
  );
  const newCoins = updatedItems.reduce(
    (sum, item) => sum + (Number(item.coins) || 0) * (Number(item.quantity) || 1),
    0
  );
  const newPackageName = updatedItems
    .map(i => ((i.quantity || 1) > 1 ? `${i.name} × ${i.quantity}` : i.name))
    .join(" + ");

  const prevHistory: OrderStatusHistoryEntry[] = orders[idx].statusHistory || [
    {
      status: orders[idx].status,
      updatedAt: orders[idx].time,
      updatedBy: "customer",
    },
  ];

  const noteText =
    adminNote?.trim() ||
    `অর্ডারের প্রোডাক্ট এডিট করা হয়েছে: ${newPackageName} (৳${toBn(newPrice)})`;

  orders[idx] = {
    ...orders[idx],
    items: updatedItems,
    packageName: newPackageName,
    price: newPrice,
    coins: newCoins,
    statusUpdatedAt: nowIso,
    adminNotes: adminNote?.trim() || orders[idx].adminNotes,
    statusHistory: [
      ...prevHistory,
      {
        status: orders[idx].status,
        updatedAt: nowIso,
        updatedBy: "admin",
        note: noteText,
      },
    ],
  };

  persistKey(STORAGE_KEY, orders, "nextgen_orders_updated");

  // Send website IN-APP notification ONLY (no email)
  saveAppNotification({
    id: `notif_${orderNo}_edited_${Date.now()}`,
    type: "order_updated",
    title: `✏️ অর্ডার #${orderNo} এর প্রোডাক্ট আপডেট করা হয়েছে`,
    message: `আপনার অনুরোধ অনুযায়ী অর্ডার #${orderNo} এর প্রোডাক্ট পরিবর্তন করে "${newPackageName}" (মোট মূল্য: ৳${toBn(
      newPrice
    )}${newCoins > 0 ? `, মোট কয়েন: ${toBn(newCoins)}` : ""}) নির্ধারণ করা হয়েছে।${
      adminNote?.trim() ? ` এডমিন নোট: ${adminNote.trim()}` : ""
    }`,
    orderNo: orders[idx].orderNo,
    orderStatus: orders[idx].status,
    targetPhone: orders[idx].phone,
    badge: "অর্ডার এডিট",
    badgeColor: "sky",
    isRead: false,
    createdAt: nowIso,
  });

  return orders[idx];
}

export function deleteOrder(orderNo: string): boolean {
  const orders = getOrders();
  const filtered = orders.filter(o => o.orderNo !== orderNo);
  persistKey(STORAGE_KEY, filtered, "nextgen_orders_updated");
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
    persistKey(NOTIFICATION_LOGS_KEY, updatedLogs, "nextgen_notification_logs_updated");

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
      persistKey(STORAGE_KEY, orders, "nextgen_orders_updated");
    }
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

// ===== 10. IN-APP HEADER NOTIFICATIONS & ADMIN ANNOUNCEMENTS =====
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif_welcome_01",
    type: "announcement",
    title: "🎉 NextGen Efootball-এ স্বাগতম!",
    message: "eFootball 2026 এর অফিসিয়াল কয়েন টপ-আপ ও স্পেশাল প্লেয়ার প্যাক এখন ৫-১০ মিনিটে ফাস্ট ডেলিভারিতে উপলব্ধ!",
    badge: "ঘোষণা",
    badgeColor: "sky",
    isRead: false,
    createdAt: new Date().toISOString()
  },
  {
    id: "notif_offer_01",
    type: "limited_offer",
    title: "🔥 স্পেশাল লিমিটেড টাইম অফার!",
    message: "যেকোনো কয়েন কম্বো বা প্লেয়ার প্যাক অর্ডারে স্পেশাল ক্যাশব্যাক ও বোনাস কয়েন সুবিধা উপভোগ করুন!",
    badge: "অফার",
    badgeColor: "amber",
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

export function getAppNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(APP_NOTIFICATIONS_KEY);
    if (!raw) {
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveAppNotification(notif: AppNotification): void {
  try {
    const list = getAppNotifications();
    const updated = [notif, ...list.filter(n => n.id !== notif.id)].slice(0, 60);
    persistKey(APP_NOTIFICATIONS_KEY, updated, "nextgen_app_notifications_changed", notif);
  } catch (err) {
    console.error("Failed to save app notification", err);
  }
}

export function markNotificationAsRead(id: string): void {
  try {
    const list = getAppNotifications();
    const updated = list.map(n => n.id === id ? { ...n, isRead: true } : n);
    persistKey(APP_NOTIFICATIONS_KEY, updated, "nextgen_app_notifications_changed");
  } catch (err) {
    console.error("Failed to mark notification as read", err);
  }
}

export function markAllNotificationsAsRead(): void {
  try {
    const list = getAppNotifications();
    const updated = list.map(n => ({ ...n, isRead: true }));
    persistKey(APP_NOTIFICATIONS_KEY, updated, "nextgen_app_notifications_changed");
  } catch (err) {
    console.error("Failed to mark all notifications as read", err);
  }
}

export function deleteAppNotification(id: string): void {
  try {
    const list = getAppNotifications();
    const updated = list.filter(n => n.id !== id);
    persistKey(APP_NOTIFICATIONS_KEY, updated, "nextgen_app_notifications_changed");
  } catch (err) {
    console.error("Failed to delete notification", err);
  }
}

export function broadcastAdminAnnouncement(params: {
  title: string;
  message: string;
  type?: 'announcement' | 'limited_offer';
}): AppNotification {
  const notif: AppNotification = {
    id: `notif_admin_${Date.now()}`,
    type: params.type || "announcement",
    title: params.title.trim(),
    message: params.message.trim(),
    badge: params.type === "limited_offer" ? "অফার" : "ঘোষণা",
    badgeColor: params.type === "limited_offer" ? "amber" : "purple",
    isRead: false,
    createdAt: new Date().toISOString()
  };
  saveAppNotification(notif);
  return notif;
}

// ===== 11. DYNAMIC CATALOG SECTIONS & PRODUCTS MANAGEMENT =====

export const DEFAULT_CATALOG_SECTIONS: CatalogSection[] = [
  {
    id: "player_pack",
    name: "লেজেন্ডারি প্লেয়ার প্যাক (ছবিসহ)",
    subtitle: "লুইস সুয়ারেজ, ইকার ক্যাসিয়াস ও স্পেশাল বান্ডেল",
    badge: "ইন-গেম কয়েন সহ",
    icon: "⚽",
    order: 1,
    isActive: true,
  },
  {
    id: "combo",
    name: "কয়েন এর অফার ও কম্বো প্যাক",
    subtitle: "একত্রে বেশি কয়েন নিয়ে বাড়তি সেভিংস অফার",
    badge: "বেশি সেভিংস",
    icon: "🎁",
    order: 2,
    isActive: true,
  },
  {
    id: "regular",
    name: "রেগুলার কয়েন প্যাকেজসমূহ",
    subtitle: "সরাসরি ইন-গেম টপ-আপ (সবচেয়ে দ্রুত ডেলিভারি)",
    badge: "অফিসিয়াল ইন-গেম রেট",
    icon: "💎",
    order: 3,
    isActive: true,
  },
];

export const DEFAULT_CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: "pp1",
    name: "Starter Set: Luis Suárez + 50 Coins",
    description: "CF 99 Luis Suárez কার্ড + ইন-গেম ৫০ কয়েন ইনস্ট্যান্ট ডেলিভারি",
    subtitle: "CF 99 Luis Suárez কার্ড + ইন-গেম ৫০ কয়েন",
    price: 130,
    coins: 50,
    image: "/assets/aistudio/Screenshot_20260929-225847_72392c40.png",
    emoji: "⚽",
    category: "player_pack",
    tag: "জনপ্রিয় প্যাক",
    isActive: true,
    order: 1,
  },
  {
    id: "pp2",
    name: "Starter Set: Iker Casillas + 100 Coins",
    description: "GK 100 Casillas + CMF 95 + AMF 96 + ১০০ কয়েন ইনস্ট্যান্ট ডেলিভারি",
    subtitle: "GK 100 Casillas + CMF 95 + AMF 96 + ১০০ কয়েন",
    price: 320,
    coins: 100,
    image: "/assets/aistudio/casillas_card.png",
    emoji: "🧤",
    category: "player_pack",
    tag: "লেজেন্ডারি প্যাক",
    isActive: true,
    order: 2,
  },
  {
    id: "pp3",
    name: "Combo: Suárez Pack + Casillas Pack",
    description: "সুয়ারেজ ও ক্যাসিয়াস দুটো প্যাক একসাথে (১৫০ কয়েন + প্লেয়ার বান্ডেল)",
    subtitle: "সুয়ারেজ ও ক্যাসিয়াস দুটো প্যাক একসাথে (১৫০ কয়েন + প্লেয়ার বান্ডেল)",
    price: 420,
    coins: 150,
    image: "/assets/aistudio/combo_suarez_casillas.png",
    emoji: "🔥",
    isCombo: true,
    category: "player_pack",
    tag: "সেরা কম্বো অফার",
    isActive: true,
    order: 3,
  },
  {
    id: "c1",
    name: "১৫০০ কয়েন স্পেশাল কম্বো (1000 + 500 Coins)",
    description: "১৫০০ কয়েন (1000+500) স্পেশাল কম্বো অফার",
    subtitle: "1000 + 500 Coins স্পেশাল কম্বো অফার",
    parts: "1000 + 500 Coins",
    price: 1620,
    coins: 1500,
    category: "combo",
    tag: "স্পেশাল কম্বো",
    isActive: true,
    order: 4,
  },
  {
    id: "c2",
    name: "২৫০০ কয়েন সর্বোচ্চ সেভিংস (2000 + 500 Coins)",
    description: "২৫০০ কয়েন (2000+500) সর্বোচ্চ সেভিংস কম্বো প্যাক",
    subtitle: "2000 + 500 Coins সর্বোচ্চ সেভিংস কম্বো প্যাক",
    parts: "2000 + 500 Coins",
    price: 2600,
    coins: 2500,
    category: "combo",
    tag: "বেশি সেভিংস",
    isActive: true,
    order: 5,
  },
  { id: "p1", name: "১০০ কয়েন (100 Coins)", description: "১০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 140, coins: 100, category: "regular", isActive: true, order: 6 },
  { id: "p2", name: "৩০০ কয়েন (300 Coins)", description: "৩০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 370, coins: 300, category: "regular", isActive: true, order: 7 },
  { id: "p3", name: "৫০০ কয়েন (500 Coins)", description: "৫০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 600, coins: 500, tag: "জনপ্রিয়", category: "regular", isActive: true, order: 8 },
  { id: "p4", name: "১,০০০ কয়েন (1000 Coins)", description: "১,০০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 1100, coins: 1000, tag: "জনপ্রিয়", category: "regular", isActive: true, order: 9 },
  { id: "p5", name: "২,০০০ কয়েন (2000 Coins)", description: "২,০০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 2050, coins: 2000, tag: "জনপ্রিয়", category: "regular", isActive: true, order: 10 },
  { id: "p6", name: "৩,০০০ কয়েন (3000 Coins)", description: "৩,০০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 2980, coins: 3000, tag: "সেরা দাম", category: "regular", isActive: true, order: 11 },
  { id: "p7", name: "৫,০০০ কয়েন (5000 Coins)", description: "৫,০০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 4700, coins: 5000, tag: "সেরা দাম", category: "regular", isActive: true, order: 12 },
  { id: "p8", name: "১০,০০০ কয়েন (10000 Coins)", description: "১০,০০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 8900, coins: 10000, tag: "সেরা দাম", category: "regular", isActive: true, order: 13 },
  { id: "p9", name: "১৫,০০০ কয়েন (15000 Coins)", description: "১৫,০০০ কয়েন সরাসরি ইন-গেম টপ-আপ", price: 13100, coins: 15000, tag: "সেরা দাম", category: "regular", isActive: true, order: 14 },
];

export const DEFAULT_PAYMENT_OPTIONS: PaymentOptionConfig[] = [
  {
    id: "bkash",
    name: "bKash (বিকাশ)",
    shortName: "bKash",
    bnName: "বিকাশ",
    number: "01629802989",
    type: "Personal Account",
    dialCode: "*247#",
    appAction: "Send Money",
    instruction: "bKash অ্যাপ বা *247# ডায়াল করে Send Money করুন",
    category: "mobile_banking",
    color: "#e2136e",
    cardBg: "#d81b60",
    isEnabled: true,
  },
  {
    id: "nagad",
    name: "Nagad (নগদ)",
    shortName: "Nagad",
    bnName: "নগদ",
    number: "01629802989",
    type: "Personal Account",
    dialCode: "*167#",
    appAction: "Send Money",
    instruction: "Nagad অ্যাপ বা *167# ডায়াল করে Send Money করুন",
    category: "mobile_banking",
    color: "#f6921e",
    cardBg: "#e65100",
    isEnabled: true,
  },
  {
    id: "rocket",
    name: "Rocket (রকেট)",
    shortName: "Rocket",
    bnName: "রকেট",
    number: "01777414308",
    type: "Personal Account",
    dialCode: "*322#",
    appAction: "Send Money",
    instruction: "Rocket অ্যাপ বা *322# ডায়াল করে Send Money করুন",
    category: "mobile_banking",
    color: "#8c3494",
    cardBg: "#7b1fa2",
    isEnabled: true,
  },
  {
    id: "upay",
    name: "Upay (উপায়)",
    shortName: "Upay",
    bnName: "উপায়",
    number: "01629802989",
    type: "Personal Account",
    dialCode: "*268#",
    appAction: "Send Money",
    instruction: "Upay অ্যাপ বা *268# ডায়াল করে Send Money করুন",
    category: "mobile_banking",
    color: "#0072bc",
    cardBg: "#005baa",
    isEnabled: true,
  },
  {
    id: "cellfin",
    name: "Cellfin (সেলফিন)",
    shortName: "Cellfin",
    bnName: "সেলফিন",
    number: "01777414308",
    type: "Personal Account",
    appAction: "Fund Transfer / Send Money",
    instruction: "Cellfin অ্যাপ থেকে এই নম্বরে Send Money / Transfer করুন",
    category: "mobile_banking",
    color: "#008542",
    cardBg: "#006a4e",
    isEnabled: true,
  },
  {
    id: "bank",
    name: "Bank Account (NPSB)",
    shortName: "Bank Transfer",
    bnName: "ব্যাংক একাউন্ট",
    number: "0020-0466009896",
    type: "NPSB Instant Transfer",
    appAction: "NPSB (Instant Transfer)",
    instruction: "ব্যাংক অ্যাপ থেকে অবশ্যই NPSB সিলেক্ট করে টাকা পাঠান",
    category: "bank_transfer",
    color: "#2563eb",
    cardBg: "#1e3a8a",
    isEnabled: true,
  },
];

// 11.1 Catalog Sections
export function getCatalogSections(): CatalogSection[] {
  try {
    const raw = localStorage.getItem(CATALOG_SECTIONS_KEY);
    if (!raw) {
      return DEFAULT_CATALOG_SECTIONS;
    }
    const parsed: CatalogSection[] = JSON.parse(raw);
    return parsed.sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_CATALOG_SECTIONS;
  }
}

export function saveCatalogSections(sections: CatalogSection[]): void {
  persistKey(CATALOG_SECTIONS_KEY, sections, "nextgen_catalog_sections_updated", sections);
}

export function addCatalogSection(sectionData: Omit<CatalogSection, "id">): CatalogSection {
  const sections = getCatalogSections();
  const id = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newSection: CatalogSection = {
    ...sectionData,
    id,
    order: sectionData.order ?? sections.length + 1,
    isActive: sectionData.isActive ?? true,
  };
  const updated = [...sections, newSection];
  saveCatalogSections(updated);
  return newSection;
}

export function updateCatalogSection(id: string, updates: Partial<CatalogSection>): CatalogSection | null {
  const sections = getCatalogSections();
  const idx = sections.findIndex(s => s.id === id);
  if (idx === -1) return null;
  sections[idx] = { ...sections[idx], ...updates };
  saveCatalogSections(sections);
  return sections[idx];
}

export function deleteCatalogSection(id: string): boolean {
  const sections = getCatalogSections();
  const filtered = sections.filter(s => s.id !== id);
  saveCatalogSections(filtered);
  return true;
}

// 11.2 Catalog Products
export function getCatalogProducts(): CatalogProduct[] {
  try {
    const raw = localStorage.getItem(CATALOG_PRODUCTS_KEY);
    if (!raw) {
      return DEFAULT_CATALOG_PRODUCTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CATALOG_PRODUCTS;
  }
}

export function saveCatalogProducts(products: CatalogProduct[]): void {
  persistKey(CATALOG_PRODUCTS_KEY, products, "nextgen_catalog_products_updated", products);
}

export function addCatalogProduct(data: Omit<CatalogProduct, "id">): CatalogProduct {
  const products = getCatalogProducts();
  const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newProduct: CatalogProduct = {
    ...data,
    id,
    isActive: data.isActive ?? true,
    order: data.order ?? products.length + 1,
  };
  const updated = [newProduct, ...products];
  saveCatalogProducts(updated);
  return newProduct;
}

export function updateCatalogProduct(id: string, updates: Partial<CatalogProduct>): CatalogProduct | null {
  const products = getCatalogProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...updates };
  saveCatalogProducts(products);
  return products[idx];
}

export function deleteCatalogProduct(id: string): boolean {
  const products = getCatalogProducts();
  const filtered = products.filter(p => p.id !== id);
  saveCatalogProducts(filtered);
  return true;
}

export function resetDefaultCatalog(): void {
  saveCatalogSections(DEFAULT_CATALOG_SECTIONS);
  saveCatalogProducts(DEFAULT_CATALOG_PRODUCTS);
}

// 11.3 Payment Options Configuration (Enable/Disable Payment Methods)
export function getPaymentOptions(): PaymentOptionConfig[] {
  try {
    const raw = localStorage.getItem(PAYMENT_OPTIONS_KEY);
    const shop = getShopSettings();
    let currentOptions: PaymentOptionConfig[];

    if (!raw) {
      currentOptions = DEFAULT_PAYMENT_OPTIONS.map(p => {
        const label = p.label || `${p.name} (${p.bnName})`;
        if (p.id === "bkash" && shop.bkashNumber) return { ...p, label, number: shop.bkashNumber };
        if (p.id === "nagad" && shop.nagadNumber) return { ...p, label, number: shop.nagadNumber };
        return { ...p, label };
      });
      return currentOptions;
    }

    currentOptions = JSON.parse(raw);
    // Ensure all default payment methods exist
    const map = new Map<string, PaymentOptionConfig>(currentOptions.map(p => [p.id, p]));
    DEFAULT_PAYMENT_OPTIONS.forEach(def => {
      if (!map.has(def.id)) {
        currentOptions.push(def);
      }
    });

    // Synchronize shop settings numbers if updated
    return currentOptions.map(p => {
      const label = p.label || `${p.name} (${p.bnName})`;
      if (p.id === "bkash" && shop.bkashNumber && !p.number) return { ...p, label, number: shop.bkashNumber };
      if (p.id === "nagad" && shop.nagadNumber && !p.number) return { ...p, label, number: shop.nagadNumber };
      return { ...p, label };
    });
  } catch {
    return DEFAULT_PAYMENT_OPTIONS.map(p => ({ ...p, label: `${p.name} (${p.bnName})` }));
  }
}

export function savePaymentOptions(options: PaymentOptionConfig[]): void {
  persistKey(PAYMENT_OPTIONS_KEY, options, "nextgen_payment_options_updated", options);
}

export function updatePaymentOption(id: string, updates: Partial<PaymentOptionConfig>): PaymentOptionConfig | null {
  const options = getPaymentOptions();
  const idx = options.findIndex(p => p.id === id);
  if (idx === -1) return null;
  options[idx] = { ...options[idx], ...updates };
  savePaymentOptions(options);

  // If phone number updated, sync back to shop settings for bkash & nagad
  if (updates.number) {
    if (id === "bkash") updateShopSettings({ bkashNumber: updates.number });
    if (id === "nagad") updateShopSettings({ nagadNumber: updates.number });
  }

  return options[idx];
}

export function togglePaymentMethod(id: string, isEnabled: boolean, disabledReason?: string): PaymentOptionConfig | null {
  return updatePaymentOption(id, { 
    isEnabled, 
    disabledReason: isEnabled ? "" : (disabledReason || "সার্ভার সাময়িক বন্ধ থাকায় এই পেমেন্ট অপশনটি বন্ধ রাখা হয়েছে।") 
  });
}

// ===== 12. AUTOMATIC TWO-WAY SERVER & FIREBASE FIRESTORE SYNC =====
let storageSyncInitialized = false;

export async function initPersistentStorageSync(): Promise<void> {
  if (typeof window === "undefined" || storageSyncInitialized) return;
  storageSyncInitialized = true;

  const syncedKeys = Object.keys(KEY_EVENT_MAP);

  const applyIncomingValue = (key: string, val: any) => {
    if (val === undefined || val === null) return;
    try {
      const serialized = typeof val === "string" ? val : JSON.stringify(val);
      const currentRaw = localStorage.getItem(key);
      if (currentRaw !== serialized) {
        localStorage.setItem(key, serialized);
        const evtName = KEY_EVENT_MAP[key];
        if (evtName) {
          window.dispatchEvent(new CustomEvent(evtName, { detail: val }));
        }
      }
    } catch (e) {
      console.error(`Failed to apply incoming state for ${key}`, e);
    }
  };

  // 1. Hydrate from Express Server disk store (/api/state)
  let serverState: Record<string, any> = {};
  try {
    const res = await fetch("/api/state");
    if (res.ok) {
      const json = await res.json();
      if (json && json.state && typeof json.state === "object") {
        serverState = json.state;
        for (const key of syncedKeys) {
          if (serverState[key] !== undefined) {
            applyIncomingValue(key, serverState[key]);
          }
        }
      }
    }
  } catch {
    // Offline or server starting up
  }

  // 2. Hydrate from & synchronize with Firebase Firestore + setup real-time listeners
  for (const key of syncedKeys) {
    loadCloudStateKey(key)
      .then((cloudVal) => {
        if (cloudVal !== null && cloudVal !== undefined) {
          applyIncomingValue(key, cloudVal);
          // Ensure Express server also has this cloud state backed up
          if (serverState[key] === undefined) {
            fetch("/api/state", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key, value: cloudVal }),
            }).catch(() => {});
          }
        } else {
          // Cloud has no record yet; if local or server has data, push it to Cloud & Server
          const rawLocal = localStorage.getItem(key);
          if (rawLocal !== null) {
            try {
              const parsed =
                rawLocal === "true" || rawLocal === "false"
                  ? rawLocal
                  : JSON.parse(rawLocal);
              saveCloudStateKey(key, parsed).catch(() => {});
              if (serverState[key] === undefined) {
                fetch("/api/state", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key, value: parsed }),
                }).catch(() => {});
              }
            } catch {
              // ignore
            }
          }
        }
      })
      .catch(() => {});

    // Real-time Firestore listener so changes from any tab/device sync immediately
    subscribeCloudStateKey(key, (cloudVal) => {
      if (cloudVal !== null && cloudVal !== undefined) {
        applyIncomingValue(key, cloudVal);
      }
    });
  }
}

// Start sync immediately when module is imported in browser
if (typeof window !== "undefined") {
  initPersistentStorageSync();
}


