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

/** Requests that would carry the ballots anywhere: the tool counts in the browser. */
function watchUploads(page: Page): string[] {
  const uploads: string[] = [];
  page.on("request", (req) => {
    if (req.method() !== "GET") uploads.push(`${req.method()} ${req.url()}`);
  });
  return uploads;
}

async function countOvervoteExample(page: Page, rules: string) {
  await page.goto("/count");
  await page.getByRole("button", { name: "Load the overvote example" }).click();
  await page.getByLabel("Rules").selectOption({ label: rules });
  await page.getByRole("button", { name: "Count", exact: true }).click();
}

test("T22: New York City rules end overvoted ballots, and Bea wins", async ({ page }) => {
  const errors = collectErrors(page);
  const uploads = watchUploads(page);
  await countOvervoteExample(page, "New York City");
  await expect(page.getByTestId("winner-card")).toContainText("Winner: Bea");
  await expect(page.getByText("By round 2, 4 ballots were inactive; all reached an overvote.")).toBeVisible();
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("T23: Minneapolis rules skip the overvoted rank, and Ash wins", async ({ page }) => {
  await countOvervoteExample(page, "Minneapolis");
  await expect(page.getByTestId("winner-card")).toContainText("Winner: Ash");
  await expect(page.getByText("Condorcet winner: Ash. Ranked choice and the head-to-head check agree.")).toBeVisible();
});

test("plurality's pick is explained when round 1 counts overvoted ballots it can't", async ({ page }) => {
  await countOvervoteExample(page, "Minneapolis");
  await expect(page.getByText("Plurality would have picked Bea: it counts only clean first choices")).toBeVisible();
});

test("the tie example explains how the tie was broken", async ({ page }) => {
  await page.goto("/count");
  await page.getByRole("button", { name: "Load the tie example" }).click();
  await page.getByRole("button", { name: "Count", exact: true }).click();
  await expect(page.getByText(/^(Bea and Cal|Cal and Bea) tied for last with 3 ballots each in round 1\./)).toBeVisible();
  await expect(page.getByText("2 rounds", { exact: true })).toBeVisible();
});

test("a first-round tie is won on the tiebreak, never on a majority", async ({ page }) => {
  await page.goto("/count");
  await page.getByLabel("Ballots, one per line").fill("A,B\nB,A");
  await page.getByRole("button", { name: "Count", exact: true }).click();
  await expect(page.getByTestId("winner-card")).toContainText("1 round, won on a tiebreak");
  await expect(page.getByText(/tied with 1 ballot each in round 1\./)).toBeVisible();
  await expect(page.getByText(/The tiebreak elected [AB] by a draw with seed 0\./)).toBeVisible();
  await expect(page.locator("main")).not.toContainText("majority");
});

test("a count that can't run clears the last result", async ({ page }) => {
  await countOvervoteExample(page, "New York City");
  await expect(page.getByTestId("winner-card")).toContainText("Winner: Bea");
  await page.getByLabel("Ballots, one per line").fill("");
  await page.getByRole("button", { name: "Count", exact: true }).click();
  const failure = page.locator(".callout[role=alert]");
  await expect(failure).toHaveText("Paste at least one ballot.");
  await expect(page.getByTestId("winner-card")).toHaveCount(0);
  await page.getByLabel("Ballots, one per line").fill(",,,");
  await page.getByRole("button", { name: "Count", exact: true }).click();
  await expect(failure).toHaveText("Every ballot is blank, so there is nothing to count.");
});

test("the RCTab summary view shows the count in RCTab's format", async ({ page }) => {
  await countOvervoteExample(page, "New York City");
  await page.getByRole("tab", { name: "RCTab summary (JSON)" }).click();
  const json = page.getByRole("tabpanel").getByLabel("RCTab summary of this count");
  await expect(json).toContainText('"jsonFormatVersion": "1"');
  const summary = JSON.parse(await json.innerText()) as { results: Array<{ tally: Record<string, string> }> };
  expect(summary.results.at(-1)!.tally).toEqual({ Ash: "8", Bea: "10" });
});

test("bad lines are reported by line number and nothing is counted", async ({ page }) => {
  await page.goto("/count");
  await page.getByLabel("Ballots, one per line").fill("Pizza,Tacos\nPizza|,Tacos\nTacos x0");
  await page.getByRole("button", { name: "Count", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "need fixing" });
  await expect(alert).toContainText("2 lines need fixing before the count can run.");
  await expect(alert).toContainText('Line 2: rank 1 has an empty name next to "|"; put a name on both sides.');
  await expect(alert).toContainText('Line 3: the count after "x" must be from 1 to 1,000,000,000.');
  await expect(page.getByTestId("winner-card")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the count has no sideways scroll", async ({ page }) => {
    await countOvervoteExample(page, "Minneapolis");
    await expect(page.getByTestId("winner-card")).toContainText("Winner: Ash");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
