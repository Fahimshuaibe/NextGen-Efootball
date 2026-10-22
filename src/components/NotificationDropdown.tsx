import React, { useState, useEffect, useRef } from "react";
import { AppNotification, Order } from "../types";
import {
  getAppNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAppNotification,
  getOrderById,
  getActiveUserAccount,
  getActiveCustomerPhone,
  normalizePhoneKey,
  WELCOME_NOTIFICATION,
} from "../utils/storage";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Megaphone,
  Flame,
  CheckCheck,
  Trash2,
  X,
  FileText,
  Search,
  Tag,
} from "lucide-react";
import { toBn } from "../utils/order";

interface Props {
  activePhone?: string;
  onViewReceipt?: (order: Order) => void;
  onTrackOrder?: (orderNo: string) => void;
}

export function NotificationDropdown({
  activePhone,
  onViewReceipt,
  onTrackOrder,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "orders" | "announcements">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    const all = getAppNotifications();
    const activeUser = getActiveUserAccount();
    const effectivePhone = activeUser?.phone || getActiveCustomerPhone() || activePhone || "";
    const userClean = normalizePhoneKey(effectivePhone);

    // Brand-new visitor (not logged in and no active customer phone on this device):
    // Show ONLY the Welcome notification
    if (!userClean && !activeUser) {
      const welcomeOnly = all.filter((n) => n.id === WELCOME_NOTIFICATION.id);
      setNotifications(welcomeOnly.length > 0 ? welcomeOnly : [WELCOME_NOTIFICATION]);
      return;
    }

    // Returning / logged-in user: show ONLY their own order notifications + Welcome/global announcements
    const filtered = all.filter((n) => {
      const isOrderNotif =
        Boolean(n.targetPhone) ||
        Boolean(n.orderNo) ||
        n.type === "order_created" ||
        n.type === "order_processing" ||
        n.type === "order_completed" ||
        n.type === "order_cancelled" ||
        n.type === "order_updated";

      if (!isOrderNotif) {
        return true; // Global welcome or admin announcement
      }

      const linkedOrder = n.orderNo ? getOrderById(n.orderNo) : undefined;

      // Match by logged-in userId if available
      if (activeUser?.id && linkedOrder?.userId && linkedOrder.userId === activeUser.id) {
        return true;
      }

      // Match strictly by normalized phone number
      const notifPhoneClean = normalizePhoneKey(n.targetPhone || linkedOrder?.phone || "");
      if (!notifPhoneClean || !userClean) {
        return false;
      }
      return notifPhoneClean === userClean;
    });

    setNotifications(filtered);
  };

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener("nextgen_app_notifications_changed", handleUpdate);
    window.addEventListener("nextgen_orders_updated", handleUpdate);
    window.addEventListener("nextgen_user_account_updated", handleUpdate);
    window.addEventListener("nextgen_customer_phone_changed", handleUpdate);
    return () => {
      window.removeEventListener("nextgen_app_notifications_changed", handleUpdate);
      window.removeEventListener("nextgen_orders_updated", handleUpdate);
      window.removeEventListener("nextgen_user_account_updated", handleUpdate);
      window.removeEventListener("nextgen_customer_phone_changed", handleUpdate);
    };
  }, [activePhone]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const displayedNotifications = notifications.filter((n) => {
    if (filter === "orders") {
      return (
        n.type === "order_created" ||
        n.type === "order_processing" ||
        n.type === "order_completed" ||
        n.type === "order_cancelled" ||
        n.type === "order_updated"
      );
    }
    if (filter === "announcements") {
      return n.type === "announcement" || n.type === "limited_offer";
    }
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order_completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "order_processing":
        return <Clock className="w-4 h-4 text-amber-400 animate-spin" />;
      case "order_cancelled":
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case "order_updated":
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      case "order_created":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case "limited_offer":
        return <Flame className="w-4 h-4 text-amber-400" />;
      case "announcement":
      default:
        return <Megaphone className="w-4 h-4 text-purple-400" />;
    }
  };

  const getBadgeStyle = (badgeColor?: string) => {
    switch (badgeColor) {
      case "emerald":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "amber":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "rose":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "purple":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "sky":
      default:
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = Date.now();
      const past = new Date(dateStr).getTime();
      const diffSec = Math.floor((now - past) / 1000);
      if (diffSec < 60) return "এইমাত্র";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${toBn(diffMin)} মিনিট আগে`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${toBn(diffHour)} ঘণ্টা আগে`;
      const diffDay = Math.floor(diffHour / 24);
      return `${toBn(diffDay)} দিন আগে`;
    } catch {
      return "কিছুক্ষণ আগে";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        title="নোটিফিকেশন ও ঘোষণা"
        aria-label="নোটিফিকেশন দেখুন"
        className="relative inline-flex items-center justify-center p-2.5 sm:px-3 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400 text-slate-200 transition cursor-pointer"
      >
        <Bell className="w-4 h-4 text-cyan-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white border-2 border-slate-950 shadow-md">
            {unreadCount > 9 ? "9+" : toBn(unreadCount)}
          </span>
        )}
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[400px] max-w-[95vw] rounded-2xl bg-gradient-to-b from-slate-900 via-[#0a1224] to-slate-950 border border-cyan-500/40 shadow-2xl z-50 overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
                  <span>নোটিফিকেশনসমূহ</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                      {toBn(unreadCount)} নতুন
                    </span>
                  )}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsAsRead(notifications.map((n) => n.id))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold cursor-pointer transition"
                  title="সব নোটিফিকেশন পড়া হয়েছে হিসেবে চিহ্নিত করুন"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>পড়া হয়েছে</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-2 bg-slate-950/50 border-b border-slate-800/80 text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-1 py-1 rounded-lg font-bold text-center transition cursor-pointer ${
                filter === "all"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              সকল ({toBn(notifications.length)})
            </button>
            <button
              type="button"
              onClick={() => setFilter("orders")}
              className={`flex-1 py-1 rounded-lg font-bold text-center transition cursor-pointer ${
                filter === "orders"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              অর্ডার
            </button>
            <button
              type="button"
              onClick={() => setFilter("announcements")}
              className={`flex-1 py-1 rounded-lg font-bold text-center transition cursor-pointer ${
                filter === "announcements"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ঘোষণা ও অফার
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto divide-y divide-slate-800/60 flex-1 p-1">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">আপাতত কোনো নোটিফিকেশন নেই।</p>
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead) markNotificationAsRead(notif.id);
                  }}
                  className={`p-3 rounded-xl transition cursor-pointer flex items-start gap-2.5 relative group ${
                    notif.isRead
                      ? "hover:bg-slate-800/40 text-slate-300"
                      : "bg-cyan-950/25 hover:bg-cyan-950/40 text-white"
                  }`}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5 shadow">
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {notif.badge && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${getBadgeStyle(
                              notif.badgeColor
                            )}`}
                          >
                            {notif.badge}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAppNotification(notif.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h5
                      className={`text-xs font-bold leading-snug ${
                        notif.isRead ? "text-slate-200" : "text-cyan-200"
                      }`}
                    >
                      {notif.title}
                    </h5>

                    <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                      {notif.message}
                    </p>

                    {/* Order Action Buttons */}
                    {notif.orderNo && (
                      <div className="flex items-center gap-2 pt-1">
                        {onViewReceipt && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const order = getOrderById(notif.orderNo!);
                              if (order) {
                                onViewReceipt(order);
                                setIsOpen(false);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>রশিদ দেখুন</span>
                          </button>
                        )}

                        {onTrackOrder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrackOrder(notif.orderNo!);
                              setIsOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                          >
                            <Search className="w-3 h-3" />
                            <span>ট্র্যাক করুন</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1.5 shadow-sm shadow-cyan-400" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
