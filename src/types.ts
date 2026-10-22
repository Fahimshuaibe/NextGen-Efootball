export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export type OrderNotificationEventType =
  | 'order_created'
  | 'status_pending'
  | 'status_processing'
  | 'status_completed'
  | 'status_cancelled';

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  updatedAt: string;
  updatedBy: 'customer' | 'admin';
  note?: string;
}

export interface OrderNotificationLog {
  id: string;
  idempotencyKey: string;
  orderNo: string;
  userId?: string;
  recipientEmail: string;
  eventType: OrderNotificationEventType;
  orderStatus: OrderStatus;
  subject: string;
  messagePreview: string;
  deliveryStatus: 'sent' | 'skipped_duplicate' | 'failed';
  provider: 'resend' | 'fallback';
  providerMessageId?: string;
  attempts: number;
  errorMessage?: string;
  timestamp: string;
}

export type ContactMethod = 'whatsapp' | 'facebook' | 'telegram';

export type ServiceMethod = 'konami_login' | 'payment_link';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  coins?: number | null;
  quantity: number;
  image?: string;
  category: 'regular' | 'combo' | 'player_pack';
}

export type ProductSortOption =
  | 'default'
  | 'popularity'
  | 'latest'
  | 'price_asc'
  | 'price_desc';

export interface Order {
  orderNo: string;
  time: string;
  statusUpdatedAt?: string;
  statusHistory?: OrderStatusHistoryEntry[];
  ownershipSignature?: string;
  notificationLogs?: OrderNotificationLog[];
  userId?: string;
  customerEmail?: string;
  name: string;
  phone: string;
  serviceMethod?: ServiceMethod;
  contactMethod?: ContactMethod;
  contactHandle?: string; // WhatsApp number, FB profile link, or Telegram handle
  otpWhatsapp: string; // backwards compatibility / direct whatsapp
  konamiIdOrEmail: string;
  konamiPassword: string;
  paymentLinkJapan?: string;
  paymentLinkGmail?: string;
  noIdReasons?: string[];
  platform: string;
  items: CartItem[];
  packageId?: string;
  packageName: string;
  price: number;
  coins?: number | null;
  paymentMethod: string;
  paymentSource?: 'personal' | 'shop' | 'bank';
  shopLastDigits?: string;
  senderBankAccountName?: string;
  targetBankName?: string;
  senderNumber: string;
  trxId: string;
  screenshotUrl?: string;
  status: OrderStatus;
  adminNotes?: string;
  customerNote?: string; // User special demand / description
  isFakeOrInvalidStrike?: boolean;

  // Referral
  referredBy?: string; // Phone of referrer
  referralDiscountApplied?: number; // Discount in BDT applied (e.g. 10)

  // Order progression steps
  paymentConfirmed?: boolean;
  loginStartSent?: boolean;
  userActiveConfirmed?: boolean;
  otpRequested?: boolean;
  otpRequestedAt?: string;
}

export interface RegisteredUserAccount {
  id: string;
  username: string;
  email: string;
  phone: string;
  name: string;
  password: string; // Stored so Admin can view/recover if user forgets password
  googleConnected?: boolean;
  emailVerified?: boolean;
  verificationCode?: string;
  createdAt: string;
}

export interface CoinPackage {
  id: string;
  coins: number;
  price: number;
  tag?: string;
}

export interface ComboPackage {
  id: string;
  coins: number;
  price: number;
  parts: string;
  tag?: string;
  description?: string;
}

export interface PlayerPack {
  id: string;
  title: string;
  emoji: string;
  price: number;
  coins: number;
  image: string;
  isCombo?: boolean;
  subtitle?: string;
  tag?: string;
}

export interface AdminSecurityConfig {
  adminPin: string;
  securityEmail: string;
  securityPassword: string;
  updatedAt?: string;
}

export interface BlockedUser {
  phone: string;
  reason: string;
  blockedAt: string;
  failedStrikes: number;
}

export interface CustomerAccount {
  id?: string;
  username?: string;
  email?: string;
  password?: string;
  googleConnected?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  phone: string;
  name: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  processingOrders: number;
  pendingOrders: number;
  totalSpent: number;
  failedAttempts: number;
  isBlocked: boolean;
  blockReason?: string;

  // Referral System (legacy fields kept for compatibility)
  referralCode: string;
  referredFriendsCount: number;
  completedReferralsCount: number;
  earnedReferralBonus: number;
  usedReferralBonus: number;
  availableReferralBonus: number;
}

export interface ShopSettings {
  siteName: string;
  tagline: string;
  whatsapp: string;
  whatsappDisplay: string;
  adminWhatsapp?: string;
  facebookUrl: string;
  supportHours: string;
  noticeText: string;
  bkashNumber: string;
  nagadNumber: string;
  // Automatic Background Order Notification Settings (works even if customer has no WhatsApp)
  autoWhatsappPhone?: string;
  callmebotApiKey?: string;
  whatsappWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface LiveChatMessage {
  id: string;
  orderNo?: string;
  phone: string;
  customerName: string;
  sender: 'customer' | 'admin';
  text: string;
  time: string;
  timestamp: number;
  read?: boolean;
}
