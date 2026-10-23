import { test } from "@playwright/test";
import { collectErrors, createPollWithWizard, logIn, rank, signUp, utcDay, expect } from "./helpers";

// Journeys sign up, create polls and cast ballots against one dev server; give them room.
test.describe.configure({ timeout: 90_000 });

test("T14: the schedule simulator shows a scheduled poll open at a later time", async ({ page }) => {
  await signUp(page);
  await createPollWithWizard(page, { title: "Retro format", options: ["Start/stop", "Sailboat", "Timeline"], timeZone: "UTC", opens: `${utcDay(1)} 09:00` });
  await expect(page.getByText("Scheduled").first()).toBeVisible();
  await page.getByLabel("See this poll at").fill(`${utcDay(2)} 10:00`);
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("At that time this poll is open.")).toBeVisible();
  await page.getByLabel("See this poll at").fill(`${utcDay(0)} 00:00`);
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("At that time this poll hasn't opened yet.")).toBeVisible();
  await page.getByLabel("See this poll at").fill("next tuesday");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("Use the format YYYY-MM-DD HH:mm, for example 2027-03-14 09:00.")).toBeVisible();
  await expect(page.getByLabel("See this poll at")).toHaveAttribute("aria-invalid", "true");
});

test("T11: invite codes are generated, listed and work once each", async ({ page, browser }) => {
  await signUp(page);
  const slug = await createPollWithWizard(page, { title: "Club board", options: ["Ana", "Ben", "Cleo"], access: "codes" });
  await page.getByLabel("How many codes?").fill("3");
  await page.getByRole("button", { name: "Generate codes" }).click();
  await expect(page.getByText("3 new codes added.")).toBeVisible();
  const codes = page.getByRole("list", { name: "Invite codes" }).getByRole("listitem");
  await expect(codes).toHaveCount(3);
  await expect(codes.filter({ hasText: "Unused" })).toHaveCount(3);
  const first = (await codes.first().locator(".mono").innerText()).trim();

  const voter = await browser.newPage();
  await voter.goto(`/p/${slug}`);
  await voter.getByLabel("Invite code").fill(first);
  await voter.getByRole("button", { name: "Continue to the ballot" }).click();
  await rank(voter, "Ben", "Ana");
  await voter.getByRole("button", { name: "Review ballot" }).click();
  await voter.getByRole("button", { name: "Cast ballot" }).click();
  await expect(voter.getByRole("heading", { name: "Your receipt" })).toBeVisible();
  await voter.getByRole("link", { name: "Back to ballot" }).click();
  await voter.getByLabel("Invite code").fill(first);
  await voter.getByRole("button", { name: "Continue to the ballot" }).click();
  await expect(voter.getByText("This code has already been used.")).toBeVisible();
  await voter.close();

  await page.reload();
  await expect(codes.filter({ hasText: "Used" }).filter({ hasNotText: "Unused" })).toHaveCount(1);
  await expect(page.getByText("1 / 3")).toBeVisible();
});

test("closing early stops voting and is logged", async ({ page }) => {
  await signUp(page);
  const slug = await createPollWithWizard(page, { title: "Team mascot", options: ["Owl", "Otter", "Orca"] });
  const turnout = page.getByRole("region", { name: "Turnout" });
  await expect(turnout).toContainText("No closing time");
  await expect(turnout).not.toContainText("Open, no closing time");
  await page.getByRole("button", { name: "Close voting now" }).click();
  await page.getByRole("button", { name: "Yes, close voting" }).click();
  await expect(page.getByText(/^Voting closed on .*The count is final/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Audit log" })).toContainText(/Voting closed\. CVR SHA-256 [0-9a-f]{12}…/);

  // Nothing on the page reads as open any more.
  await expect(page.getByRole("link", { name: "See the results" })).toHaveAttribute("href", `/p/${slug}/results`);
  await expect(page.getByRole("link", { name: "Open the voter page" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Share" })).toContainText("Voting is over.");
  const schedule = page.getByRole("region", { name: "Schedule" });
  await expect(schedule).toContainText(/Closed\s*\w+ \d+, \d{4}, \d+:\d{2} [AP]M, by hand/);
  await expect(schedule).not.toContainText("When you close it");
});

test("the closing time can be moved, in the poll's zone", async ({ page }) => {
  await signUp(page);
  await createPollWithWizard(page, { title: "Book club pick", options: ["Dune", "Emma", "Ulysses"], timeZone: "UTC", closes: `${utcDay(5)} 18:00` });
  await page.getByLabel("Closing time").fill(`${utcDay(9)} 18:00`);
  await page.getByRole("button", { name: "Save closing time" }).click();
  await expect(page.getByText("Closing time saved.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Audit log" })).toContainText("Changed the closing time.");
});

test("deleting takes the slug typed out", async ({ page }) => {
  await signUp(page);
  const slug = await createPollWithWizard(page, { title: "Swag item", options: ["Mug", "Socks", "Tote"] });
  const remove = page.getByRole("button", { name: "Delete poll" });
  await expect(remove).toBeDisabled();
  await page.getByLabel(`Type ${slug} to confirm`).fill(slug);
  await remove.click();
  await expect(page).toHaveURL("/dashboard?deleted=1");
  await expect(page.getByText("Poll deleted.")).toBeVisible();
  await page.goto(`/dashboard/p/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This poll doesn't exist or isn't shared with you.");
});

test("an unknown poll is not found", async ({ page }) => {
  await logIn(page, "ada");
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/dashboard/p/no-such-poll");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This poll doesn't exist or isn't shared with you.");
});

// Pages stream from a prerendered shell, so the 404 comes from src/proxy.ts.
test("an unknown manage page answers 404", async ({ page }) => {
  await logIn(page, "ada");
  await expect(page).toHaveURL("/dashboard");
  const response = await page.goto("/dashboard/p/no-such-poll");
  expect(response?.status()).toBe(404);
});

test("ada's manage page shows turnout, the share link and the audit log", async ({ page }) => {
  const errors = collectErrors(page);
  await logIn(page, "ada", "/dashboard/p/board-2026");
  await expect(page.getByRole("heading", { level: 1, name: "Board election 2026" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Turnout" })).toContainText("invite codes used");
  await expect(page.getByLabel("Voter link")).toHaveValue(/\/p\/board-2026$/);
  await expect(page.getByRole("region", { name: "Audit log" })).toContainText("Poll created.");
  await expect(page.getByRole("region", { name: "Schedule" })).toContainText("All times in Europe/Berlin");
  expect(errors).toEqual([]);
});

test("an API token is shown once and is gone after a reload", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings");
  await page.getByLabel("Token name").fill("Deploy script");
  await page.getByRole("button", { name: "Create token" }).click();
  await expect(page.getByTestId("new-token")).toHaveText(/^rk_[a-z0-9]{32}$/);
  await expect(page.getByRole("table", { name: "Your API tokens" })).toContainText("Deploy script");
  await page.reload();
  await expect(page.getByRole("table", { name: "Your API tokens" })).toContainText("Deploy script");
  await expect(page.getByTestId("new-token")).toHaveCount(0);
  await expect(page.getByText(/rk_[a-z0-9]{32}/)).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke Deploy script" }).click();
  await page.getByRole("button", { name: "Yes, revoke Deploy script" }).click();
  await expect(page.getByText("No tokens yet.")).toBeVisible();
});
