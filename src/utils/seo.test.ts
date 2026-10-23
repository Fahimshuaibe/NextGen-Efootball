import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_ORIGIN,
  isSensitivePath,
  resolveSeoViewKey,
  getSeoMetaForView,
  buildStructuredDataJsonLd,
} from "./seo";
import { DEFAULT_CATALOG_PRODUCTS } from "./storage";

test("Homepage SEO meta has optimal title length, description, canonical URL, and indexable robots tag", () => {
  const viewKey = resolveSeoViewKey({ pathname: "/", activeTab: "all", orderStep: "step1_info" });
  assert.equal(viewKey, "home");

  const meta = getSeoMetaForView(viewKey, "/");
  assert.equal(meta.canonicalUrl, `${CANONICAL_ORIGIN}/`);
  assert.equal(meta.isSensitive, false);
  assert.ok(meta.robots.startsWith("index, follow"));
  assert.ok(meta.title.includes("NextGen Efootball"));
  assert.ok(meta.title.length >= 30 && meta.title.length <= 65);
  assert.ok(meta.description.length >= 90 && meta.description.length <= 200);
  assert.ok(meta.ogImage.startsWith("https://www.nextgenefootball.store/"));
});

test("Each important category/page resolves a unique SEO title, description, and canonical URL", () => {
  const playerMeta = getSeoMetaForView(resolveSeoViewKey({ activeTab: "player_pack" }));
  const comboMeta = getSeoMetaForView(resolveSeoViewKey({ activeTab: "combo" }));
  const regularMeta = getSeoMetaForView(resolveSeoViewKey({ activeTab: "regular" }));
  const guideMeta = getSeoMetaForView(resolveSeoViewKey({ showHowToOrderModal: true }));
  const faqMeta = getSeoMetaForView(resolveSeoViewKey({ pathname: "/faq" }));

  const titles = new Set([
    playerMeta.title,
    comboMeta.title,
    regularMeta.title,
    guideMeta.title,
    faqMeta.title,
  ]);
  assert.equal(titles.size, 5);

  const canonicals = new Set([
    playerMeta.canonicalUrl,
    comboMeta.canonicalUrl,
    regularMeta.canonicalUrl,
    guideMeta.canonicalUrl,
    faqMeta.canonicalUrl,
  ]);
  assert.equal(canonicals.size, 5);
});

test("Sensitive pages and modals (payment verification, OTP, account, receipts, admin) strictly enforce noindex", () => {
  assert.equal(isSensitivePath("/admin"), true);
  assert.equal(isSensitivePath("/account/orders"), true);
  assert.equal(isSensitivePath("/checkout"), true);
  assert.equal(isSensitivePath("/receipt"), true);
  assert.equal(isSensitivePath("/otp"), true);
  assert.equal(isSensitivePath("/"), false);
  assert.equal(isSensitivePath("/player-packs"), false);

  const step2Meta = getSeoMetaForView(
    resolveSeoViewKey({ orderStep: "step2_methods" })
  );
  assert.equal(step2Meta.isSensitive, true);
  assert.ok(step2Meta.robots.includes("noindex"));

  const adminMeta = getSeoMetaForView(
    resolveSeoViewKey({ showAdminPanel: true })
  );
  assert.equal(adminMeta.isSensitive, true);
  assert.ok(adminMeta.robots.includes("noindex"));

  const accountMeta = getSeoMetaForView(
    resolveSeoViewKey({ showAccountModal: true })
  );
  assert.equal(accountMeta.isSensitive, true);
  assert.ok(accountMeta.robots.includes("noindex"));

  const receiptMeta = getSeoMetaForView(
    resolveSeoViewKey({ hasActiveReceipt: true })
  );
  assert.equal(receiptMeta.isSensitive, true);
  assert.ok(receiptMeta.robots.includes("noindex"));
});

test("Structured data JSON-LD contains truthful Organization, WebSite, ItemList, and FAQPage without fake ratings", () => {
  const jsonLd = buildStructuredDataJsonLd(DEFAULT_CATALOG_PRODUCTS);
  const serialized = JSON.stringify(jsonLd);

  assert.ok(serialized.includes('"@type":"Organization"'));
  assert.ok(serialized.includes('"@type":"WebSite"'));
  assert.ok(serialized.includes('"@type":"ItemList"'));
  assert.ok(serialized.includes('"@type":"FAQPage"'));
  assert.ok(serialized.includes("https://www.nextgenefootball.store/"));
  assert.ok(serialized.includes('"priceCurrency":"BDT"'));

  // Must NOT contain fake AggregateRating or Review objects
  assert.equal(serialized.includes("AggregateRating"), false);
  assert.equal(serialized.includes("ratingValue"), false);
  assert.equal(serialized.includes("reviewCount"), false);
});
