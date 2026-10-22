import React from "react";
import { Order } from "../types";
import { SITE } from "../config";
import { 
  CheckCircle2, 
  Clock, 
  Printer, 
  X, 
  AlertTriangle,
  Gift
} from "lucide-react";
import { toBn } from "../utils/order";

interface Props {
  order: Order;
  onClose: () => void;
  onOpenLiveChat?: (phone: string, orderNo?: string) => void;
}

export function OrderReceiptModal({ order, onClose }: Props) {
  const getStatusBadge = () => {
    switch (order.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            কমপ্লিটেড (Completed)
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            প্রসেসিং (Processing)
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            ক্যানসেলড (Cancelled)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            পেন্ডিং (Pending)
          </span>
        );
    }
  };

  const formattedDate = new Date(order.time).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => {
    // Check if an existing print iframe exists and remove it
    const existingIframe = document.getElementById("receipt-print-iframe");
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "receipt-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "800px";
    iframe.style.height = "600px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const itemsHtml = order.items && order.items.length > 0
      ? order.items.map((item) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px;">
            <span style="font-weight:600; color:#1e293b;">${item.name} (${item.quantity}টি)</span>
            <span style="font-weight:700; color:#0f766e;">৳ ${toBn(item.price * item.quantity)}</span>
          </div>
        `).join("")
      : `
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; font-size: 13px;">
            <span style="font-weight:600; color:#1e293b;">${order.packageName}</span>
            <span style="font-weight:700; color:#0f766e;">৳ ${toBn(order.price)}</span>
          </div>
        `;

    const statusBadgeText = order.status === "completed" 
      ? "কমপ্লিটেড (Completed)" 
      : order.status === "processing" 
      ? "প্রসেসিং (Processing)" 
      : order.status === "cancelled"
      ? "ক্যানসেলড (Cancelled)"
      : "পেন্ডিং (Pending)";

    const statusBadgeColor = order.status === "completed"
      ? "background:#dcfce7; color:#15803d; border:1px solid #86efac;"
      : order.status === "processing"
      ? "background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc;"
      : order.status === "cancelled"
      ? "background:#ffe4e6; color:#be123c; border:1px solid #fda4af;"
      : "background:#fef3c7; color:#b45309; border:1px solid #fcd34d;";

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>NextGen-Receipt-${order.orderNo}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            body {
              background: #ffffff;
              color: #0f172a;
              display: flex;
              justify-content: center;
              padding: 10px;
            }
            .receipt-card {
              width: 100%;
              max-width: 480px;
              background: #ffffff;
              border: 1.5px solid #cbd5e1;
              border-radius: 16px;
              padding: 22px;
              page-break-inside: avoid;
              page-break-after: avoid;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 14px;
              margin-bottom: 14px;
            }
            .brand-name {
              font-size: 18px;
              font-weight: 900;
              color: #0284c7;
              letter-spacing: -0.5px;
            }
            .brand-tag {
              font-size: 10px;
              color: #64748b;
              margin-top: 2px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 800;
              ${statusBadgeColor}
            }
            .order-no {
              font-size: 11px;
              font-family: monospace;
              color: #64748b;
              margin-top: 4px;
              font-weight: bold;
            }
            .date-row {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: #64748b;
              margin-bottom: 14px;
            }
            .memo-badge {
              font-weight: 800;
              color: #0284c7;
            }
            .details-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 14px;
              margin-bottom: 14px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 6px 0;
              font-size: 12px;
            }
            .row-border {
              border-bottom: 1px solid #f1f5f9;
            }
            .label {
              color: #64748b;
            }
            .value {
              font-weight: 700;
              color: #0f172a;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-top: 10px;
              margin-top: 8px;
              border-top: 2px solid #cbd5e1;
              font-size: 15px;
              font-weight: 900;
            }
            .total-val {
              color: #0f766e;
              font-size: 18px;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              color: #64748b;
              padding-top: 4px;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="header">
              <div>
                <div class="brand-name">${SITE.name}</div>
                <div class="brand-tag">${SITE.tagline}</div>
              </div>
              <div style="text-align: right;">
                <div class="status-badge">${statusBadgeText}</div>
                <div class="order-no">#${order.orderNo}</div>
              </div>
            </div>

            <div class="date-row">
              <span>তারিখ: ${formattedDate}</span>
              <span class="memo-badge">ডিজিটাল ক্যাশমেমো</span>
            </div>

            <div class="details-box">
              <div class="row row-border">
                <span class="label">গ্রাহকের নাম:</span>
                <span class="value">${order.name}</span>
              </div>
              <div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                <span class="label" style="font-size:11px; display:block; margin-bottom:4px;">অর্ডারকৃত পণ্য / আইটেম:</span>
                ${itemsHtml}
              </div>
              <div class="row row-border">
                <span class="label">পেমেন্ট মেথড:</span>
                <span class="value">${order.paymentMethod}</span>
              </div>
              <div class="total-row">
                <span>সর্বমোট মূল্য:</span>
                <span class="total-val">৳ ${toBn(order.price)}</span>
              </div>
            </div>

            <div class="footer">
              ধন্যবাদ আমাদের সাথে থাকার জন্য! NextGen Efootball-এর পক্ষ থেকে আপনাকে স্বাগতম।
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Trigger print strictly inside the isolated 1-page iframe!
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Iframe print error", err);
        window.print();
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <style>{`
        @media print {
          body > #root {
            display: none !important;
          }
          #receipt-print-iframe {
            display: block !important;
          }
        }
      `}</style>

      <div 
        id="digital-receipt-printable"
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black flex flex-col"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 bg-slate-950/80 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              অফিসিয়াল ডিজিটাল রশিদ (Digital Receipt)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-5 sm:p-6 space-y-4 print:p-4 print:text-black">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:border-gray-300">
            <div className="flex items-center gap-3">
              <img
                src={SITE.logo}
                alt={SITE.name}
                className="w-10 h-10 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800 shadow"
              />
              <div>
                <h3 className="font-extrabold text-base text-white print:text-black">{SITE.name}</h3>
                <p className="text-[10px] text-emerald-400 print:text-gray-600">{SITE.tagline}</p>
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge()}
              <div className="text-[11px] text-slate-400 mt-1 font-mono print:text-gray-600">
                #{order.orderNo}
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="text-xs text-slate-400 print:text-gray-600 flex justify-between">
            <span>তারিখ: {formattedDate}</span>
            <span className="font-bold text-emerald-400 print:text-black">ডিজিটাল ক্যাশমেমো</span>
          </div>

          {/* Clean Receipt Summary: Customer Name, Product Taken, Price, Payment Method (No Sensitive Info) */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-3 print:bg-gray-50 print:border-gray-300 print:text-black">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 print:border-gray-200">
              <span className="text-xs text-slate-400 print:text-gray-600">গ্রাহকের নাম:</span>
              <span className="text-sm font-bold text-white print:text-black">{order.name}</span>
            </div>

            <div className="space-y-2 pb-2 border-b border-slate-800 print:border-gray-200">
              <span className="text-xs text-slate-400 print:text-gray-600 block">অর্ডারকৃত পণ্য / আইটেম:</span>
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 print:text-black">{item.name} ({item.quantity}টি)</span>
                    <span className="font-bold text-emerald-400 print:text-black">৳ {toBn(item.price * item.quantity)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 print:text-black">{order.packageName}</span>
                  <span className="font-bold text-emerald-400 print:text-black">৳ {toBn(order.price)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400 print:text-gray-600">পেমেন্ট মেথড:</span>
              <span className="font-semibold text-white print:text-black">{order.paymentMethod}</span>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800 print:border-gray-300 font-extrabold">
              <span className="text-slate-200 print:text-black">সর্বমোট মূল্য:</span>
              <span className="text-emerald-400 print:text-black text-base">৳ {toBn(order.price)}</span>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400 print:text-gray-600">
              ধন্যবাদ আমাদের সাথে থাকার জন্য! NextGen Efootball-এর পক্ষ থেকে আপনাকে স্বাগতম।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
