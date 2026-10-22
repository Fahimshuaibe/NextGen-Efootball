import { useMemo, useState } from "react";
import { SITE, PAYMENTS, PACKAGES, COMBOS, PLAYER_PACKS, PLAYER_PACK_COMBO, SHEET_WEBHOOK_URL } from "./config.js";

const bn = (n) => n.toLocaleString("bn-BD");

const ALL_OFFERS = [
  ...PACKAGES.map((p) => ({ ...p, label: `${bn(p.coins)} কয়েন` })),
  ...COMBOS.map((c) => ({ ...c, isCombo: true, label: `🎁 কম্বো ${bn(c.coins)} কয়েন` })),
  ...PLAYER_PACKS.map((pp) => ({ ...pp, label: `${pp.emoji} ${pp.title}` })),
  { ...PLAYER_PACK_COMBO, isCombo: true, label: `🔥 ${PLAYER_PACK_COMBO.title}` },
];

// অফারের মেয়াদ শেষ হয়ে গেছে কিনা
function isOfferExpired() {
  if (!SITE.offerEndDate) return false;
  const end = new Date(SITE.offerEndDate + "T23:59:59");
  return new Date() > end;
}

const initial = {
  name: "",
  phone: "",
  customerWhatsapp: "",
  gameId: "",
  platform: "Android",
  packageId: "",
  payment: "bkash",
  senderNumber: "",
  trxId: "",
};

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#060b18]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="#top" className="flex items-center gap-2 font-bold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-400 text-sm font-black text-black">
            eF
          </span>
          {SITE.name}
        </a>
        <a
          href="#order"
          className="rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-emerald-300"
        >
          অর্ডার করুন
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.18),transparent_60%)]" />
      <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:py-20">
        <p className="mb-3 inline-block rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300">
          eFootball 2026 • কয়েন টপ-আপ
        </p>
        <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-5xl">
          দ্রুত ও নিরাপদে <span className="text-emerald-400">eFootball কয়েন</span> নিন
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-400">
          প্যাকেজ বাছুন, bKash / Nagad / Rocket-এ পেমেন্ট করুন, অর্ডার সাবমিট করুন। আমরা যাচাই করে দ্রুত ডেলিভারি দেব।
        </p>
        <div className="mx-auto mt-5 flex max-w-md flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-semibold text-amber-300">
            {SITE.offerBadge}
          </span>
          <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 font-semibold text-sky-300">
            📱 {SITE.platformNote}
          </span>
          {SITE.offerEndDate && (
            <span className="rounded-full border border-rose-400/40 bg-rose-400/10 px-3 py-1 font-semibold text-rose-300">
              📅 অফার চলবে{" "}
              {new Date(SITE.offerEndDate).toLocaleDateString("bn-BD", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}{" "}
              পর্যন্ত
            </span>
          )}
        </div>
        <a
          href="#packages"
          className="mt-7 inline-block rounded-xl bg-emerald-400 px-6 py-3 font-bold text-black transition hover:bg-emerald-300"
        >
          প্যাকেজ দেখুন
        </a>
      </div>
    </section>
  );
}

function Packages({ selected, onSelect }) {
  return (
    <section id="packages" className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-bold text-white">কয়েন প্যাকেজ</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PACKAGES.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p.id);
                document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`relative rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-emerald-400 bg-emerald-400/10"
                  : "border-white/10 bg-white/[0.03] hover:border-emerald-400/50"
              }`}
            >
              {p.tag && (
                <span className="absolute -top-2 right-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">
                  {p.tag}
                </span>
              )}
              <div className="text-xs text-gray-400">eFootball Coin</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{bn(p.coins)}</div>
              <div className="mt-2 text-lg font-bold text-emerald-400">৳ {bn(p.price)}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Combos({ selected, onSelect }) {
  if (!COMBOS.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-4">
      <h2 className="mb-1 text-xl font-bold text-white">🔥 স্পেশাল কম্বো অফার</h2>
      <p className="mb-4 text-sm text-gray-500">সীমিত সময়ের জন্য — দুটো প্যাকেজ একসাথে কম দামে</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COMBOS.map((c) => {
          const active = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id);
                document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-white/10 bg-white/[0.03] hover:border-amber-400/50"
              }`}
            >
              <div className="text-xs text-amber-300">🎁 কম্বো ({c.parts})</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{bn(c.coins)} কয়েন</div>
              <div className="mt-2 text-lg font-bold text-emerald-400">৳ {bn(c.price)}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PlayerPacks({ selected, onSelect }) {
  if (!PLAYER_PACKS.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-4">
      <h2 className="mb-1 text-xl font-bold text-white">💥 Special Player Packs</h2>
      <p className="mb-4 text-sm text-gray-500">⏰ স্টক ও অফার শেষ হওয়ার আগেই অর্ডার করুন!</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLAYER_PACKS.map((pp) => {
          const active = selected === pp.id;
          return (
            <button
              key={pp.id}
              type="button"
              onClick={() => {
                onSelect(pp.id);
                document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-emerald-400 bg-emerald-400/10"
                  : "border-white/10 bg-white/[0.03] hover:border-emerald-400/50"
              }`}
            >
              <div className="text-2xl">{pp.emoji}</div>
              <div className="mt-1 font-extrabold text-white">{pp.title}</div>
              <div className="mt-2 text-lg font-bold text-emerald-400">মাত্র ৳ {bn(pp.price)}</div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            onSelect(PLAYER_PACK_COMBO.id);
            document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
          }}
          className={`rounded-2xl border p-4 text-left transition sm:col-span-2 ${
            selected === PLAYER_PACK_COMBO.id
              ? "border-amber-400 bg-amber-400/10"
              : "border-white/10 bg-white/[0.03] hover:border-amber-400/50"
          }`}
        >
          <div className="text-xs font-semibold text-amber-300">🔥 Combo Offer</div>
          <div className="mt-1 font-extrabold text-white">{PLAYER_PACK_COMBO.title}</div>
          <div className="mt-2 text-lg font-bold text-emerald-400">মাত্র ৳ {bn(PLAYER_PACK_COMBO.price)}</div>
        </button>
      </div>
    </section>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-gray-600 focus:border-emerald-400";

function OrderForm({ form, setForm }) {
  const [done, setDone] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");

  const pkg = useMemo(() => ALL_OFFERS.find((p) => p.id === form.packageId), [form.packageId]);
  const pay = PAYMENTS.find((p) => p.id === form.payment);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onScreenshotChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!pkg) return setError("একটি কয়েন প্যাকেজ বেছে নিন।");
    if (!/^01\d{9}$/.test(form.phone)) return setError("সঠিক মোবাইল নম্বর দিন (১১ ডিজিট, 01 দিয়ে শুরু)।");
    if (!/^(\+?8801|01)\d{9}$/.test(form.customerWhatsapp.replace(/[\s-]/g, "")))
      return setError("সঠিক WhatsApp নম্বর দিন।");
    if (!/^01\d{9}$/.test(form.senderNumber)) return setError("যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি সঠিকভাবে দিন।");
    if (form.trxId.trim().length < 6) return setError("সঠিক Transaction ID দিন।");

    const orderNo = "EF" + Date.now().toString().slice(-7);
    const order = {
      orderNo,
      time: new Date().toISOString(),
      ...form,
      coins: pkg.coins ?? null,
      price: pkg.price,
      paymentMethod: pay.label,
    };

    setSending(true);
    try {
      if (SHEET_WEBHOOK_URL) {
        await fetch(SHEET_WEBHOOK_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(order),
        });
      }
    } catch {
      // শিট সেভ ব্যর্থ হলেও WhatsApp-এ অর্ডার যাবে
    }
    setSending(false);
    setDone(order);

    const msg =
      `নতুন অর্ডার ${orderNo}\n` +
      `নাম: ${form.name}\n` +
      `ফোন: ${form.phone}\n` +
      `WhatsApp: ${form.customerWhatsapp}\n` +
      `eFootball ID: ${form.gameId}\n` +
      `প্ল্যাটফর্ম: ${form.platform}\n` +
      `প্যাকেজ: ${pkg.label} (৳${pkg.price})\n` +
      `পেমেন্ট: ${pay.label}\n` +
      `সেন্ডার নম্বর: ${form.senderNumber}\n` +
      `TrxID: ${form.trxId}` +
      (screenshot ? `\n\n📎 পেমেন্ট স্ক্রিনশট আলাদাভাবে এই চ্যাটে অ্যাটাচ করে দিচ্ছি` : "");
    window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-center">
        <div className="text-4xl">✅</div>
        <h3 className="mt-2 text-xl font-bold text-white">অর্ডার জমা হয়েছে</h3>
        <p className="mt-1 text-gray-300">
          অর্ডার নম্বর: <b className="text-emerald-300">{done.orderNo}</b>
        </p>
        <p className="mt-3 text-sm text-gray-400">
          WhatsApp খুলে মেসেজটি সেন্ড করুন, তাহলে দ্রুত কনফার্ম করা হবে। না খুললে নিচের বাটনে চাপ দিন।
        </p>
        {screenshot && (
          <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
            📎 মনে রাখবেন: WhatsApp চ্যাটে আপনার পেমেন্ট স্ক্রিনশটটা আলাদাভাবে অ্যাটাচ করে পাঠান।
          </p>
        )}
        <a
          href={`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent("আমার অর্ডার নম্বর " + done.orderNo)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-xl bg-emerald-400 px-5 py-2.5 font-bold text-black"
        >
          WhatsApp-এ জানান
        </a>
        <button
          onClick={() => {
            setDone(null);
            setForm(initial);
            setScreenshot(null);
            setScreenshotPreview("");
          }}
          className="mt-3 block w-full text-sm text-gray-400 underline"
        >
          নতুন অর্ডার করুন
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <Field label="আপনার নাম">
        <input required className={inputCls} value={form.name} onChange={set("name")} placeholder="নাম" />
      </Field>
      <Field label="মোবাইল নম্বর">
        <input
          required
          inputMode="numeric"
          maxLength={11}
          className={inputCls}
          value={form.phone}
          onChange={set("phone")}
          placeholder="01XXXXXXXXX"
        />
      </Field>
      <Field label="আপনার WhatsApp নম্বর" hint="অর্ডার কনফার্ম করতে এই নম্বরে যোগাযোগ করা হবে।">
        <input
          required
          inputMode="numeric"
          className={inputCls}
          value={form.customerWhatsapp}
          onChange={set("customerWhatsapp")}
          placeholder="01XXXXXXXXX"
        />
      </Field>
      <Field label="eFootball User ID" hint="গেমের Profile থেকে ইউজার আইডি কপি করে দিন। পাসওয়ার্ড চাওয়া হয় না।">
        <input
          required
          className={inputCls}
          value={form.gameId}
          onChange={set("gameId")}
          placeholder="User ID"
        />
      </Field>
      <Field label="প্ল্যাটফর্ম" hint={`এই অফার ${SITE.platformNote}-এর জন্য প্রযোজ্য`}>
        <select className={inputCls} value={form.platform} onChange={set("platform")}>
          <option className="bg-[#0b1226]">Android</option>
        </select>
      </Field>
      <Field label="প্যাকেজ">
        <select required className={inputCls} value={form.packageId} onChange={set("packageId")}>
          <option value="" className="bg-[#0b1226]">
            — বেছে নিন —
          </option>
          {ALL_OFFERS.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#0b1226]">
              {p.label} — ৳{bn(p.price)}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <span className="mb-2 block text-sm text-gray-300">পেমেন্ট মাধ্যম</span>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENTS.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setForm((f) => ({ ...f, payment: p.id }))}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold ${
                form.payment === p.id ? "text-white" : "border-white/10 text-gray-400"
              }`}
              style={form.payment === p.id ? { borderColor: p.color, background: p.color + "33" } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-white/20 p-3 text-sm text-gray-300">
          {pkg ? (
            <>
              <b className="text-white">৳ {bn(pkg.price)}</b> টাকা <b style={{ color: pay.color }}>{pay.label}</b>{" "}
              Send Money করুন এই নম্বরে:
            </>
          ) : (
            <>প্যাকেজ বেছে নিলে টাকার পরিমাণ দেখাবে। Send Money করুন:</>
          )}
          <div className="mt-1 text-lg font-bold tracking-wide text-white">{pay.number}</div>
        </div>
      </div>

      <Field label="যে নম্বর থেকে টাকা পাঠিয়েছেন">
        <input
          required
          inputMode="numeric"
          maxLength={11}
          className={inputCls}
          value={form.senderNumber}
          onChange={set("senderNumber")}
          placeholder="01XXXXXXXXX"
        />
      </Field>
      <Field label="Transaction ID (TrxID)">
        <input
          required
          className={inputCls + " uppercase"}
          value={form.trxId}
          onChange={set("trxId")}
          placeholder="যেমন 9G7H2K1LMN"
        />
      </Field>

      <Field
        label="পেমেন্টের স্ক্রিনশট (ঐচ্ছিক)"
        hint="সাবমিট করার পর WhatsApp চ্যাট খুললে এই ছবিটা ম্যানুয়ালি অ্যাটাচ করে পাঠিয়ে দিন — ওয়েবসাইট থেকে সরাসরি ছবি পাঠানো সম্ভব না।"
      >
        <input
          type="file"
          accept="image/*"
          onChange={onScreenshotChange}
          className={inputCls + " cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-3 file:py-1.5 file:font-semibold file:text-black"}
        />
        {screenshotPreview && (
          <img
            src={screenshotPreview}
            alt="পেমেন্ট স্ক্রিনশট প্রিভিউ"
            className="mt-2 max-h-40 rounded-xl border border-white/10 object-contain"
          />
        )}
      </Field>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <button
        disabled={sending}
        className="w-full rounded-xl bg-emerald-400 py-3 font-bold text-black transition hover:bg-emerald-300 disabled:opacity-60"
      >
        {sending ? "পাঠানো হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
      </button>
    </form>
  );
}

function Steps() {
  const steps = [
    ["১", "প্যাকেজ বাছুন", "আপনার পছন্দের কয়েন প্যাকেজ সিলেক্ট করুন।"],
    ["২", "পেমেন্ট করুন", "bKash / Nagad / Rocket-এ Send Money করুন।"],
    ["৩", "ফর্ম পূরণ", "ইউজার আইডি ও TrxID দিয়ে অর্ডার সাবমিট করুন।"],
    ["৪", "ডেলিভারি", "পেমেন্ট যাচাই শেষে কয়েন পাঠানো হবে।"],
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-bold text-white">কীভাবে কাজ করে</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        {steps.map(([n, t, d]) => (
          <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-400 font-bold text-black">{n}</div>
            <div className="mt-3 font-semibold text-white">{t}</div>
            <p className="mt-1 text-sm text-gray-400">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    ["কতক্ষণে কয়েন পাব?", "পেমেন্ট যাচাই হলে সাধারণত অল্প সময়েই ডেলিভারি দেওয়া হয়। সাপোর্ট সময়: " + SITE.supportHours + "।"],
    ["আমার পাসওয়ার্ড লাগবে?", "না। আমরা কখনো আপনার পাসওয়ার্ড বা লগইন কোড চাই না। কেউ চাইলে দিবেন না।"],
    ["ভুল TrxID দিলে কী হবে?", "অর্ডার প্রসেস হবে না। সঠিক TrxID দিয়ে WhatsApp-এ যোগাযোগ করুন।"],
    ["রিফান্ড পাওয়া যাবে?", "কয়েন ডেলিভারির আগে অর্ডার বাতিল করলে টাকা ফেরত দেওয়া হবে।"],
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-bold text-white">সাধারণ প্রশ্ন</h2>
      <div className="space-y-2">
        {items.map(([q, a]) => (
          <details key={q} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <summary className="cursor-pointer font-semibold text-white">{q}</summary>
            <p className="mt-2 text-sm text-gray-400">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-white/10 py-8 text-center text-sm text-gray-500">
      <div className="mb-3 flex justify-center gap-5">
        <a className="hover:text-emerald-300" href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <a className="hover:text-emerald-300" href={SITE.facebookPage} target="_blank" rel="noreferrer">
          Facebook
        </a>
      </div>
      <p>© {new Date().getFullYear()} {SITE.name}. এটি Konami-র অফিশিয়াল সাইট নয়।</p>
    </footer>
  );
}

export default function App() {
  const [form, setForm] = useState(initial);
  return (
    <>
      <Header />
      <Hero />
      <Packages selected={form.packageId} onSelect={(id) => setForm((f) => ({ ...f, packageId: id }))} />
      <Combos selected={form.packageId} onSelect={(id) => setForm((f) => ({ ...f, packageId: id }))} />
      <PlayerPacks selected={form.packageId} onSelect={(id) => setForm((f) => ({ ...f, packageId: id }))} />
      {isOfferExpired() && (
        <p className="mx-auto max-w-5xl px-4 pb-4 text-center text-sm text-rose-300">
          ⚠️ স্পেশাল অফারটির মেয়াদ শেষ হয়ে গেছে — নতুন দাম বা অফারের জন্য আমাদের সাথে যোগাযোগ করুন।
        </p>
      )}
      <section id="order" className="mx-auto max-w-xl px-4 py-10">
        <h2 className="mb-6 text-2xl font-bold text-white">অর্ডার ফর্ম</h2>
        <OrderForm form={form} setForm={setForm} />
      </section>
      <Steps />
      <FAQ />
      <Footer />
    </>
  );
}
