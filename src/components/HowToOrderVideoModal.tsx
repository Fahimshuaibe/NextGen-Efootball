import React, { useRef, useState } from "react";
import { X, Play, Download, CheckCircle2, Sparkles, Video, Smartphone, Volume2, VolumeX } from "lucide-react";

interface HowToOrderVideoModalProps {
  onClose: () => void;
  onStartOrderNow?: () => void;
}

interface VideoStepChapter {
  step: string;
  title: string;
  desc: string;
  timeSec: number;
  timeLabel: string;
}

const VIDEO_SRC = "/assets/aistudio/lv_0_20261022235545_a4fbf8d9.mp4";

const VIDEO_CHAPTERS: VideoStepChapter[] = [
  {
    step: "ধাপ ১",
    title: "ওয়েবসাইটে প্রবেশ করুন (nextgenefootball.store)",
    desc: "আপনার ব্রাউজারে nextgenefootball.store লিখে সার্চ করুন এবং অফিসিয়াল ওয়েবসাইটে প্রবেশ করুন।",
    timeSec: 0,
    timeLabel: "0:00",
  },
  {
    step: "ধাপ ২",
    title: "পছন্দের কয়েন বা প্লেয়ার প্যাক সিলেক্ট করুন",
    desc: "ওয়েবসাইটের প্যাকেজ তালিকা থেকে আপনার পছন্দের কয়েন বা প্যাকের নিচে 'এখনই কিনুন' বাটনে ক্লিক করুন।",
    timeSec: 5,
    timeLabel: "0:05",
  },
  {
    step: "ধাপ ৩",
    title: "প্যাক যোগ/পরিবর্তন ও ডিভাইস (Android/iOS) সিলেক্ট",
    desc: "অর্ডার ফরমের ড্রপডাউন থেকে চাইলে আরও প্যাক বা কম্বো যোগ করুন এবং আপনার ডিভাইস সিলেক্ট করুন।",
    timeSec: 12,
    timeLabel: "0:12",
  },
  {
    step: "ধাপ ৪",
    title: "আপনার Konami ID (Gmail) ও পাসওয়ার্ড দিন",
    desc: "১নং বক্সে আপনার গেমের Konami ID অথবা Gmail এবং পাসওয়ার্ড নির্ভুলভাবে লিখুন।",
    timeSec: 22,
    timeLabel: "0:22",
  },
  {
    step: "ধাপ ৫",
    title: "নাম, মোবাইল ও WhatsApp দিয়ে 'Next' বাটনে চাপুন",
    desc: "আপনার নাম, সচল মোবাইল নম্বর এবং OTP যোগাযোগের মাধ্যম (WhatsApp) দিয়ে 'Next — পেমেন্ট অপশনে যান' চাপুন।",
    timeSec: 31,
    timeLabel: "0:31",
  },
  {
    step: "ধাপ ৬",
    title: "পেমেন্ট মেথড (bKash / নগদ / রকেট) সিলেক্ট করুন",
    desc: "আপনার সুবিধামতো বিকাশ, নগদ, রকেট, উপায়, সেলফিন বা ব্যাংক সিলেক্ট করে নিচের Pay বাটনে ক্লিক করুন।",
    timeSec: 47,
    timeLabel: "0:47",
  },
  {
    step: "ধাপ ৭",
    title: "নম্বর Copy করে Send Money ও শেষ ৩ ডিজিট/TrxID দিন",
    desc: "প্রাপক নম্বরটি Copy করে টাকা পাঠান। এরপর বক্সে TrxID বা মোবাইলের শেষ ৩ ডিজিট লিখে 'VERIFY TRANSACTION' চাপুন।",
    timeSec: 56,
    timeLabel: "0:56",
  },
  {
    step: "ধাপ ৮",
    title: "অর্ডার কনফার্ম, রিসিট ও প্রোফাইলে অর্ডার ট্র্যাকিং!",
    desc: "সাথে সাথে অর্ডার কনফার্ম হবে! অটোমেটিক তৈরি হওয়া একাউন্ট ও 'প্রোফাইল > Orders' থেকে লাইভ স্ট্যাটাস ও রিসিট দেখুন।",
    timeSec: 67,
    timeLabel: "1:07",
  },
];

export const HowToOrderVideoModal: React.FC<HowToOrderVideoModalProps> = ({
  onClose,
  onStartOrderNow,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const handleSeekTo = (sec: number, idx: number) => {
    setActiveChapterIdx(idx);
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    for (let i = VIDEO_CHAPTERS.length - 1; i >= 0; i--) {
      if (t >= VIDEO_CHAPTERS[i].timeSec) {
        if (activeChapterIdx !== i) setActiveChapterIdx(i);
        break;
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-black flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-black text-white truncate">
                  🎬 কিভাবে অর্ডার করবেন? (সম্পূর্ণ ভিডিও গাইড)
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold">
                  <Volume2 className="w-3 h-3" /> বাংলা ভয়েসসহ
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                NextGen Efootball-এ কয়েন ও প্লেয়ার প্যাক অর্ডার করার শুরু থেকে শেষ পর্যন্ত বাংলা ভয়েস ওভারসহ ভিডিও গাইড
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                isMuted
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                  : "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25"
              }`}
              title={isMuted ? "ভয়েস চালু করুন" : "ভয়েস মিউট করুন"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? "সাউন্ড চালু করুন" : "বাংলা ভয়েস চালু"}</span>
            </button>

            <a
              href={VIDEO_SRC}
              download="NextGen-Efootball-How-To-Order.mp4"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold transition cursor-pointer"
              title="ভিডিওটি ডাউনলোড করুন"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">ভিডিও ডাউনলোড</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body: Side-by-side on desktop for 9:16 mobile video + steps */}
        <div className="p-3.5 sm:p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: 9:16 Mobile Screen Recording Player */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-[320px] sm:max-w-[340px] rounded-[28px] p-2 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-2 border-cyan-500/40 shadow-2xl shadow-cyan-950/50 relative">
                <div className="rounded-[20px] overflow-hidden bg-black relative">
                  <video
                    ref={videoRef}
                    src={VIDEO_SRC}
                    controls
                    autoPlay
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onVolumeChange={() => {
                      if (videoRef.current) setIsMuted(videoRef.current.muted);
                    }}
                    className="w-full aspect-[9/16] max-h-[65vh] lg:max-h-[68vh] bg-black object-contain"
                  >
                    আপনার ব্রাউজার ভিডিও প্লেব্যাক সাপোর্ট করছে না।
                  </video>
                </div>
              </div>
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[11px] font-bold text-cyan-300">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>চলমান: {VIDEO_CHAPTERS[activeChapterIdx]?.step} — {VIDEO_CHAPTERS[activeChapterIdx]?.title}</span>
              </div>
            </div>

            {/* Right Column: Interactive Step-by-Step Chapters */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 px-3.5 py-2.5 rounded-2xl">
                <h3 className="text-xs sm:text-sm font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>অর্ডার করার ৮টি ধাপ (ধাপে ক্লিক করলে বাংলা ভয়েসসহ সেই অংশে নিয়ে যাবে):</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                {VIDEO_CHAPTERS.map((chap, idx) => {
                  const isCurrent = activeChapterIdx === idx;
                  return (
                    <button
                      key={chap.step}
                      type="button"
                      onClick={() => handleSeekTo(chap.timeSec, idx)}
                      className={`p-3 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                        isCurrent
                          ? "bg-cyan-950/45 border-cyan-400 ring-1 ring-cyan-400/50 shadow-md shadow-cyan-950/40"
                          : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black shrink-0 flex items-center gap-1 mt-0.5 ${
                          isCurrent
                            ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-black"
                            : "bg-slate-800 text-cyan-300"
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{chap.timeLabel}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {chap.step}
                          </span>
                          <h4 className="text-xs sm:text-sm font-extrabold text-white">
                            {chap.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                          {chap.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <a
            href={VIDEO_SRC}
            download="NextGen-Efootball-How-To-Order.mp4"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-extrabold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>সম্পূর্ণ ভিডিও ডাউনলোড করুন (.mp4)</span>
          </a>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onStartOrderNow) onStartOrderNow();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>বুঝেছি, এখনই অর্ডার করুন</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

