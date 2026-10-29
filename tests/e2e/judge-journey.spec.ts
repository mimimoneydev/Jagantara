import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function journey(profile = "rhythm") {
  const discovery = { id: `qloo:${profile}`, qlooEntityId: profile, title: profile === "page" ? "Irish literature" : "Irish traditional music", body: "Live Qloo result.", evidenceType: "QLOO_TASTE_CONNECTION", category: profile === "page" ? "books" : "music", explanation: ["Verified signal"] };
  return {
    input: { place: "Five Points, New York City", period: "1840s–1860s", interests: [profile], tasteProfile: profile, demo: true },
    location: { name: "Five Points, New York City", lat: 40.7, lng: -74 },
    timeline: [{ id: "history:1", title: "Verified history", body: "A source-supported event in 1845.", year: 1845, evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.loc.gov/", supportingExcerpt: "Verified history. A source-supported event in 1845.", entailment: { status: "verified", score: 1, method: "verbatim-source-overlap-v1" } }],
    narrative: [], discoveries: [discovery],
    culturalRoute: { title: `A Qloo ${profile} route`, summary: "Qloo determines every route stop.", stops: [discovery], completeCategories: [discovery.category] },
    media: [], resolvedInterests: [{ id: profile, name: profile, type: "urn:tag", signalKind: "tag", confidence: 1, verified: true }],
    qloo: { status: "live", message: "Live Qloo route." }, agentTrace: [], generatedAt: new Date().toISOString(),
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/journey", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(journey(body.tasteProfile || "rhythm")) });
  });
});

test("deployed judge journey exposes Qloo as the primary deliverable and passes axe", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Irish Sample" }).click();
  await expect(page.getByLabel("Qloo cultural route")).toContainText("Primary Qloo deliverable");
  await expect(page.getByText("Qloo live")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("taste switching preserves place and changes the custom Qloo route", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Irish Sample" }).click();
  await expect(page.getByText("A Qloo rhythm route")).toBeVisible();
  await page.getByRole("button", { name: "Page & screen" }).click();
  await expect(page.getByText("A Qloo page route")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Five Points/ })).toBeVisible();
});

test("mobile judge journey has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Irish Sample" }).click();
  await expect(page.getByLabel("Qloo cultural route")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
