import { expect, test, type Page } from "@playwright/test";

/**
 * Console errors and uncaught exceptions while a page is open. Link prefetches
 * (?_rsc=) are left out: a page linked from here that answers 404 fails its own
 * test, not this one.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.location().url.includes("_rsc=")) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test("the home page answers 200 with the claim", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Ranked-choice polls you can recount." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Recount home" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("an unknown path answers 404 with the not-found page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page doesn't exist." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
});

test("the component sheet counts the committee poll on its table", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/design");
  const table = page.getByRole("region", { name: "Residents' committee, 2 seats: the count, round by round" });
  await expect(table).toBeVisible();
  await table.scrollIntoViewIfNeeded();

  const canvas = table.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(300);
  expect(box?.height).toBeGreaterThan(150);

  await expect(table).toHaveAttribute("data-settled", "1");
  await expect(table.locator(".ct-caption")).toContainText("Ana reaches the quota of 7 with 10 and is elected.");

  await table.getByRole("button", { name: "Next round" }).click();
  await expect(table).toHaveAttribute("data-settled", "2");
  await expect(table.locator(".ct-caption")).toContainText("1.8000 to Ben and 1.2000 to Cleo");

  await table.getByRole("button", { name: /^Round 6:/ }).click();
  await expect(table).toHaveAttribute("data-settled", "6");
  await expect(table.locator(".ct-caption")).toContainText("Round 6, seats filled; surplus set aside.");
  await expect(table.getByRole("button", { name: "Count again" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("the round lamps scrub with the arrow keys", async ({ page }) => {
  await page.goto("/design");
  const table = page.getByRole("region", { name: "Lunch: the count, round by round" });
  await table.scrollIntoViewIfNeeded();
  await expect(table).toHaveAttribute("data-settled", "1");
  await table.getByRole("button", { name: /^Round 1:/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(table).toHaveAttribute("data-round", "2");
  await expect(table.getByRole("button", { name: /^Round 2:/ })).toBeFocused();
  await expect(table.locator(".ct-caption")).toContainText("Tacos has 7 of 13 ballots, more than half, and wins.");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the table opens on the final round", async ({ page }) => {
    await page.goto("/design");
    const table = page.getByRole("region", { name: "Residents' committee, 2 seats: the count, round by round" });
    await expect(table).toHaveAttribute("data-round", "6");
    await expect(table).toHaveAttribute("data-settled", "6");
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const path of ["/", "/design", "/no-such-page"]) {
    test(`${path} has no sideways scroll`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the menu button opens the sections", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Menu", { exact: true }).click();
    const sections = page.getByRole("navigation", { name: "Sections" });
    await expect(sections.getByRole("link", { name: "Elections" })).toBeVisible();
    await expect(sections.getByRole("link", { name: "Quality" })).toBeVisible();
  });
});
