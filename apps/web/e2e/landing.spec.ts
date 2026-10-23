import { expect, test, type Page } from "@playwright/test";

/** Console errors and uncaught exceptions while a page is open (link prefetches aside). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.location().url.includes("_rsc=")) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

const hero = (page: Page) => page.locator(".hero-inner");
const plate = (page: Page, name: string) => page.locator(".hero-plaques .plaque").filter({ has: page.locator(".pl-name", { hasText: name }) });

test("the landing makes its claim and links to the NYC replay", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Ranked-choice polls you can recount." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a poll" }).first()).toHaveAttribute("href", "/new");
  await expect(page.getByRole("link", { name: "Recount NYC 2025" })).toHaveAttribute("href", "/elections/nyc-2025-dem-mayor");
  const proof = page.getByRole("complementary", { name: "Proof against the certified count" });
  await expect(proof).toContainText("28 of 28 figures match the certified count, replayed from 1,114,433 ballots");
  await expect(proof).toContainText("573,169");
});

test("the hero counts NYC 2025 to the final round without a script error", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(hero(page)).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
  await expect(hero(page)).toHaveAttribute("data-settled", "1");
  await expect(plate(page, "Mamdani").locator(".pl-count")).toHaveText("469,642");

  await page.getByRole("button", { name: "Next round" }).click();
  await expect(hero(page)).toHaveAttribute("data-settled", "2", { timeout: 15_000 });
  await expect(page.locator(".hero-caption")).toContainText("Round 2, write-ins are eliminated.");

  await page.getByRole("button", { name: "Next round" }).click();
  await expect(hero(page)).toHaveAttribute("data-settled", "3", { timeout: 15_000 });
  await expect(plate(page, "Mamdani").locator(".pl-count")).toHaveText("573,169");
  await expect(plate(page, "Cuomo").locator(".pl-count")).toHaveText("443,229");
  await expect(page.locator(".hero-caption")).toContainText("Mamdani has 573,169 of 1,016,398 ballots, more than half, and wins.");
  await expect(page.getByRole("button", { name: "Count again" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the round lamps scrub the hero from the keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(hero(page)).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
  await expect(hero(page)).toHaveAttribute("data-settled", "1");
  await page.getByRole("button", { name: /^Round 1:/ }).focus();
  await page.keyboard.press("End");
  await expect(hero(page)).toHaveAttribute("data-round", "3");
  await expect(page.getByRole("button", { name: /^Round 3:/ })).toBeFocused();
});

test("the hero's figures are in a table for screen readers", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: /New York City 2025 Democratic primary for Mayor/ });
  await expect(table.getByRole("row", { name: /Inactive/ })).toContainText("55,332");
  await expect(table.getByRole("row", { name: /Zohran Kwame Mamdani/ })).toContainText("573,169");
});

test("the recount runs in the browser and matches what the poll published", async ({ page }) => {
  await page.goto("/");
  const audit = page.locator("#audit");
  const hash = (await audit.locator(".lp-hash").innerText()).replace(/\s/g, "");
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  await audit.getByRole("button", { name: "Recount in your browser" }).click();
  await expect(audit.getByRole("status")).toHaveText(`Recount matches: same winner, same 2 rounds, CVR SHA-256 ${hash.slice(0, 12)}`, { timeout: 15_000 });
});

test("the API example calls this site", async ({ page, baseURL }) => {
  await page.goto("/");
  const example = page.locator("#developers").getByLabel("Example request");
  await expect(example).toContainText(`curl -X POST "${baseURL}/api/v1/tabulate"`);
  await expect(example).not.toContainText("localhost:3000");
});

test("the election ledger labels each replay honestly and links to it", async ({ page }) => {
  await page.goto("/");
  const ledger = page.locator("#replays table");
  const rows = ledger.locator("tbody tr");
  await expect(rows).toHaveCount(8);
  for (const slug of ["nyc-2025-dem-mayor", "portland-2024-d1", "minneapolis-2025-mayor", "burlington-2009-mayor", "alaska-2022-special"]) {
    await expect(ledger.locator(`a[href="/elections/${slug}"]`)).toHaveCount(1);
  }
  const row = (title: string) => rows.filter({ hasText: title });
  await expect(row("New York City 2025")).toContainText("Matches the certified count");
  await expect(row("Portland, OR 2024")).toContainText("Matches the certified count");
  await expect(row("Minneapolis 2025 Mayor")).toContainText("Matches the city's published round results");
  await expect(row("Minneapolis 2025 Mayor")).not.toContainText("certified");
  await expect(row("Burlington")).toContainText(/Within \d+ votes? of the official count/);
  await expect(row("Alaska")).toContainText(/Within \d+ votes? of the official count/);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the hero opens on the final round", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await expect(hero(page)).toHaveAttribute("data-round", "3");
    await expect(hero(page)).toHaveAttribute("data-settled", "3");
    await expect(plate(page, "Mamdani").locator(".pl-count")).toHaveText("573,169");
    await expect(page.getByRole("button", { name: "Count again" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the hero reads claim, table, plates, rail, then the report", async ({ page }) => {
    await page.goto("/");
    const top = async (selector: string) => (await page.locator(selector).first().boundingBox())!.y;
    const order = [
      await top(".hero-lid"),
      await top(".hero-board"),
      await top(".hero-plaques"),
      await top(".hero-rail"),
      await top(".hero-proof"),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
