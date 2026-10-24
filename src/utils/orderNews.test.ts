import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCustomerNameWithHonorific,
  formatPurchasedItemForNews,
  getLatestThreeOrderNews,
  buildActiveNewsTickerItems,
} from "./orderNews";
import { Order, CustomNewsTickerItem } from "../types";

function createSampleOrder(overrides: Partial<Order>): Order {
  return {
    orderNo: "NG-1001",
    time: "2026-10-24 10:30 AM",
    name: "রহিম",
    phone: "01711111111",
    otpWhatsapp: "01711111111",
    konamiIdOrEmail: "rahim@example.com",
    konamiPassword: "secret",
    platform: "Android",
    items: [],
    packageName: "1000 Coins",
    price: 1100,
    coins: 1000,
    paymentMethod: "bkash",
    senderNumber: "01711111111",
    trxId: "TRX12345",
    status: "completed",
    ...overrides,
  };
}

test("formatCustomerNameWithHonorific appends ভাই when not already present", () => {
  assert.equal(formatCustomerNameWithHonorific("রহিম"), "রহিম ভাই");
  assert.equal(formatCustomerNameWithHonorific("রহিম ভাই"), "রহিম ভাই");
  assert.equal(formatCustomerNameWithHonorific("করিম আহমেদ"), "করিম আহমেদ ভাই");
});

test("formatPurchasedItemForNews detects Luis Suárez, Iker Casillas, and coin amounts in Bengali", () => {
  assert.equal(
    formatPurchasedItemForNews({
      packageName: "Starter Set: Luis Suárez + 50 Coins",
      items: [],
      coins: 50,
    }),
    "লুইস সুয়ারেজ প্যাক"
  );

  assert.equal(
    formatPurchasedItemForNews({
      packageName: "Starter Set: Iker Casillas + 100 Coins",
      items: [],
      coins: 100,
    }),
    "ইকার ক্যাসিয়াস প্যাক"
  );

  assert.equal(
    formatPurchasedItemForNews({
      packageName: "1000 Coins",
      items: [],
      coins: 1000,
    }),
    "১,০০০ কয়েন"
  );
});

test("getLatestThreeOrderNews always returns 3 news items by default prioritizing completed orders", () => {
  const fallbackOnly = getLatestThreeOrderNews([]);
  assert.equal(fallbackOnly.length, 3);
  assert.ok(fallbackOnly[0].headline.includes("রহিম ভাই এই মাত্র তার জন্য লুইস সুয়ারেজ প্যাক কিনে নিল!"));

  const orders: Order[] = [
    createSampleOrder({
      orderNo: "NG-2001",
      name: "আরিফ",
      packageName: "Starter Set: Luis Suárez + 50 Coins",
      coins: 50,
      status: "completed",
    }),
    createSampleOrder({
      orderNo: "NG-2002",
      name: "মাহমুদ",
      packageName: "Starter Set: Iker Casillas + 100 Coins",
      coins: 100,
      status: "completed",
    }),
    createSampleOrder({
      orderNo: "NG-2003",
      name: "নাঈম",
      packageName: "3000 Coins",
      coins: 3000,
      status: "completed",
    }),
    createSampleOrder({
      orderNo: "NG-2004",
      name: "পুরাতন কাস্টমার",
      packageName: "500 Coins",
      coins: 500,
      status: "completed",
    }),
  ];

  const latestThree = getLatestThreeOrderNews(orders);
  assert.equal(latestThree.length, 3);
  assert.equal(
    latestThree[0].headline,
    "আরিফ ভাই এই মাত্র তার জন্য লুইস সুয়ারেজ প্যাক কিনে নিল!"
  );
  assert.equal(
    latestThree[1].headline,
    "মাহমুদ ভাই এই মাত্র তার জন্য ইকার ক্যাসিয়াস প্যাক কিনে নিল!"
  );
  assert.equal(
    latestThree[2].headline,
    "নাঈম ভাই এই মাত্র তার জন্য ৩,০০০ কয়েন কিনে নিল!"
  );
});

test("buildActiveNewsTickerItems supports keeping only 1 single announcement when auto orders are disabled", () => {
  const singleCustom: CustomNewsTickerItem[] = [
    {
      id: "custom-1",
      headline: "আজ রাত ১২টা পর্যন্ত সকল কয়েন প্যাকে স্পেশাল ডিসকাউন্ট চলছে!",
      badgeText: "জরুরি ঘোষণা",
      isActive: true,
      createdAt: "2026-10-24T10:00:00Z",
    },
  ];

  const items = buildActiveNewsTickerItems([], {
    isEnabled: true,
    showAutoLastOrders: false,
    autoOrderCount: 3,
    autoOrderOverrides: {},
    customItems: singleCustom,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "custom");
  assert.equal(items[0].headline, "আজ রাত ১২টা পর্যন্ত সকল কয়েন প্যাকে স্পেশাল ডিসকাউন্ট চলছে!");
  assert.equal(items[0].badgeText, "জরুরি ঘোষণা");
});

test("buildActiveNewsTickerItems supports 10 items (e.g. 7 custom items + 3 automatic orders or 10 custom items)", () => {
  const sevenCustom: CustomNewsTickerItem[] = Array.from({ length: 7 }, (_, i) => ({
    id: `custom-${i + 1}`,
    headline: `গুরুত্বপূর্ণ আপডেট নম্বর ${i + 1}`,
    badgeText: "আপডেট",
    isActive: true,
    createdAt: "2026-10-24T10:00:00Z",
  }));

  const combinedTen = buildActiveNewsTickerItems([], {
    isEnabled: true,
    showAutoLastOrders: true,
    autoOrderCount: 3,
    autoOrderOverrides: {},
    customItems: sevenCustom,
  });

  assert.equal(combinedTen.length, 10);
  assert.equal(combinedTen.filter((x) => x.kind === "custom").length, 7);
  assert.equal(combinedTen.filter((x) => x.kind === "order").length, 3);
});

test("buildActiveNewsTickerItems allows editing or hiding individual automatic order news items", () => {
  const orders: Order[] = [
    createSampleOrder({
      orderNo: "NG-5001",
      name: "তানভীর",
      packageName: "1000 Coins",
      coins: 1000,
      status: "completed",
    }),
  ];

  const items = buildActiveNewsTickerItems(orders, {
    isEnabled: true,
    showAutoLastOrders: true,
    autoOrderCount: 3,
    autoOrderOverrides: {
      "order-news-NG-5001": {
        headline: "তানভীর ভাই স্পেশাল ভিআইপি কম্বো প্যাক কিনে নিল!",
        badgeText: "ভিআইপি অর্ডার",
      },
      "seed-news-2": {
        hidden: true,
      },
    },
    customItems: [],
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].headline, "তানভীর ভাই স্পেশাল ভিআইপি কম্বো প্যাক কিনে নিল!");
  assert.equal(items[0].badgeText, "ভিআইপি অর্ডার");
  assert.equal(items[0].isCustomHeadline, true);
});
