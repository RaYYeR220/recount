import { expect, test } from "@playwright/test";

/**
 * The cheap gate in front of TestSprite: every route answers with the status it
 * should, the seeded polls are there, and no page logs an error. preflight.yml
 * runs this file alone against each preview deployment (BASE_URL).
 */
const PAGES: Array<{ path: string; status: number; text: string }> = [
  { path: "/", status: 200, text: "Ranked-choice polls you can recount." },
  { path: "/elections/nyc-2025-dem-mayor", status: 200, text: "28 of 28 figures match the official count" },
  { path: "/elections/burlington-2009-mayor", status: 200, text: "Condorcet winner: Andy Montroll" },
  { path: "/elections/no-such-election", status: 404, text: "This page doesn't exist." },
  { path: "/count", status: 200, text: "Load the overvote example" },
  { path: "/developers", status: 200, text: "/api/v1/tabulate" },
  { path: "/quality", status: 200, text: "38 of 38 RCTab rules fixtures" },
  { path: "/p/offsite-2026", status: 200, text: "Team offsite location" },
  { path: "/p/launch-2027", status: 200, text: "Voting hasn't started yet." },
  { path: "/p/lunch-closed/results", status: 200, text: "Winner: Tacos" },
  { path: "/p/board-2026/results", status: 403, text: "Results are hidden until this poll closes." },
  { path: "/p/rival-private/results", status: 404, text: "This poll doesn't exist or isn't shared with you." },
  { path: "/p/no-such-poll", status: 404, text: "This poll doesn't exist or isn't shared with you." },
  { path: "/login", status: 200, text: "Sign in" },
  { path: "/signup", status: 200, text: "Create" },
];

for (const { path, status, text } of PAGES) {
  test(`${path} answers ${status}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      // Prefetches of linked pages (?_rsc=) are those pages' own business.
      if (msg.type() === "error" && !msg.location().url.includes("_rsc=")) errors.push(msg.text());
    });
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
    await expect(page.locator("body")).toContainText(text);
    // A 403 or 404 page logs its own document request; anything beyond that is a bug.
    expect(errors.filter((e) => !/status of 40[34]/.test(e))).toEqual([]);
  });
}

test("the API answers with the seeded data", async ({ request }) => {
  const openapi = await request.get("/api/v1/openapi.json");
  expect(openapi.status()).toBe(200);
  expect((await openapi.json()).openapi).toMatch(/^3\.1/);

  const elections = await request.get("/api/v1/elections");
  expect(elections.status()).toBe(200);

  const lunch = await request.get("/api/v1/polls/lunch-closed/cvr?format=csv");
  expect(lunch.status()).toBe(200);
  expect(lunch.headers()["x-cvr-sha256"]).toMatch(/^[0-9a-f]{64}$/);
});
