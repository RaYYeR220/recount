import { test } from "@playwright/test";
import { adaTest, collectErrors, logIn, expect } from "./helpers";

// Journeys sign up, create polls and cast ballots against one dev server; give them room.
test.describe.configure({ timeout: 90_000 });

adaTest.describe("ada's dashboard (120 polls)", () => {
  adaTest.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  adaTest("T05: pages through 120 polls twenty at a time", async ({ page }) => {
    const errors = collectErrors(page);
    await expect(page.getByText("Showing 1–20 of 120 polls")).toBeVisible();
    await expect(page.getByRole("table", { name: "Your polls, newest first" }).locator("tbody tr")).toHaveCount(20);
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page.getByText("Showing 21–40 of 120 polls")).toBeVisible();
    await expect(page).toHaveURL("/dashboard?page=2");
    await page.getByRole("link", { name: "Page 6" }).click();
    await expect(page.getByText("Showing 101–120 of 120 polls")).toBeVisible();
    expect(errors).toEqual([]);
  });

  adaTest("T06: search finds the board election alone", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search polls by title" }).fill("Board election");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Showing 1–1 of 1 poll")).toBeVisible();
    await expect(page).toHaveURL(/q=Board(\+|%20)election/);
    const rows = page.getByRole("table", { name: "Your polls, newest first" }).locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Board election 2026");
    await expect(rows.first()).toContainText("board-2026");
  });

  adaTest("searching while typing narrows the list without pressing Enter", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search polls by title" }).pressSequentially("Board game", { delay: 30 });
    await expect(page.getByText("Showing 1–5 of 5 polls")).toBeVisible();
  });

  adaTest("the status filter lives in the URL", async ({ page }) => {
    await page.getByLabel("Status").selectOption("scheduled");
    await expect(page).toHaveURL("/dashboard?status=scheduled");
    const rows = page.getByRole("table", { name: "Your polls, newest first" }).locator("tbody tr");
    await expect(rows.first()).toContainText("Scheduled");
    await expect(page.getByText(/^Showing 1–20 of \d+ polls$/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Status")).toHaveValue("scheduled");
  });

  adaTest("each row names its schedule's zone and links to manage and results", async ({ page }) => {
    await page.goto("/dashboard?q=Product+launch");
    const row = page.getByRole("table", { name: "Your polls, newest first" }).locator("tbody tr").first();
    await expect(row).toContainText("Opens Jan 15, 2027, 12:00 PM");
    await expect(row).toContainText("America/New_York");
    await expect(row.getByRole("link", { name: "Manage Product launch vote" })).toHaveAttribute("href", "/dashboard/p/launch-2027");
    await page.goto("/dashboard?q=Lunch%2C+closed");
    await expect(page.getByRole("link", { name: "Results of Lunch, closed" })).toHaveAttribute("href", "/p/lunch-closed/results");
  });

  adaTest("a search with no match says so and clears", async ({ page }) => {
    await page.goto("/dashboard?q=no-such-poll-anywhere");
    await expect(page.getByRole("heading", { name: "No polls match “no-such-poll-anywhere”" })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page.getByText("Showing 1–20 of 120 polls")).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the dashboard turns rows into cards without sideways scroll", async ({ page }) => {
    await logIn(page, "ada");
    await expect(page.getByText("Showing 1–20 of 120 polls")).toBeVisible();
    await expect(page.getByText("Results: Live").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
