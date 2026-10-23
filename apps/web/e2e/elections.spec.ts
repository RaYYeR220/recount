import { expect, test, type Page } from "@playwright/test";

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

const roundTable = (page: Page) => page.getByRole("table", { name: "Votes for each option in each round" });

test("the library lists every replay with how much of the official count it reproduces", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/elections");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eight real elections, recounted from their ballots");
  const table = page.getByRole("table", { name: "Replays of official ranked-choice counts and how closely they match" });
  await expect(table.getByRole("row")).toHaveCount(9);
  const nyc = table.getByRole("row", { name: /New York City 2025 Democratic primary for Mayor/ });
  await expect(nyc).toContainText("28 of 28");
  await expect(nyc).toContainText("Matches the certified count");
  await expect(table.getByRole("row", { name: /Minneapolis 2025 Mayor/ })).toContainText("Matches the city's published round results");
  await expect(table.getByRole("row", { name: /Burlington/ })).toContainText("Within 1 vote of the official count");
  await expect(table.getByRole("row", { name: /Burlington/ })).toContainText("Condorcet winner: Andy Montroll");
  await table.getByRole("link", { name: "Replay Portland, OR 2024 City Council, District 1" }).click();
  await expect(page).toHaveURL(/\/elections\/portland-2024-d1$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Portland, OR 2024 City Council, District 1");
  expect(errors).toEqual([]);
});

test("T01: NYC 2025 names Mamdani the winner with the certified final round", async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto("/elections/nyc-2025-dem-mayor");
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("winner-card")).toContainText("Winner: Zohran Kwame Mamdani");
  const mamdani = roundTable(page).getByRole("row", { name: /Zohran Kwame Mamdani/ });
  const cuomo = roundTable(page).getByRole("row", { name: /Andrew M\. Cuomo/ });
  await expect(mamdani.getByRole("cell").last()).toContainText("573,169");
  await expect(cuomo.getByRole("cell").last()).toContainText("443,229");
  await expect(page.getByRole("region", { name: /: the count, round by round$/ })).toBeVisible();
  await expect(page.locator('.plaque .pl-name[title="Adams & 7 more"]')).toHaveText("Adams & 7");
  expect(errors).toEqual([]);
});

test("T02: NYC 2025 matches every figure of the official count", async ({ page }) => {
  await page.goto("/elections/nyc-2025-dem-mayor");
  await expect(page.getByTestId("golden-summary")).toHaveText("28 of 28 figures match the official count");
  await expect(page.getByText("Matches the certified count").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.locator(".facts .sha").first()).toContainText(/[0-9a-f]{64}/);
});

test("T03: Portland's browser recount reproduces all 159 figures", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await page.goto("/elections/portland-2024-d1");
  await page.getByRole("button", { name: "Recount in your browser" }).click();
  await expect(page.locator(".recount-box [role=status]")).toContainText("159 of 159 figures match", { timeout: 60_000 });
  await expect(page.locator(".recount-box [role=status]")).toContainText("Same winners, same 17 rounds");
  expect(errors).toEqual([]);
});

test("NYC 2025's browser recount unpacks 1.1 million ballots and matches", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/elections/nyc-2025-dem-mayor");
  await page.getByRole("button", { name: "Recount in your browser" }).click();
  await expect(page.locator(".recount-box [role=status]")).toContainText("28 of 28 figures match the official count", { timeout: 90_000 });
  await expect(page.locator(".recount-box [role=status]")).toContainText("1,114,433 ballots counted here");
});

test("T04: Burlington 2009 shows ranked choice and Condorcet disagreeing", async ({ page }) => {
  await page.goto("/elections/burlington-2009-mayor");
  await expect(page.getByText("Ranked-choice winner: Bob Kiss")).toBeVisible();
  await expect(page.getByText("Condorcet winner: Andy Montroll").first()).toBeVisible();
  await expect(page.getByText("Within 1 vote of the official count").first()).toBeVisible();
  await expect(page.getByTestId("golden-summary")).toHaveText("17 of 19 figures match the official count");
});

test("Alaska 2022 explains its Condorcet winner and stays within 18 votes", async ({ page }) => {
  await page.goto("/elections/alaska-2022-special");
  await expect(page.getByTestId("winner-card")).toContainText("Winner: Mary S. Peltola");
  await expect(page.getByText("Ranked-choice winner: Mary S. Peltola")).toBeVisible();
  await expect(page.getByText("Condorcet winner: Nick Begich").first()).toBeVisible();
  await expect(page.getByText("Within 18 votes of the official count").first()).toBeVisible();
});

test("Minneapolis is never called certified", async ({ page }) => {
  await page.goto("/elections/minneapolis-2025-mayor");
  await expect(page.getByText("Matches the city's published round results").first()).toBeVisible();
  await expect(page.getByTestId("golden-summary")).toHaveText("36 of 36 figures match the city's published round results");
  await expect(page.locator("main")).not.toContainText(/certified/i);
});

test("an unknown election answers 404", async ({ page }) => {
  const response = await page.goto("/elections/atlantis-1999");
  expect(response?.status()).toBe(404);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const path of ["/elections", "/elections/nyc-2025-dem-mayor", "/elections/portland-2024-d1"]) {
    test(`${path} has no sideways scroll`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
