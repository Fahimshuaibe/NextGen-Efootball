import React, { useState, useEffect } from "react";
import { Order, OrderStatus, CustomerAccount, RegisteredUserAccount } from "../types";
import {
  getActiveCustomerPhone,
  setActiveCustomerPhone,
  getCustomerAccount,
  getOrdersByPhone,
  getShopSettings,
  getActiveUserAccount,
  setActiveUserAccount,
  registerUserAccount,
  loginUserAccount,
  connectGoogleUserAccount,
  updateRegisteredUser,
  changeUserEmailWithPassword,
  getOrdersForUserAccount,
  isUserUsingDefaultPassword,
} from "../utils/storage";
import {
  formatBdPhonePretty,
  formatBdWhatsappForUrl,
  toBn,
  convertBnToEnDigits,
} from "../utils/order";
import { sendCustomerVerificationEmail } from "../utils/autoNotify";
import {
  verifyOrderUserRelationship,
  buildOrderNotificationTemplate,
  getEventTypeForStatus,
  getOrderStatusLabelBn,
} from "../utils/orderNotification";
import {
  X,
  User,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  LogOut,
  ShieldAlert,
  MessageCircle,
  Phone,
  ArrowRight,
  Headphones,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  BadgeCheck,
  LayoutDashboard,
  Settings,
  Check,
} from "lucide-react";

interface Props {
  onClose: () => void;
  onViewReceipt: (order: Order) => void;
  onOrderAgain?: () => void;
  onOpenLiveChat?: (phone?: string, orderNo?: string) => void;
  initialSection?: "dashboard" | "orders" | "details" | "verify";
}

type ProfileSection = "dashboard" | "orders" | "details" | "verify" | "support";

export function CustomerAccountModal({
  onClose,
  onViewReceipt,
  onOrderAgain,
  initialSection = "dashboard",
}: Props) {
  const [currentUser, setCurrentUser] = useState<RegisteredUserAccount | null>(() =>
    getActiveUserAccount()
  );
  const [activeSection, setActiveSection] = useState<ProfileSection>(initialSection);

  // Auth tabs: 'login' | 'register' | 'google'
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  // Login form state
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState(() => getActiveCustomerPhone() || "");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);

  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Account & Orders state
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");

  // Account Details & Password Change state
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editEmailCurrentPassword, setEditEmailCurrentPassword] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showEditPass, setShowEditPass] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  // Email verification & Password-protected Email Change state
  const [verifyEmailInput, setVerifyEmailInput] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyErr, setVerifyErr] = useState("");
  const [showEmailChangeForm, setShowEmailChangeForm] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [showEmailChangePass, setShowEmailChangePass] = useState(false);

  const shopSettings = getShopSettings();

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const refreshProfileData = (user: RegisteredUserAccount | null) => {
    if (user) {
      const freshUser = getActiveUserAccount() || user;
      setCurrentUser(freshUser);
      setAccount(getCustomerAccount(freshUser.id));
      setOrders(getOrdersForUserAccount(freshUser));
      setEditName(freshUser.name || "");
      setEditUsername(freshUser.username || "");
      setEditEmail(freshUser.email || "");
      setEditPhone(freshUser.phone || "");
      setVerifyEmailInput(freshUser.email || "");
    } else {
      const guestPhone = getActiveCustomerPhone();
      if (guestPhone) {
        setAccount(getCustomerAccount(guestPhone));
        setOrders(getOrdersByPhone(guestPhone));
      } else {
        setAccount(null);
        setOrders([]);
      }
    }
  };

  useEffect(() => {
    refreshProfileData(currentUser);
    const handleUpdate = () => {
      refreshProfileData(getActiveUserAccount());
    };
    window.addEventListener("nextgen_orders_updated", handleUpdate);
    window.addEventListener("nextgen_user_account_updated", handleUpdate);
    return () => {
      window.removeEventListener("nextgen_orders_updated", handleUpdate);
      window.removeEventListener("nextgen_user_account_updated", handleUpdate);
    };
  }, [currentUser?.id]);

  // Handle Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const res = loginUserAccount(loginId, loginPass);
    if (!res.ok || !res.user) {
      setAuthError(res.error || "লগইন ব্যর্থ হয়েছে।");
      return;
    }
    setCurrentUser(res.user);
    refreshProfileData(res.user);
  };

  // Handle Create Account
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const identifier = regUsername.trim() || regEmail.trim();
    if (!identifier) {
      setAuthError("অনুগ্রহ করে একটি ইউজারনেম অথবা ইমেইল দিন।");
      return;
    }
    if (!regPassword.trim() || regPassword.trim().length < 4) {
      setAuthError("অনুগ্রহ করে কমপক্ষে ৪ অক্ষরের যেকোনো একটি পাসওয়ার্ড দিন।");
      return;
    }

    const res = registerUserAccount({
      username: regUsername.trim() || regEmail.trim(),
      email: regEmail.trim() || (regUsername.includes("@") ? regUsername.trim() : ""),
      phone: regPhone.trim(),
      name: regName.trim() || regUsername.trim().split("@")[0],
      password: regPassword.trim(),
    });

    if (!res.ok || !res.user) {
      setAuthError(res.error || "অ্যাকাউন্ট তৈরি করা যায়নি।");
      return;
    }

    setCurrentUser(res.user);
    refreshProfileData(res.user);
  };



  // Handle Logout
  const handleLogout = () => {
    setActiveUserAccount(null);
    setActiveCustomerPhone("");
    setCurrentUser(null);
    setAccount(null);
    setOrders([]);
    setLoginId("");
    setLoginPass("");
  };

  // Handle Save Account Details & Password Change
  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErr("");
    setProfileMsg("");
    if (!currentUser) return;

    const cleanNextEmail = editEmail.trim().toLowerCase();
    const cleanCurrentEmail = (currentUser.email || "").trim().toLowerCase();
    const isChangingEmail = cleanNextEmail !== cleanCurrentEmail;

    if (isChangingEmail) {
      const emailChangeRes = changeUserEmailWithPassword({
        userId: currentUser.id,
        newEmail: cleanNextEmail,
        password: editEmailCurrentPassword,
      });
      if (!emailChangeRes.ok) {
        setProfileErr(
          emailChangeRes.error ||
            "ইমেইল পরিবর্তন করতে আপনার বর্তমান পাসওয়ার্ড সঠিকভাবে দিন।"
        );
        return;
      }
    }

    if (newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        setProfileErr("নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।");
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setProfileErr("নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না!");
        return;
      }
    }

    const updated = updateRegisteredUser(currentUser.id, {
      name: editName.trim() || currentUser.name,
      username: editUsername.trim().toLowerCase() || currentUser.username,
      email: cleanNextEmail,
      phone: convertBnToEnDigits(editPhone.trim()),
      ...(isChangingEmail ? { emailVerified: false, verificationCode: undefined } : {}),
      ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
    });

    if (updated) {
      setCurrentUser(updated);
      setNewPassword("");
      setConfirmPassword("");
      setEditEmailCurrentPassword("");
      refreshProfileData(updated);
      setProfileMsg(
        isChangingEmail
          ? "✅ পাসওয়ার্ড যাচাই করে আপনার নতুন ইমেইল ও তথ্য সফলভাবে আপডেট হয়েছে!"
          : "✅ আপনার অ্যাকাউন্ট তথ্য ও পাসওয়ার্ড সফলভাবে আপডেট হয়েছে!"
      );
      setTimeout(() => setProfileMsg(""), 4000);
    }
  };

  // Handle Password-Protected Email Change from Email Verify section
  const handleChangeEmailWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyErr("");
    setVerifyMsg("");
    if (!currentUser) return;

    const res = changeUserEmailWithPassword({
      userId: currentUser.id,
      newEmail: newEmailInput,
      password: emailChangePassword,
    });

    if (!res.ok || !res.user) {
      setVerifyErr(res.error || "ইমেইল অ্যাড্রেস পরিবর্তন করা যায়নি।");
      return;
    }

    setCurrentUser(res.user);
    setNewEmailInput("");
    setEmailChangePassword("");
    setShowEmailChangeForm(false);
    setSentCode("");
    setCodeInput("");
    refreshProfileData(res.user);
    setVerifyMsg(
      `✅ পাসওয়ার্ড যাচাইয়ের মাধ্যমে আপনার ইমেইল অ্যাড্রেস পরিবর্তন করে (${res.user.email}) সেট করা হয়েছে! চাইলে নতুন ইমেইলটি ভেরিফাই করতে পারেন।`
    );
  };

  // Handle Send Verification Code
  const handleSendVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyErr("");
    setVerifyMsg("");
    if (!currentUser) return;

    if (currentUser.emailVerified) {
      setVerifyMsg("✅ আপনার ইমেইল অ্যাড্রেস ইতিমধ্যে ভেরিফাইড আছে।");
      return;
    }

    const mail = verifyEmailInput.trim().toLowerCase();
    if (!mail || !mail.includes("@")) {
      setVerifyErr("সঠিক ইমেইল অ্যাড্রেস লিখুন।");
      return;
    }

    setSendingCode(true);
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(generated);

    const updatedUser = updateRegisteredUser(currentUser.id, {
      email: mail,
      verificationCode: generated,
    });
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }

    await sendCustomerVerificationEmail(mail, currentUser.name, generated);
    setSendingCode(false);
    setVerifyMsg(
      `📧 আপনার ইমেইলে (${mail}) ৬-ডিজিটের গোপন ভেরিফিকেশন কোড পাঠানো হয়েছে! আপনার ইমেইলের Inbox অথবা Spam ফোল্ডার চেক করে নিচে কোডটি লিখুন।`
    );
  };

  const handleConfirmVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyErr("");
    if (!currentUser) return;

    const cleanCode = convertBnToEnDigits(codeInput.trim());
    const expectedCode = sentCode || currentUser.verificationCode || "";
    if (!expectedCode || cleanCode !== expectedCode) {
      setVerifyErr("ভেরিফিকেশন কোড সঠিক নয়! আপনার ইমেইলে পাঠানো ৬ ডিজিটের কোডটি সঠিকভাবে দিন।");
      return;
    }

    const updated = updateRegisteredUser(currentUser.id, {
      email: verifyEmailInput.trim().toLowerCase(),
      emailVerified: true,
      verificationCode: undefined,
    });

    if (updated) {
      setCurrentUser(updated);
      setSentCode("");
      setCodeInput("");
      refreshProfileData(updated);
      setVerifyMsg("🎉 অভিনন্দন! আপনার ইমেইল সফলভাবে ভেরিফাই হয়েছে। এখন অর্ডার ও ডেলিভারির সব আপডেট ইমেইলে পাবেন।");
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> পেন্ডিং
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Clock className="w-3 h-3 animate-spin" /> প্রসেসিং চলছে
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> কমপ্লিট
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" /> বাতিল
          </span>
        );
    }
  };

  const filteredOrders =
    orderFilter === "all" ? orders : orders.filter((o) => o.status === orderFilter);

  const memberSinceText = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Oct 2026";

  const avatarInitial = (
    currentUser?.username?.[0] ||
    currentUser?.email?.[0] ||
    currentUser?.name?.[0] ||
    "U"
  ).toUpperCase();

  const adminHelpWhatsappUrl = `https://wa.me/${formatBdWhatsappForUrl(
    shopSettings.adminWhatsapp || shopSettings.whatsapp
  )}?text=${encodeURIComponent(
    `আসসালামু আলাইকুম এডমিন ভাই, আমার NextGen Efootball অ্যাকাউন্টের পাসওয়ার্ড ভুলে গেছি / লগইন হেল্প প্রয়োজন। আমার ইউজারনেম/ইমেইল: ${
      loginId || currentUser?.username || ""
    }`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0b1326] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {currentUser ? "আমার প্রোফাইল ও অ্যাকাউন্ট" : "ইউজার অ্যাকাউন্ট লগইন / রেজিস্ট্রেশন"}
              </h3>
              <p className="text-[11px] text-slate-400">
                {currentUser
                  ? "অর্ডার হিস্টোরি, পাসওয়ার্ড পরিবর্তন ও ইমেইল ভেরিফিকেশন"
                  : "ইউজারনেম বা ইমেইল ও পাসওয়ার্ড দিয়ে অথবা Google কানেক্ট করে প্রবেশ করুন"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close account modal"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {!currentUser ? (
            /* ================= AUTHENTICATION VIEW (LOGIN / REGISTER / GOOGLE CONNECT) ================= */
            <div className="max-w-md mx-auto space-y-5 py-1">
              {/* Auth Switch Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("login");
                    setAuthError("");
                  }}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                    authTab === "login"
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  লগইন করুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("register");
                    setAuthError("");
                  }}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                    authTab === "register"
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  নতুন অ্যাকাউন্ট খুলুন
                </button>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}

              {authTab === "login" ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      ইউজারনেম অথবা ইমেইল (বা মোবাইল নম্বর) *
                    </label>
                    <input
                      type="text"
                      required
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="ইউজারনেম বা ইমেইল লিখুন..."
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      পাসওয়ার্ড *
                    </label>
                    <div className="relative">
                      <input
                        type={showLoginPass ? "text" : "password"}
                        required
                        value={loginPass}
                        onChange={(e) => setLoginPass(e.target.value)}
                        placeholder="আপনার পাসওয়ার্ড দিন..."
                        className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPass(!showLoginPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-sm transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    অ্যাকাউন্টে লগইন করুন
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        ইউজারনেম অথবা ইমেইল *
                      </label>
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="যেমন: sakib26 বা ইমেইল"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        আপনার নাম
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="আপনার নাম লিখুন"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        ইমেইল অ্যাড্রেস (নোটিফিকেশন পেতে)
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        মোবাইল নম্বর (অর্ডার ট্র্যাকিং)
                      </label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(convertBnToEnDigits(e.target.value))}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      যেকোনো একটি পাসওয়ার্ড দিন *
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPass ? "text" : "password"}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড..."
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass(!showRegPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-sm transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    নতুন অ্যাকাউন্ট তৈরি করুন
                  </button>
                </form>
              )}

              {/* Forgot Password / Admin Help Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                <div className="text-slate-300">
                  <span className="font-bold text-amber-300 block">
                    🔑 পাসওয়ার্ড ভুলে গেছেন বা লগইনে সমস্যা?
                  </span>
                  <span className="text-[11px] text-slate-400">
                    এডমিনের সাথে যোগাযোগ করলে সাথে সাথে আপনার পাসওয়ার্ড ও সব তথ্য দিয়ে দেওয়া হবে।
                  </span>
                </div>
                <a
                  href={adminHelpWhatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs shrink-0 flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>এডমিন সাপোর্ট</span>
                </a>
              </div>
            </div>
          ) : (
            /* ================= LOGGED-IN USER PROFILE (MATCHING SCREENSHOT 2) ================= */
            <div className="space-y-5">
              {/* Top Profile Hero Card (Inspired by Screenshot 2) */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-[#101c38] to-slate-950 border border-slate-800 flex flex-col items-center text-center relative shadow-xl">
                {/* Avatar Initial Circle */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border-2 border-cyan-400/50 flex items-center justify-center text-2xl sm:text-3xl font-black text-white shadow-inner mb-3">
                  {avatarInitial}
                </div>

                {/* Name & Username */}
                <h4 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-1.5">
                  <span>{currentUser.name || currentUser.username}</span>
                  {(currentUser.emailVerified || currentUser.googleConnected) && (
                    <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </h4>

                {/* Email or Username Subtitle */}
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  {currentUser.email || `@${currentUser.username}`}
                </p>

                {/* Member Since Badge */}
                <div className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 font-semibold">
                  <span>Member since {memberSinceText}</span>
                  {currentUser.googleConnected && (
                    <span className="text-cyan-400">• Google Connected</span>
                  )}
                </div>

                {/* Continue Shopping Button */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOrderAgain) onOrderAgain();
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-700/80 text-xs sm:text-sm font-bold text-white transition cursor-pointer shadow"
                >
                  <span>Continue shopping</span>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </button>
              </div>

              {/* Default Password Notice if auto-created */}
              {isUserUsingDefaultPassword(currentUser) && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border-2 border-amber-500/40 text-left space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>অটোমেটিক অ্যাকাউন্ট তৈরি সংক্রান্ত তথ্য ও সতর্কতা</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                      পাসওয়ার্ড পরিবর্তন করুন
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    অর্ডার দেওয়ার সময় কোনো অ্যাকাউন্ট না থাকায় আপনার দেওয়া মোবাইল নম্বর দিয়ে এই অ্যাকাউন্টটি স্বয়ংক্রিয়ভাবে তৈরি হয়েছে:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">ইউজারনেম</span>
                      <span className="font-bold text-white text-[11px]">{currentUser.phone || currentUser.username}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">ডিফল্ট পাসওয়ার্ড</span>
                      <span className="font-bold text-amber-300 text-[11px]">{currentUser.phone || currentUser.password}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] text-slate-400">
                      💡 সুরক্ষার জন্য নিচে ক্লিক করে আপনার নিজস্ব পাসওয়ার্ড সেট করে নিন:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSection("details")}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs cursor-pointer transition shadow"
                    >
                      🔑 নতুন পাসওয়ার্ড সেট করুন →
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Menu Cards (Matching Screenshot 2 — Simple & Essential Only) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveSection("dashboard")}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                    activeSection === "dashboard"
                      ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                      : "bg-slate-950/90 border-slate-800/90 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <LayoutDashboard
                    className={`w-5 h-5 shrink-0 ${
                      activeSection === "dashboard" ? "text-cyan-400" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold block truncate">
                      Dashboard
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      অর্ডার সামারি
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("orders")}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                    activeSection === "orders"
                      ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                      : "bg-slate-950/90 border-slate-800/90 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Package
                    className={`w-5 h-5 shrink-0 ${
                      activeSection === "orders" ? "text-cyan-400" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold block truncate">
                      Orders ({toBn(orders.length)})
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      অর্ডার হিস্টোরি
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("details")}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                    activeSection === "details"
                      ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                      : "bg-slate-950/90 border-slate-800/90 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <KeyRound
                    className={`w-5 h-5 shrink-0 ${
                      activeSection === "details" ? "text-cyan-400" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold block truncate">
                      Account Details
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      পাসওয়ার্ড পরিবর্তন
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("verify")}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                    activeSection === "verify"
                      ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                      : "bg-slate-950/90 border-slate-800/90 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Mail
                    className={`w-5 h-5 shrink-0 ${
                      activeSection === "verify" ? "text-cyan-400" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold block truncate">
                      Email Verify
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {currentUser.emailVerified ? "ভেরিফাইড ✅" : "ইমেইল অ্যালার্ট"}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("support")}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                    activeSection === "support"
                      ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                      : "bg-slate-950/90 border-slate-800/90 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <MessageCircle
                    className={`w-5 h-5 shrink-0 ${
                      activeSection === "support" ? "text-emerald-400" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold block truncate">
                      WhatsApp Support
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      সরাসরি মেসেজ দিন
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-3.5 rounded-2xl bg-rose-950/25 hover:bg-rose-950/40 border border-rose-500/30 text-rose-400 text-left transition flex items-center gap-3 cursor-pointer"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold block truncate">
                      Log out
                    </span>
                    <span className="text-[10px] text-rose-300/80 block truncate">
                      লগ আউট করুন
                    </span>
                  </div>
                </button>
              </div>

              {/* Blocked Alert Banner if user is blocked */}
              {account?.isBlocked && (
                <div className="p-4 rounded-2xl bg-rose-950/50 border-2 border-rose-500/60 text-white space-y-2">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-extrabold text-rose-300">
                        ⛔ আপনার নম্বরটি সাময়িকভাবে ব্লক করা হয়েছে!
                      </h4>
                      <p className="text-xs text-rose-200/90 mt-0.5">
                        কারণ: {account.blockReason || "৩ বার ভুল তথ্য সাবমিট"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 1: DASHBOARD OVERVIEW */}
              {activeSection === "dashboard" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">মোট অর্ডার</span>
                      <span className="text-2xl font-black text-white font-mono mt-0.5 block">
                        {toBn(account?.totalOrders || 0)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30">
                      <span className="text-[11px] text-emerald-300 block">কমপ্লিট অর্ডার</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
                        {toBn(account?.completedOrders || 0)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30">
                      <span className="text-[11px] text-amber-300 block">পেন্ডিং / প্রসেসিং</span>
                      <span className="text-2xl font-black text-amber-400 font-mono mt-0.5 block">
                        {toBn((account?.pendingOrders || 0) + (account?.processingOrders || 0))}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-rose-500/30">
                      <span className="text-[11px] text-rose-300 block">ক্যান্সেল / বাতিল</span>
                      <span className="text-2xl font-black text-rose-400 font-mono mt-0.5 block">
                        {toBn(account?.cancelledOrders || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Summary Card */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 text-xs">
                      <div className="text-slate-400">
                        ইউজারনেম:{" "}
                        <b className="text-white font-mono">@{currentUser.username}</b> • মোবাইল:{" "}
                        <b className="text-cyan-400 font-mono">
                          {currentUser.phone ? formatBdPhonePretty(currentUser.phone) : "যোগ করা হয়নি"}
                        </b>
                      </div>
                      <div className="text-slate-400">
                        সফল অর্ডারে মোট খরচ:{" "}
                        <b className="text-emerald-400 font-mono text-sm">
                          ৳ {toBn(account?.totalSpent || 0)}
                        </b>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveSection("orders")}
                      className="px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-extrabold cursor-pointer shrink-0"
                    >
                      সব অর্ডার দেখুন →
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION 2: ORDER HISTORY MANAGEMENT */}
              {activeSection === "orders" && (
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-cyan-400" />
                      <span>আপনার অর্ডার হিস্টোরি ({toBn(filteredOrders.length)})</span>
                    </h4>

                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {(
                        [
                          { id: "all", label: "সব" },
                          { id: "pending", label: "Pending" },
                          { id: "processing", label: "Processing" },
                          { id: "completed", label: "Completed" },
                          { id: "cancelled", label: "Cancelled" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setOrderFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            orderFilter === tab.id
                              ? "bg-cyan-500 text-black"
                              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 space-y-2">
                      <Package className="w-10 h-10 mx-auto text-slate-600" />
                      <p className="text-xs">কোনো অর্ডার পাওয়া যায়নি।</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredOrders.map((ord) => {
                        const ownership = verifyOrderUserRelationship(ord, currentUser);
                        const notifTemplate = buildOrderNotificationTemplate(
                          ord,
                          getEventTypeForStatus(ord.status, false),
                          shopSettings.siteName
                        );
                        const lastUpdatedTime = new Date(
                          ord.statusUpdatedAt || ord.time
                        ).toLocaleString("bn-BD", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        });
                        const createdTime = new Date(ord.time).toLocaleString("bn-BD", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        });

                        return (
                          <div
                            key={ord.orderNo}
                            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-white text-sm">
                                  #{ord.orderNo}
                                </span>
                                {ownership.verified && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                                    <BadgeCheck className="w-3 h-3" /> অ্যাকাউন্ট ভেরিফাইড
                                  </span>
                                )}
                              </div>
                              <div>{getStatusBadge(ord.status)}</div>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-white block">{ord.packageName}</span>
                                <span className="text-[11px] text-slate-400">
                                  {ord.paymentMethod} • TrxID:{" "}
                                  <code className="font-mono text-amber-400">{ord.trxId}</code>
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-emerald-400 font-mono text-sm block">
                                  ৳ {toBn(ord.price)}
                                </span>
                              </div>
                            </div>

                            {/* Status & Status Update Time Box */}
                            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-1.5 text-[11px]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-slate-400">
                                  অর্ডার সময়: <b className="text-slate-200">{createdTime}</b>
                                </span>
                                <span className="text-cyan-300 font-semibold">
                                  সর্বশেষ স্ট্যাটাস আপডেট: <b className="text-white">{lastUpdatedTime}</b>
                                </span>
                              </div>
                              <p className="text-slate-300 text-xs font-medium pt-1 border-t border-slate-800/80">
                                🔔 {notifTemplate.headline}
                              </p>
                              {ord.statusHistory && ord.statusHistory.length > 0 && (
                                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                                  {ord.statusHistory.map((h, idx) => (
                                    <span
                                      key={`${ord.orderNo}_h_${idx}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300"
                                    >
                                      <span className="font-bold text-cyan-400">
                                        {getOrderStatusLabelBn(h.status)}
                                      </span>
                                      <span className="text-slate-500">•</span>
                                      <span>
                                        {new Date(h.updatedAt).toLocaleTimeString("bn-BD", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => onViewReceipt(ord)}
                                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>রিসিপ্ট দেখুন</span>
                              </button>

                              <a
                                href={`https://wa.me/${formatBdWhatsappForUrl(
                                  shopSettings.adminWhatsapp || shopSettings.whatsapp
                                )}?text=${encodeURIComponent(
                                  `আসসালামু আলাইকুম, আমার অর্ডার #${ord.orderNo} নিয়ে সাহায্য প্রয়োজন।`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp সাপোর্ট</span>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: ACCOUNT DETAILS & PASSWORD CHANGE */}
              {activeSection === "details" && (
                <form
                  onSubmit={handleSaveDetails}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4"
                >
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <Settings className="w-4 h-4 text-cyan-400" />
                    <span>অ্যাকাউন্ট তথ্য ও পাসওয়ার্ড পরিবর্তন</span>
                  </h4>

                  {profileMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      {profileMsg}
                    </div>
                  )}
                  {profileErr && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">
                      {profileErr}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        আপনার নাম
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        ইউজারনেম (Username)
                      </label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        ইমেইল অ্যাড্রেস
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        মোবাইল নম্বর (অর্ডার সিঙ্ক)
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(convertBnToEnDigits(e.target.value))}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {/* If user edited email, require current password to confirm email change */}
                  {editEmail.trim().toLowerCase() !== (currentUser.email || "").trim().toLowerCase() && (
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                      <label className="block text-xs font-extrabold text-amber-300">
                        🔒 ইমেইল অ্যাড্রেস পরিবর্তন নিশ্চিত করতে আপনার বর্তমান পাসওয়ার্ড দিন *
                      </label>
                      <input
                        type="password"
                        required
                        value={editEmailCurrentPassword}
                        onChange={(e) => setEditEmailCurrentPassword(e.target.value)}
                        placeholder="আপনার অ্যাকাউন্টের বর্তমান পাসওয়ার্ড লিখুন..."
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-amber-500/50 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <label className="block text-xs font-extrabold text-cyan-400">
                      নতুন পাসওয়ার্ড সেট / পরিবর্তন করুন (পরিবর্তন না চাইলে খালি রাখুন):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <input
                          type={showEditPass ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="নতুন পাসওয়ার্ড লিখুন"
                          className="w-full pl-3.5 pr-9 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPass(!showEditPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showEditPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <input
                        type={showEditPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="পুনরায় নতুন পাসওয়ার্ড লিখুন"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    তথ্য ও পাসওয়ার্ড সেভ করুন
                  </button>
                </form>
              )}

              {/* SECTION 4: EMAIL VERIFICATION & ORDER EMAIL ALERTS */}
              {activeSection === "verify" && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <Mail className="w-4 h-4 text-cyan-400" />
                        <span>ইমেইল ভেরিফিকেশন ও অর্ডার ইমেইল সার্ভিস</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        ইমেইল ভেরিফাই করা থাকলে অর্ডার কনফার্মেশন এবং অর্ডার কমপ্লিট হওয়ার ইমেইল স্বয়ংক্রিয়ভাবে পাবেন
                      </p>
                    </div>
                    {currentUser.emailVerified && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center gap-1 shrink-0">
                        <Check className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>

                  {verifyMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      {verifyMsg}
                    </div>
                  )}
                  {verifyErr && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">
                      {verifyErr}
                    </div>
                  )}

                  {currentUser.emailVerified ? (
                    /* ALREADY VERIFIED: Hide Send Verification Code option & provide Password-Protected Email Change */
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-extrabold">
                            <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>আপনার ইমেইল অ্যাড্রেস সফলভাবে ভেরিফাইড আছে!</span>
                          </div>
                          <div className="text-xs text-slate-200 font-mono font-bold">
                            {currentUser.email}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            এই ইমেইলে স্বয়ংক্রিয়ভাবে সব অর্ডার ও ডেলিভারি নোটিফিকেশন যাবে। পুনরায় ভেরিফাই কোড পাঠানোর প্রয়োজন নেই।
                          </p>
                        </div>

                        {!showEmailChangeForm && (
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyErr("");
                              setVerifyMsg("");
                              setShowEmailChangeForm(true);
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-extrabold transition cursor-pointer shrink-0 flex items-center gap-1.5"
                          >
                            <Lock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>পাসওয়ার্ড দিয়ে ইমেইল পরিবর্তন করুন</span>
                          </button>
                        )}
                      </div>

                      {showEmailChangeForm && (
                        <form
                          onSubmit={handleChangeEmailWithPassword}
                          className="p-4 rounded-2xl bg-slate-900 border border-cyan-500/40 space-y-3.5"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                              <span>পাসওয়ার্ড দিয়ে নতুন ইমেইল অ্যাড্রেস সেট করুন</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowEmailChangeForm(false);
                                setNewEmailInput("");
                                setEmailChangePassword("");
                                setVerifyErr("");
                              }}
                              className="text-xs text-slate-400 hover:text-white cursor-pointer"
                            >
                              বাতিল
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-300 mb-1">
                                নতুন ইমেইল অ্যাড্রেস দিন *
                              </label>
                              <input
                                type="email"
                                required
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                placeholder="newemail@gmail.com"
                                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-300 mb-1">
                                আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন *
                              </label>
                              <div className="relative">
                                <input
                                  type={showEmailChangePass ? "text" : "password"}
                                  required
                                  value={emailChangePassword}
                                  onChange={(e) => setEmailChangePassword(e.target.value)}
                                  placeholder="আপনার বর্তমান পাসওয়ার্ড..."
                                  className="w-full pl-3.5 pr-9 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowEmailChangePass(!showEmailChangePass)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                >
                                  {showEmailChangePass ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold text-xs transition cursor-pointer"
                          >
                            পাসওয়ার্ড যাচাই করে ইমেইল পরিবর্তন করুন
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    /* NOT VERIFIED YET: Show Send Verification Code form + Password-Protected Email Change if needed */
                    <>
                      <form onSubmit={handleSendVerifyCode} className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">
                            আপনার ইমেইল অ্যাড্রেস ভেরিফাই করুন *
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="email"
                              required
                              value={verifyEmailInput}
                              onChange={(e) => setVerifyEmailInput(e.target.value)}
                              readOnly={Boolean(currentUser.email)}
                              placeholder="yourname@gmail.com"
                              className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400 read-only:opacity-80"
                            />
                            <button
                              type="submit"
                              disabled={sendingCode}
                              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs cursor-pointer shrink-0"
                            >
                              {sendingCode ? "পাঠানো হচ্ছে..." : "ভেরিফাই কোড পাঠান"}
                            </button>
                          </div>
                        </div>
                      </form>

                      {(sentCode || currentUser.verificationCode) && (
                        <form
                          onSubmit={handleConfirmVerifyCode}
                          className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-2.5"
                        >
                          <label className="block text-xs font-bold text-cyan-300">
                            ইমেইলে প্রাপ্ত ৬ ডিজিটের ভেরিফিকেশন কোডটি লিখুন:
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              required
                              maxLength={6}
                              value={codeInput}
                              onChange={(e) => setCodeInput(e.target.value)}
                              placeholder="৬ ডিজিটের কোড দিন (যেমন: 123456)"
                              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm tracking-widest focus:outline-none focus:border-emerald-400"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs cursor-pointer shrink-0"
                            >
                              ভেরিফাই সম্পন্ন করুন
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Option to change email address using password */}
                      <div className="pt-2 border-t border-slate-800/80">
                        {!showEmailChangeForm ? (
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyErr("");
                              setVerifyMsg("");
                              setShowEmailChangeForm(true);
                            }}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>ইমেইল অ্যাড্রেস পরিবর্তন করতে চান? পাসওয়ার্ড দিয়ে পরিবর্তন করুন</span>
                          </button>
                        ) : (
                          <form
                            onSubmit={handleChangeEmailWithPassword}
                            className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-3 mt-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-cyan-300">
                                🔑 পাসওয়ার্ড দিয়ে ইমেইল অ্যাড্রেস পরিবর্তন করুন
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowEmailChangeForm(false)}
                                className="text-xs text-slate-400 hover:text-white cursor-pointer"
                              >
                                বাতিল
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <input
                                type="email"
                                required
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                placeholder="নতুন ইমেইল অ্যাড্রেস দিন"
                                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                              />
                              <input
                                type="password"
                                required
                                value={emailChangePassword}
                                onChange={(e) => setEmailChangePassword(e.target.value)}
                                placeholder="আপনার অ্যাকাউন্টের পাসওয়ার্ড"
                                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs cursor-pointer"
                            >
                              ইমেইল পরিবর্তন করুন
                            </button>
                          </form>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* SECTION 5: SUPPORT CENTER */}
              {activeSection === "support" && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-sm font-extrabold text-white">
                    WhatsApp Support (সরাসরি এডমিনের সাথে কথা বলুন)
                  </h4>
                  <p className="text-xs text-slate-400">
                    যেকোনো অর্ডার সমস্যা, পাসওয়ার্ড পরিবর্তন বা সাহায্যের জন্য সরাসরি আমাদের অফিসিয়াল WhatsApp-এ মেসেজ দিন:
                  </p>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <a
                      href={adminHelpWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Support এ মেসেজ দিন</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
