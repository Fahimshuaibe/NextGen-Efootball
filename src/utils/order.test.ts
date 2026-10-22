import test from "node:test";
import assert from "node:assert/strict";
import {
  convertBnToEnDigits,
  isValidBdPhone,
  filterAndSortPackages,
  getSortOptionLabel,
  normalizeSearchText,
  extractRequestedCoinAmount,
  getSmartSearchSuggestions,
  validateEmailChangeWithPassword,
  validateOrderStepOne,
  validateAndFormatPaymentProof,
  SearchableCatalogItem,
} from "./order";
import { PAYMENTS, BANK_ACCOUNTS } from "../config";
import {
  generateUniqueOrderId,
  verifyOrderUserRelationship,
  generateNotificationIdempotencyKey,
  buildOrderNotificationTemplate,
  getEventTypeForStatus,
} from "./orderNotification";
import { processOrderNotificationRequest } from "../../api/notify-order";
import { Order, RegisteredUserAccount } from "../types";

const samplePackages = [
  { id: "p1", coins: 130, price: 145, tag: undefined },
  { id: "p2", coins: 1040, price: 960, tag: "হট ডিল" },
  { id: "p3", coins: 550, price: 500, tag: undefined },
];

test("filterAndSortPackages sorts low to high and high to low accurately", () => {
  const asc = filterAndSortPackages(
    samplePackages,
    "",
    "price_asc",
    (item) => `${item.coins} coins`
  );
  assert.deepEqual(
    asc.map((i) => i.price),
    [145, 500, 960]
  );

  const desc = filterAndSortPackages(
    samplePackages,
    "",
    "price_desc",
    (item) => `${item.coins} coins`
  );
  assert.deepEqual(
    desc.map((i) => i.price),
    [960, 500, 145]
  );
});

test("filterAndSortPackages prioritizes tagged items for popularity and supports Bengali search digits", () => {
  const pop = filterAndSortPackages(
    samplePackages,
    "",
    "popularity",
    (item) => `${item.coins} coins`
  );
  assert.equal(pop[0].id, "p2");

  const searched = filterAndSortPackages(
    samplePackages,
    "১০৪০",
    "default",
    (item) => `${item.coins} কয়েন`
  );
  assert.ok(searched.length >= 1);
  assert.equal(searched[0].id, "p2");
});

test("getSortOptionLabel returns expected Screenshot 3 labels", () => {
  assert.equal(getSortOptionLabel("default"), "Default sorting");
  assert.equal(getSortOptionLabel("popularity"), "Sort by popularity");
  assert.equal(getSortOptionLabel("latest"), "Sort by latest");
  assert.equal(getSortOptionLabel("price_asc"), "Sort by price: low to high");
  assert.equal(getSortOptionLabel("price_desc"), "Sort by price: high to low");
});

test("convertBnToEnDigits and isValidBdPhone handle Bengali numbers", () => {
  assert.equal(convertBnToEnDigits("০১৭১১২২৩৩৪৪"), "01711223344");
  assert.equal(isValidBdPhone("০১৭১১২২৩৩৪৪"), true);
});

test("generateUniqueOrderId generates unique collision-free Order IDs", () => {
  const id1 = generateUniqueOrderId(["EF2610221000"]);
  const id2 = generateUniqueOrderId([id1]);
  assert.ok(id1.startsWith("EF"));
  assert.notEqual(id1, id2);
});

test("verifyOrderUserRelationship securely validates order-to-account ownership", () => {
  const userA: RegisteredUserAccount = {
    id: "usr_a",
    username: "tanvir26",
    email: "tanvir@gmail.com",
    phone: "01711223344",
    name: "Tanvir",
    password: "pass",
    createdAt: new Date().toISOString(),
  };

  const userB: RegisteredUserAccount = {
    id: "usr_b",
    username: "stranger",
    email: "stranger@gmail.com",
    phone: "01999888777",
    name: "Stranger",
    password: "pass",
    createdAt: new Date().toISOString(),
  };

  const orderForA: Order = {
    orderNo: "EF990011",
    time: new Date().toISOString(),
    userId: "usr_a",
    customerEmail: "tanvir@gmail.com",
    name: "Tanvir",
    phone: "01711223344",
    otpWhatsapp: "01711223344",
    konamiIdOrEmail: "tanvir@gmail.com",
    konamiPassword: "secret",
    platform: "Android",
    items: [],
    packageName: "1040 Coins",
    price: 960,
    paymentMethod: "bKash",
    senderNumber: "01711223344",
    trxId: "TRX123456",
    status: "pending",
  };

  assert.equal(verifyOrderUserRelationship(orderForA, userA).verified, true);
  assert.equal(verifyOrderUserRelationship(orderForA, userB).verified, false);
});

test("buildOrderNotificationTemplate creates distinct messages for Created, Processing, Completed, and Cancelled", () => {
  const sampleOrder: Order = {
    orderNo: "EF554433",
    time: new Date().toISOString(),
    name: "রাকিবুল হাসান",
    phone: "01855667788",
    otpWhatsapp: "01855667788",
    konamiIdOrEmail: "rakib@gmail.com",
    konamiPassword: "pass",
    platform: "Android",
    items: [],
    packageName: "৫৫০ কয়েন",
    price: 500,
    paymentMethod: "Nagad",
    senderNumber: "01855667788",
    trxId: "TRX998877",
    status: "pending",
  };

  const createdTpl = buildOrderNotificationTemplate(sampleOrder, "order_created");
  const processingTpl = buildOrderNotificationTemplate(
    { ...sampleOrder, status: "processing" },
    getEventTypeForStatus("processing")
  );
  const completedTpl = buildOrderNotificationTemplate(
    { ...sampleOrder, status: "completed" },
    getEventTypeForStatus("completed")
  );
  const cancelledTpl = buildOrderNotificationTemplate(
    { ...sampleOrder, status: "cancelled" },
    getEventTypeForStatus("cancelled")
  );

  assert.ok(createdTpl.subject.includes("অর্ডার রিসিভ"));
  assert.ok(processingTpl.subject.includes("প্রসেসিং শুরু"));
  assert.ok(completedTpl.subject.includes("কমপ্লিট হয়েছে"));
  assert.ok(cancelledTpl.subject.includes("বাতিল হয়েছে"));
});

test("processOrderNotificationRequest enforces admin authorization and server-side idempotency", async () => {
  const idempKey = generateNotificationIdempotencyKey("EF777888", "status_processing");

  // 1. Unauthorized status change attempt should be rejected with 403
  const unauthRes = await processOrderNotificationRequest({
    orderNo: "EF777888",
    recipientEmail: "gamer@gmail.com",
    eventType: "status_processing",
    subject: "Processing #EF777888",
    html: "<p>Processing</p>",
    text: "Processing",
    idempotencyKey: idempKey,
    adminAuthorized: false,
  });
  assert.equal(unauthRes.httpStatus, 403);
  assert.equal(unauthRes.body.ok, false);

  // 2. Authorized admin status change succeeds
  const firstSend = await processOrderNotificationRequest({
    orderNo: "EF777888",
    recipientEmail: "gamer@gmail.com",
    eventType: "status_processing",
    subject: "Processing #EF777888",
    html: "<p>Processing</p>",
    text: "Processing",
    idempotencyKey: idempKey,
    adminAuthorized: true,
  });
  assert.equal(firstSend.httpStatus, 200);
  assert.equal(firstSend.body.ok, true);
  assert.equal(firstSend.body.deliveryStatus, "sent");

  // 3. Duplicate call with same idempotencyKey is skipped automatically
  const secondSend = await processOrderNotificationRequest({
    orderNo: "EF777888",
    recipientEmail: "gamer@gmail.com",
    eventType: "status_processing",
    subject: "Processing #EF777888",
    html: "<p>Processing</p>",
    text: "Processing",
    idempotencyKey: idempKey,
    adminAuthorized: true,
  });
  assert.equal(secondSend.httpStatus, 200);
  assert.equal(secondSend.body.deliveryStatus, "skipped_duplicate");
});

test("Smart search matches English diacritic-free queries like 'Luis Suarez' and finds nearest coins like 750 for 700 or 800", () => {
  assert.equal(normalizeSearchText("Luis Suárez"), "luis suarez");
  assert.equal(extractRequestedCoinAmount("৮০০ কয়েন"), 800);
  assert.equal(extractRequestedCoinAmount("700 কয়েন"), 700);

  const catalog: SearchableCatalogItem[] = [
    {
      id: "pack1",
      title: "Starter Set: Luis Suárez + 50 Coins",
      subtitle: "স্পেশাল প্লেয়ার প্যাক + ৫০ কয়েন বোনাস",
      coins: 50,
      price: 165,
      category: "playerPacks",
      sectionId: "section-player-packs",
      keywords: "luis suarez মেসি নেইমার প্লেয়ার প্যাক",
    },
    {
      id: "p3",
      title: "550 eFootball™ Coins",
      subtitle: "রেগুলার কয়েন প্যাক",
      coins: 550,
      price: 500,
      category: "regular",
      sectionId: "section-regular",
      keywords: "550 coins কয়েন",
    },
    {
      id: "p4",
      title: "750 eFootball™ Coins",
      subtitle: "রেগুলার কয়েন প্যাক",
      coins: 750,
      price: 685,
      category: "regular",
      sectionId: "section-regular",
      keywords: "750 coins কয়েন",
    },
    {
      id: "p5",
      title: "1040 eFootball™ Coins",
      subtitle: "রেগুলার কয়েন প্যাক",
      coins: 1040,
      price: 960,
      category: "regular",
      sectionId: "section-regular",
      keywords: "1040 coins কয়েন",
    },
  ];

  // English player search without accent
  const suarezResults = getSmartSearchSuggestions(catalog, "Luis Suarez");
  assert.equal(suarezResults.length, 1);
  assert.equal(suarezResults[0].id, "pack1");

  // Nearby coin search: 700 কয়েন -> 750 is closest (diff 50)
  const near700 = getSmartSearchSuggestions(catalog, "700 কয়েন");
  assert.ok(near700.length >= 2);
  assert.equal(near700[0].id, "p4"); // 750 coins first
  assert.equal(near700[0].matchType, "nearby");
  assert.equal(near700[0].coinDiff, 50);

  // Nearby coin search in Bengali digits: ৮০০ কয়েন -> 750 is closest (diff 50)
  const near800 = getSmartSearchSuggestions(catalog, "৮০০ কয়েন");
  assert.ok(near800.length >= 2);
  assert.equal(near800[0].id, "p4"); // 750 coins first

  // Grid filterAndSortPackages also returns nearby coin packages sorted by closeness
  const regularPackages = [
    { id: "p3", coins: 550, price: 500 },
    { id: "p4", coins: 750, price: 685 },
    { id: "p5", coins: 1040, price: 960 },
  ];
  const filtered800 = filterAndSortPackages(
    regularPackages,
    "800 কয়েন",
    "default",
    (p) => `${p.coins} কয়েন`
  );
  assert.ok(filtered800.length >= 2);
  assert.equal(filtered800[0].coins, 750);
});

test("validateEmailChangeWithPassword requires password and valid new email", () => {
  const wrongPass = validateEmailChangeWithPassword({
    currentEmail: "user@gmail.com",
    newEmail: "newuser@gmail.com",
    inputPassword: "wrong",
    actualPassword: "secret123",
  });
  assert.equal(wrongPass.ok, false);

  const sameEmail = validateEmailChangeWithPassword({
    currentEmail: "user@gmail.com",
    newEmail: "USER@gmail.com",
    inputPassword: "secret123",
    actualPassword: "secret123",
  });
  assert.equal(sameEmail.ok, false);

  const validChange = validateEmailChangeWithPassword({
    currentEmail: "user@gmail.com",
    newEmail: "newuser@gmail.com",
    inputPassword: "secret123",
    actualPassword: "secret123",
  });
  assert.equal(validChange.ok, true);
  assert.equal(validChange.normalizedEmail, "newuser@gmail.com");
});

test("Multi-step checkout validates Step 1 and supports bKash, Nagad, Rocket, Upay, Cellfin, and Bank NPSB proofs", () => {
  // Check exact 6 payment methods configured
  assert.deepEqual(
    PAYMENTS.map((p) => p.id),
    ["bkash", "nagad", "rocket", "upay", "cellfin", "bank"]
  );
  assert.equal(PAYMENTS.find((p) => p.id === "bkash")?.number, "01629802989");
  assert.equal(PAYMENTS.find((p) => p.id === "rocket")?.number, "01777414308");
  assert.equal(PAYMENTS.find((p) => p.id === "cellfin")?.number, "01777414308");
  assert.equal(BANK_ACCOUNTS.length, 2);
  assert.equal(BANK_ACCOUNTS[0].accountNumber, "0020-0466009896");
  assert.equal(BANK_ACCOUNTS[1].accountNumber, "20501886700660110");

  // Step 1 validation
  const step1Ok = validateOrderStepOne({
    cartCount: 1,
    konamiIdOrEmail: "player@gmail.com",
    konamiPassword: "pass123",
    name: "তানভীর",
    phone: "০১৭১১২২৩৩৪৪",
    contactMethod: "whatsapp",
    otpWhatsapp: "",
    sameWhatsapp: true,
    contactHandle: "",
  });
  assert.equal(step1Ok.ok, true);
  assert.equal(step1Ok.cleanPhone, "01711223344");

  // Proof 1: Mobile banking with Last 3 digits (personal)
  const last3Proof = validateAndFormatPaymentProof({
    paymentId: "bkash",
    paymentSource: "personal",
    customerPhone: "01711223344",
    personalProofInput: "৩৪৪",
    shopLastDigits: "",
    senderBankAccountName: "",
  });
  assert.equal(last3Proof.ok, true);
  assert.equal(last3Proof.finalTrxId, "LAST3-344");

  // Proof 2: Mobile banking with TrxID (personal)
  const trxProof = validateAndFormatPaymentProof({
    paymentId: "nagad",
    paymentSource: "personal",
    customerPhone: "01711223344",
    personalProofInput: "9k8m2p4q",
    shopLastDigits: "",
    senderBankAccountName: "",
  });
  assert.equal(trxProof.ok, true);
  assert.equal(trxProof.finalTrxId, "9K8M2P4Q");

  // Proof 3: Shop last 3 digits
  const shopProof = validateAndFormatPaymentProof({
    paymentId: "upay",
    paymentSource: "shop",
    customerPhone: "01711223344",
    personalProofInput: "",
    shopLastDigits: "৯৮৭",
    senderBankAccountName: "",
  });
  assert.equal(shopProof.ok, true);
  assert.equal(shopProof.finalTrxId, "SHOP-987");

  // Proof 4: Bank NPSB sender account name
  const bankProof = validateAndFormatPaymentProof({
    paymentId: "bank",
    paymentSource: "bank",
    customerPhone: "01711223344",
    personalProofInput: "",
    shopLastDigits: "",
    senderBankAccountName: "Islami Bank - Md. Rahim",
    targetBankName: "Trust Bank PLC.",
  });
  assert.equal(bankProof.ok, true);
  assert.ok(bankProof.finalSenderNumber?.includes("Islami Bank - Md. Rahim"));
  assert.ok(bankProof.finalTrxId?.includes("NPSB"));
});


