import React, { useState, useEffect, useRef } from "react";
import { LiveChatMessage, Order } from "../types";
import { 
  getLiveChatMessages, 
  sendLiveChatMessage, 
  markChatAsRead,
  getActiveCustomerPhone,
  getShopSettings
} from "../utils/storage";
import { 
  MessageSquare, 
  Send, 
  X, 
  ShieldCheck, 
  User, 
  Clock, 
  CheckCheck,
  Headphones,
  Sparkles,
  PhoneCall,
  ExternalLink,
  MessageCircle
} from "lucide-react";
import { formatBdPhonePretty, formatBdWhatsappForUrl } from "../utils/order";

interface Props {
  onClose: () => void;
  initialPhone?: string;
  initialOrderNo?: string;
  initialCustomerName?: string;
  isAdmin?: boolean;
}

export function LiveChatModal({
  onClose,
  initialPhone,
  initialOrderNo,
  initialCustomerName,
  isAdmin = false
}: Props) {
  const shopSettings = getShopSettings();
  const [phone, setPhone] = useState<string>(initialPhone || getActiveCustomerPhone() || "01XXXXXXXXX");
  const [customerName, setCustomerName] = useState<string>(initialCustomerName || "গ্রাহক");
  const [orderNo, setOrderNo] = useState<string>(initialOrderNo || "");
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = () => {
    const list = getLiveChatMessages(phone, orderNo);
    setMessages(list);
    if (!isAdmin && phone) {
      markChatAsRead(phone);
    }
  };

  useEffect(() => {
    loadMessages();
    const handleChatUpdate = () => {
      loadMessages();
    };
    window.addEventListener("nextgen_chat_updated", handleChatUpdate);
    return () => {
      window.removeEventListener("nextgen_chat_updated", handleChatUpdate);
    };
  }, [phone, orderNo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    sendLiveChatMessage({
      orderNo: orderNo || undefined,
      phone: phone || "01700000000",
      customerName: isAdmin ? "NextGen Support" : customerName,
      sender: isAdmin ? "admin" : "customer",
      text: inputText.trim()
    });

    setInputText("");
  };

  const handleQuickChip = (text: string) => {
    setInputText(text);
  };

  const quickChips = isAdmin
    ? [
        "আসসালামু আলাইকুম! আপনার Konami আইডি লগইন শুরু করছি।",
        "আপনার জিমেইলে ওটিপি পাঠানো হয়েছে, অনুগ্রহ করে দিন।",
        "আলহামদুলিল্লাহ আপনার কয়েন সফলভাবে যোগ করা হয়েছে!",
        "পেমেন্ট যাচাই চলছে, একটু সময় দিন।"
      ]
    : [
        "ভাই আমি অনলাইনে আছি ✅",
        "আমার OTP কোড হলো: ",
        "পেমেন্ট পাঠিয়েছি, TrxID চেক করুন 💰",
        "অর্ডারটি কতক্ষণ লাগবে ভাই? ⏱️"
      ];

  const whatsappDirectUrl = `https://wa.me/${formatBdWhatsappForUrl(shopSettings.whatsapp)}?text=${encodeURIComponent(
    `আসসালামু আলাইকুম! NextGen Efootball কয়েন সাপোর্ট প্রয়োজন। ${orderNo ? `অর্ডার নম্বর: #${orderNo}` : ''} ${phone ? `(মোবাইল: ${phone})` : ''}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col h-[600px] max-h-[90vh] overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-black font-extrabold shadow-md shadow-cyan-500/20">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                <span>{isAdmin ? `কাস্টমার চ্যাট: ${customerName}` : "NextGen লাইভ চ্যাট সাপোর্ট"}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-400">
                {orderNo ? `অর্ডার: #${orderNo} • ` : ""}
                {phone ? formatBdPhonePretty(phone) : "অনলাইন সহায়তা"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin && (
              <a
                href={whatsappDirectUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#070e1e]/60">
          <div className="text-center my-1 space-y-1.5">
            <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-400 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              লাইভ চ্যাটে এডমিনের সাথে সরাসরি কথা বলুন ও OTP দিন
            </span>

            {!isAdmin && (
              <div className="block sm:hidden">
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>WhatsApp এ মেসেজ দিতে চাইলে এখানে ক্লিক করুন</span>
                </a>
              </div>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto opacity-40 text-cyan-400" />
              <p>কোনো বার্তা নেই। নিচে মেসেজ লিখে কথা বলা শুরু করুন।</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = isAdmin ? m.sender === "admin" : m.sender === "customer";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                    <span>{m.sender === "admin" ? "🛡️ NextGen Admin" : `👤 ${m.customerName}`}</span>
                    <span>•</span>
                    <span>{m.time}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md break-words ${
                      isMe
                        ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-medium rounded-tr-none"
                        : "bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-none"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickChip(chip)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-cyan-300 whitespace-nowrap transition cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isAdmin ? "কাস্টমারকে উত্তর দিন..." : "আপনার মেসেজ বা ওটিপি লিখুন..."}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 text-black transition cursor-pointer"
            title="মেসেজ পাঠান"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
