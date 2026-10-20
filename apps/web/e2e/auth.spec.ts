import { test } from "@playwright/test";
import { collectErrors, logIn, qaEmail, signUp, expect } from "./helpers";

// Journeys sign up, create polls and cast ballots against one dev server; give them room.
test.describe.configure({ timeout: 90_000 });

test("a new account lands on an empty dashboard", async ({ page }) => {
  const errors = collectErrors(page);
  const email = await signUp(page);
  await expect(page.getByRole("heading", { name: "No polls yet" })).toBeVisible();
  await expect(page.getByLabel(`Account menu for ${email}`)).toBeVisible();
  expect(errors).toEqual([]);
});

test("T18: a wrong password says so without saying which part was wrong", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(qaEmail().replace("qa-", "nobody-"));
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("signing up twice with one email points to signing in", async ({ page, browser }) => {
  const email = await signUp(page);
  const other = await browser.newPage();
  await other.goto("/signup");
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password").fill("another-password");
  await other.getByRole("button", { name: "Create account" }).click();
  await expect(other.getByText("There is already an account with this email. Sign in instead.")).toBeVisible();
  await other.close();
});

test("a short password is refused before anything is sent", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(qaEmail());
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
});

for (const next of ["https://evil.example", "//evil.example", "/.//evil.example"]) {
  test(`?next=${next} is ignored and sign-in lands on the dashboard`, async ({ page }) => {
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill("ada@recount.dev");
    await page.getByLabel("Password").fill("recount-demo-ada");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { name: "Your polls" })).toBeVisible();
  });
}

test("a same-site ?next= is followed after signing in", async ({ page }) => {
  await logIn(page, "ada", "/settings");
  await expect(page).toHaveURL("/settings");
  await expect(page.getByRole("heading", { name: "API tokens" })).toBeVisible();
});

test("signed-in pages send a visitor to sign in first, and back after", async ({ page }) => {
  await page.goto("/dashboard/p/offsite-2026");
  await expect(page).toHaveURL("/login?next=%2Fdashboard%2Fp%2Foffsite-2026");
  await page.getByLabel("Email").fill("ada@recount.dev");
  await page.getByLabel("Password").fill("recount-demo-ada");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Team offsite location" })).toBeVisible();
});

test("T16: someone else's poll is not found", async ({ page }) => {
  await logIn(page, "ada", "/dashboard/p/rival-private");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This poll doesn't exist or isn't shared with you.");
  await expect(page.getByText("Rival")).toHaveCount(0);
});

// The status code waits for the shared proxy: pages stream from a prerendered shell, so
// notFound() inside them can't change the 200 already sent. Re-enable once the proxy
// rewrites missing and unshared polls to the prerendered 404 route.
test.fixme("someone else's manage page answers 404", async ({ page }) => {
  await logIn(page, "ada");
  await expect(page).toHaveURL("/dashboard");
  const direct = await page.goto("/dashboard/p/rival-private");
  expect(direct?.status()).toBe(404);
});

test("log out ends the session", async ({ page }) => {
  await signUp(page);
  await page.getByLabel(/^Account menu for/).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});
