import { test } from "@playwright/test";
import { collectErrors, createPollWithApi, rank, signUp, expect } from "./helpers";

// Journeys sign up, create polls and cast ballots against one dev server; give them room.
test.describe.configure({ timeout: 90_000 });

const RECEIPT = /^[23456789abcdefghjkmnpqrstuvwxyz]{4}-[23456789abcdefghjkmnpqrstuvwxyz]{4}-[23456789abcdefghjkmnpqrstuvwxyz]{4}$/;

test("T07: rank by clicking, review and cast, then get a receipt", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/p/offsite-2026");
  await rank(page, "Lisbon", "Valencia", "Tallinn");
  await page.getByRole("button", { name: "Move up Tallinn" }).click();
  await page.getByRole("button", { name: "Remove Lisbon" }).click();
  // Lisbon, Valencia, Tallinn; Tallinn moves above Valencia; Lisbon comes off.
  const ranked = page.getByRole("region", { name: "Your ranking" }).getByRole("listitem");
  await expect(ranked).toHaveCount(2);
  await expect(ranked.nth(0)).toContainText("Tallinn");
  await expect(ranked.nth(1)).toContainText("Valencia");
  await page.getByRole("button", { name: "Review ballot" }).click();
  await expect(page.getByRole("heading", { name: "Review your ballot" })).toBeFocused();
  await expect(page.getByText("1. Tallinn")).toBeVisible();
  await expect(page.getByText("2. Valencia")).toBeVisible();
  await page.getByRole("button", { name: "Cast ballot" }).click();
  await expect(page.getByRole("heading", { name: "Your receipt" })).toBeVisible();
  await expect(page.getByTestId("receipt-code")).toHaveText(RECEIPT);
  expect(errors).toEqual([]);
});

test("T08 and T09: the receipt checks out, and the same browser can't vote twice", async ({ page }) => {
  await page.goto("/p/offsite-2026");
  await rank(page, "Kraków", "Lisbon", "Valencia");
  await page.getByRole("button", { name: "Review ballot" }).click();
  await page.getByRole("button", { name: "Cast ballot" }).click();
  const receipt = await page.getByTestId("receipt-code").innerText();
  expect(receipt).toMatch(RECEIPT);

  await page.getByRole("link", { name: "Check your ballot" }).click();
  await page.getByLabel("Receipt", { exact: true }).fill(receipt);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const recorded = page.getByRole("region", { name: "Your ballot as recorded" }).getByRole("listitem");
  await expect(recorded).toHaveText(["1. Kraków", "2. Lisbon", "3. Valencia"]);

  await page.goto(`/p/offsite-2026/receipt`);
  await page.getByRole("link", { name: "Back to ballot" }).click();
  await expect(page.getByText("You've already voted in this poll from this browser.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Rank/ })).toHaveCount(0);
});

test("the voter cookie is httpOnly and lasts 400 days", async ({ page, context }) => {
  await page.goto("/p/offsite-2026");
  await rank(page, "Tallinn");
  await page.getByRole("button", { name: "Review ballot" }).click();
  await page.getByRole("button", { name: "Cast ballot" }).click();
  await expect(page.getByRole("heading", { name: "Your receipt" })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === "rk_voter");
  expect(cookie?.httpOnly).toBe(true);
  const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(399);
  expect(days).toBeLessThanOrEqual(400);
});

test("a wrong receipt is refused plainly", async ({ page }) => {
  await page.goto("/p/offsite-2026/verify");
  await page.getByLabel("Receipt", { exact: true }).fill("aaaa-bbbb-cccc");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("No ballot in this poll has that receipt. Check each character and try again.")).toBeVisible();
});

test("a double click on Cast ballot casts one ballot", async ({ page, request, browser }) => {
  await signUp(page);
  const slug = await createPollWithApi(page, request, "Double click");
  const voter = await browser.newPage();
  await voter.goto(`/p/${slug}`);
  await rank(voter, "Lisbon", "Kraków");
  await voter.getByRole("button", { name: "Review ballot" }).click();
  await voter.getByRole("button", { name: "Cast ballot" }).dblclick();
  await expect(voter.getByRole("heading", { name: "Your receipt" })).toBeVisible();
  await voter.close();

  await page.goto(`/dashboard/p/${slug}`);
  await expect(page.getByRole("region", { name: "Turnout" }).getByText("ballot cast", { exact: true })).toBeVisible();
});

test("a poll that closes during review refuses the ballot with the closing time, not an error page", async ({ page, request, browser }) => {
  await signUp(page);
  const slug = await createPollWithApi(page, request, "Closes mid-review");
  const voter = await browser.newPage();
  await voter.goto(`/p/${slug}`);
  await rank(voter, "Valencia");
  await voter.getByRole("button", { name: "Review ballot" }).click();

  await page.goto(`/dashboard/p/${slug}`);
  await page.getByRole("button", { name: "Close voting now" }).click();
  await page.getByRole("button", { name: "Yes, close voting" }).click();
  await expect(page.getByText(/^Voting closed on/)).toBeVisible();

  await voter.getByRole("button", { name: "Cast ballot" }).click();
  // The cast is refused; whether the ballot stays up with the error or the page turns
  // into the closed notice, the voter reads when it closed, in the poll's zone.
  await expect(voter.getByText(/This poll closed at \w+ \d+, \d{4}, \d+:\d{2} [AP]M \(UTC\)\./)).toBeVisible();
  await expect(voter.getByRole("heading", { name: "Your receipt" })).toHaveCount(0);
  await voter.close();
});

test("thirty long options stay usable and never scroll sideways", async ({ page, request, browser }) => {
  await signUp(page);
  const options = Array.from({ length: 30 }, (_, i) => `Option ${i + 1}: a long name that has to wrap onto a second line on a phone`);
  const slug = await createPollWithApi(page, request, "Thirty options", options);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const voter = await browser.newPage({ viewport });
    await voter.goto(`/p/${slug}`);
    for (const label of options.slice(0, 12)) await voter.getByRole("button", { name: `Rank ${label}`, exact: true }).click();
    await expect(voter.getByRole("region", { name: "Your ranking" }).getByRole("listitem")).toHaveCount(12);
    await voter.getByRole("button", { name: `Move up ${options[11]}`, exact: true }).click();
    const overflow = await voter.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await voter.close();
  }
});

test("the ballot works from the keyboard alone", async ({ page }) => {
  await page.goto("/p/offsite-2026");
  const first = page.getByRole("button", { name: "Rank Lisbon", exact: true });
  await expect(first).toBeEnabled();
  await first.focus();
  await page.keyboard.press("Enter");
  // Focus moves on to the next option still to rank.
  await expect(page.getByRole("button", { name: "Rank Kraków", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Move up Kraków" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Move down Kraków" })).toBeFocused();
  const ranked = page.getByRole("region", { name: "Your ranking" }).getByRole("listitem");
  await expect(ranked.nth(0)).toContainText("Kraków");
  await expect(ranked.nth(1)).toContainText("Lisbon");
  await page.getByRole("button", { name: "Review ballot" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Review your ballot" })).toBeFocused();
});

test("T10: a wrong invite code is refused", async ({ page }) => {
  await page.goto("/p/board-2026");
  await page.getByLabel("Invite code").fill("WRONG-CODE-0000");
  await page.getByRole("button", { name: "Continue to the ballot" }).click();
  await expect(page.getByText("That code isn't valid for this poll.")).toBeVisible();
  await expect(page.getByLabel("Invite code")).toHaveValue("WRONG-CODE-0000");
});

test("a valid invite code opens the ballot without using it up", async ({ page }) => {
  await page.goto("/p/board-2026");
  await page.getByLabel("Invite code").fill("qznu zhds");
  await page.getByRole("button", { name: "Continue to the ballot" }).click();
  await expect(page.getByRole("heading", { name: "Your ranking" })).toBeVisible();
  await expect(page.getByText("3 seats, filled by single transferable vote.")).toBeVisible();
});

test("T12: a scheduled poll names its zone and shows no ballot", async ({ page }) => {
  await page.goto("/p/launch-2027");
  await expect(page.getByText("Voting hasn't started yet.")).toBeVisible();
  await expect(page.getByText("Opens January 15, 2027, 12:00 PM (America/New_York)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Rank/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cast ballot" })).toHaveCount(0);
});

test.describe("in another time zone", () => {
  test.use({ timezoneId: "Asia/Tokyo" });

  test("a scheduled poll still opens in its own zone, and adds the reader's", async ({ page }) => {
    await page.goto("/p/launch-2027");
    await expect(page.getByText("Opens January 15, 2027, 12:00 PM (America/New_York)")).toBeVisible();
    await expect(page.getByText("That's January 16, 2027, 2:00 AM in your time zone (Asia/Tokyo).")).toBeVisible();
  });
});

test("a closed poll links to its results", async ({ page }) => {
  await page.goto("/p/lunch-closed");
  await expect(page.getByRole("heading", { name: "Voting is over." })).toBeVisible();
  await expect(page.getByText(/This poll closed at .* \(Europe\/Warsaw\)\./)).toBeVisible();
  await expect(page.getByRole("link", { name: "See the results" })).toHaveAttribute("href", "/p/lunch-closed/results");
  await expect(page.getByRole("button", { name: "Cast ballot" })).toHaveCount(0);
});

test("an unknown poll is not found, with a 404", async ({ page }) => {
  for (const path of ["/p/no-such-poll", "/p/no-such-poll/verify"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This poll doesn't exist or isn't shared with you.");
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the ballot fits without sideways scroll", async ({ page }) => {
    await page.goto("/p/offsite-2026");
    await rank(page, "Lisbon", "Kraków");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
