import { expect as baseExpect, test, type APIRequestContext, type BrowserContextOptions, type Page } from "@playwright/test";

/**
 * Signing in and up hashes a password, and a cast or a count touches the database;
 * with several workers on one dev server those take seconds, not milliseconds.
 */
export const expect = baseExpect.configure({ timeout: 15_000 });

/** A fresh account in the domain the nightly purge clears. */
export function qaEmail(): string {
  return `qa-${Math.random().toString(36).slice(2, 10)}@test.recount.dev`;
}

export const PASSWORD = "correct-horse-battery";

export async function signUp(page: Page): Promise<string> {
  const email = qaEmail();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}

export async function logIn(page: Page, persona: "ada" | "rival", next?: string): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(`${persona}@recount.dev`);
  await page.getByLabel("Password").fill(`recount-demo-${persona}`);
  await page.getByRole("button", { name: "Sign in" }).click();
}

type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

/** Tests that start signed in as ada; each worker signs in once and shares the session. */
export const adaTest = test.extend<object, { adaState: StorageState }>({
  adaState: [
    async ({ browser }, provide, workerInfo) => {
      const page = await browser.newPage({ baseURL: workerInfo.project.use.baseURL });
      await logIn(page, "ada");
      await expect(page).toHaveURL("/dashboard");
      const state = await page.context().storageState();
      await page.close();
      await provide(state);
    },
    { scope: "worker" },
  ],
  storageState: async ({ adaState }, provide) => provide(adaState),
});

/**
 * Console errors and uncaught exceptions. The browser's own line for a 404 document
 * and link prefetches (?_rsc=) are left out.
 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.location().url.includes("_rsc=")) return;
    if (msg.text().startsWith("Failed to load resource: the server responded with a status of 404")) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** "2026-10-21" in UTC, `days` from now. */
export function utcDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export type WizardPoll = {
  title: string;
  options: string[];
  access?: "link" | "codes";
  timeZone?: string;
  opens?: string;
  closes?: string;
};

/** Walks the new-poll wizard and lands on the poll's manage page; returns the slug. */
export async function createPollWithWizard(page: Page, poll: WizardPoll): Promise<string> {
  await page.goto("/new");
  await page.getByLabel("Title").fill(poll.title);
  for (const [i, label] of poll.options.entries()) {
    if (i >= 3) await page.getByRole("button", { name: "Add option" }).click();
    await page.getByLabel(`Option ${i + 1}`, { exact: true }).fill(label);
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Method and seats" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Counting rules" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Who votes, who sees" })).toBeVisible();
  if (poll.access === "codes") await page.getByText("Invite codes", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "When can people vote?" })).toBeVisible();
  if (poll.timeZone) await page.getByLabel("Time zone").selectOption(poll.timeZone);
  if (poll.opens) {
    await page.getByText("At a set time").click();
    await page.getByLabel("Opens", { exact: true }).fill(poll.opens);
  }
  if (poll.closes) await page.getByLabel(/^Closes/).fill(poll.closes);
  await page.getByRole("button", { name: "Continue to review" }).click();
  await expect(page.getByRole("heading", { name: "Check and create" })).toBeVisible();
  await page.getByRole("button", { name: "Create poll" }).click();
  await expect(page).toHaveURL(/\/dashboard\/p\/[^/?]+\?created=1$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** A link-mode poll through the API, for tests that only need one to exist. */
export async function createPollWithApi(page: Page, request: APIRequestContext, title: string): Promise<string> {
  await page.goto("/settings");
  await page.getByLabel("Token name").fill("e2e");
  await page.getByRole("button", { name: "Create token" }).click();
  const token = await page.getByTestId("new-token").innerText();
  const response = await request.post("/api/v1/polls", {
    headers: { authorization: `Bearer ${token}` },
    data: {
      title,
      options: ["Lisbon", "Kraków", "Tallinn", "Valencia"],
      seats: 1,
      presetId: "recount-standard",
      maxRanks: null,
      accessMode: "link",
      resultsVisibility: "live",
      timeZone: "UTC",
      opensAtLocal: null,
      closesAtLocal: null,
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { slug: string }).slug;
}

/** Ranks options by clicking Rank, in order. */
export async function rank(page: Page, ...labels: string[]): Promise<void> {
  for (const label of labels) await page.getByRole("button", { name: `Rank ${label}`, exact: true }).click();
}
