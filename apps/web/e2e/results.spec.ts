import { expect, test, type Page } from "@playwright/test";

/** Console errors and uncaught exceptions, leaving out link prefetches (?_rsc=) and the 4xx document itself. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.location().url.includes("_rsc=")) return;
    if (/status of 40[34]/.test(msg.text())) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** Signs a seeded persona in through the auth API; the session cookie lands in the page's context. */
async function signIn(page: Page, baseURL: string | undefined, email: string, password: string) {
  const response = await page.request.post("/api/auth/sign-in/email", { data: { email, password }, headers: { origin: baseURL! } });
  expect(response.ok()).toBe(true);
}

test.describe("results of a closed poll", () => {
  test("T19: the lunch poll shows its winner and round count", async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto("/p/lunch-closed/results");
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("winner-card")).toContainText("Winner: Tacos");
    await expect(page.getByTestId("winner-card")).toContainText("2 rounds");
    await expect(page.getByRole("heading", { level: 1, name: "Lunch, closed" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Lunch, closed" })).toHaveAttribute("href", "/p/lunch-closed");
    await expect(page.getByText("Results: public", { exact: true })).toBeVisible();

    const rounds = page.getByRole("table", { name: "Votes for each option in each round" });
    await expect(rounds.getByRole("row", { name: /Tacos/ })).toContainText("7");
    await expect(rounds.getByRole("row", { name: /Sushi/ })).toContainText("Eliminated");
    await expect(page.getByText("Condorcet winner: Tacos.")).toBeVisible();
    await expect(page.getByText("Plurality would have picked Pizza.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why it won" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inactive ballots" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a recount clicked before the page's script loads still runs", async ({ page }) => {
    // Hold the scripts back so the click lands on the server HTML's button.
    await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto("/p/lunch-closed/results", { waitUntil: "domcontentloaded" });
    // A plain DOM click, as a browser agent sends it: no waiting for the button to be ready.
    await page.getByRole("button", { name: "Recount in your browser" }).evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator(".recount-box [role=status]")).toContainText("Recount matches: same winner, same 2 rounds", { timeout: 30_000 });
    await expect(page).toHaveURL("/p/lunch-closed/results");
  });

  test("T20: the browser recount matches the published result", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/p/lunch-closed/results");
    const published = (await page.locator(".audit-list .sha b").first().innerText()).trim();
    expect(published).toMatch(/^[0-9a-f]{12}$/);
    await page.getByRole("button", { name: "Recount in your browser" }).click();
    await expect(page.locator(".recount-box [role=status]")).toContainText(`Recount matches: same winner, same 2 rounds, CVR SHA-256 ${published}`, {
      timeout: 30_000,
    });
    expect(errors).toEqual([]);
  });

  test("T21: the RCTab summary link opens the JSON in the same tab", async ({ page }) => {
    await page.goto("/p/lunch-closed/results");
    await page.getByRole("link", { name: "RCTab summary (JSON)" }).click();
    await expect(page).toHaveURL(/\/api\/v1\/polls\/lunch-closed\/results\?format=rctab$/);
    const text = await page.locator("body").innerText();
    expect(text).toContain('"Tacos"');
    const summary = JSON.parse(text) as { results: Array<{ tally: Record<string, string> }> };
    expect(summary.results.at(-1)!.tally.Tacos).toBe("7");
  });

  test("the cast-vote record link points at the CSV the recount hashes", async ({ page }) => {
    await page.goto("/p/lunch-closed/results");
    const link = page.getByRole("link", { name: "Cast-vote record (CSV)" });
    await expect(link).toHaveAttribute("href", "/api/v1/polls/lunch-closed/cvr?format=csv");
    await expect(link).not.toHaveAttribute("target", /.+/);
    const csv = await page.request.get("/api/v1/polls/lunch-closed/cvr?format=csv");
    expect((await csv.text()).trim().split("\n")).toHaveLength(14);
  });

  test("an STV poll labels the round RCTab reports after the seats fill", async ({ page }) => {
    await page.goto("/p/committee-2026/results");
    await expect(page.getByTestId("winner-card")).toContainText("Winners: Ana, Ben");
    await expect(page.getByTestId("winner-card")).toContainText("6 rounds");
    const rounds = page.getByRole("table", { name: "Votes for each option in each round" });
    await expect(rounds.getByRole("columnheader", { name: /Round 6/ })).toContainText("seats filled");
    await expect(page.getByText("Ben +1.8000")).toBeVisible();
    await expect(page.getByText("Cleo +1.2000")).toBeVisible();
    await page.getByRole("button", { name: "Recount in your browser" }).click();
    await expect(page.locator(".recount-box [role=status]")).toContainText(/Recount matches: same winners, same 6 rounds, CVR SHA-256 [0-9a-f]{12}/, { timeout: 30_000 });
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the count table opens on the final round", async ({ page }) => {
      await page.goto("/p/lunch-closed/results");
      const table = page.getByRole("region", { name: "Lunch, closed: the count, round by round" });
      await expect(table).toHaveAttribute("data-round", "2");
      await expect(table.locator(".ct-caption")).toContainText("Tacos has 7 of 13 ballots");
      await expect(table.locator('.plaque[data-tray="inactive"] .pl-meta')).toHaveText("none");
    });
  });
});

test.describe("who may see results", () => {
  test("T15: private results look like a poll that does not exist", async ({ page }) => {
    const response = await page.goto("/p/rival-private/results");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This poll doesn't exist or isn't shared with you.");
    await expect(page.locator("body")).not.toContainText("Rival");
  });

  test("an unknown slug gets the same page", async ({ page }) => {
    const response = await page.goto("/p/no-such-poll-anywhere/results");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This poll doesn't exist or isn't shared with you.");
    await expect(page).toHaveTitle("Poll not found · Recount");
  });

  test("T17: results hidden until close answer 403", async ({ page }) => {
    const response = await page.goto("/p/board-2026/results");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results are hidden until this poll closes.");
    await expect(page.getByRole("link", { name: "Go to the ballot" })).toHaveAttribute("href", "/p/board-2026");
    await expect(page).toHaveTitle("Results hidden · Recount");
  });

  test("the owner sees hidden results, labelled as private", async ({ page, baseURL }) => {
    await signIn(page, baseURL, "ada@recount.dev", "recount-demo-ada");
    const response = await page.goto("/p/board-2026/results");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Only you can see this.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No ballots yet." })).toBeVisible();
  });

  test("the owner of private results sees them", async ({ page, baseURL }) => {
    await signIn(page, baseURL, "rival@recount.dev", "recount-demo-rival");
    const response = await page.goto("/p/rival-private/results");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Only you can see this.")).toBeVisible();
    await expect(page.getByTestId("winner-card")).toContainText("Leading:");
  });
});

test("a poll with no ballots says so instead of drawing an empty table", async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto("/p/launch-2027/results");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "No ballots yet." })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByTestId("winner-card")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const path of ["/p/lunch-closed/results", "/p/committee-2026/results"]) {
    test(`${path} has no sideways scroll`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
