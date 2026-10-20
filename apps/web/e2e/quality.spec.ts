import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const MUTANTS = readdirSync(join(__dirname, "..", "..", "..", "mutants"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

test("the quality page prints the engine's figures (T24)", async ({ page }) => {
  const response = await page.goto("/quality");
  expect(response?.status()).toBe(200);
  const main = page.locator("main");
  await expect(main).toContainText("38 of 38 RCTab rules fixtures");
  await expect(main).toContainText("6 elections match the official count exactly");
  await expect(page.getByRole("list", { name: "Merge gate" })).toContainText("38 of 38 RCTab rules fixtures");
});

test("the gate history shows GitHub's results or says there are none", async ({ page }) => {
  await page.goto("/quality");
  const empty = page.getByRole("heading", { name: "No gated pull requests yet." });
  const table = page.getByRole("table", { name: "Merge gates on recent pull requests" });
  await expect(empty.or(table)).toBeVisible();
});

test("the kill table lists every mutant in the catalog, with the ones that got through", async ({ page }) => {
  await page.goto("/quality");
  const kill = page.getByRole("table", { name: "Saboteur kill table" });
  for (const id of MUTANTS) await expect(kill.getByRole("rowheader", { name: id })).toBeVisible();
  await expect(kill.getByRole("row", { name: /m06-cvr-row-order/ })).toContainText("Survived");
  await expect(kill.getByRole("row", { name: /m09-tie-by-list-order/ })).toContainText("Survived");
  await expect(kill.getByRole("columnheader", { name: "Last verdict" })).toBeVisible();
});
