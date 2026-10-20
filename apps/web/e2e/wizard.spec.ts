import { test, type Page } from "@playwright/test";
import { collectErrors, createPollWithWizard, signUp, expect } from "./helpers";

// Journeys sign up, create polls and cast ballots against one dev server; give them room.
test.describe.configure({ timeout: 90_000 });

async function toSchedule(page: Page) {
  await page.goto("/new");
  await page.getByLabel("Title").fill("Spring offsite 2027");
  await page.getByLabel("Option 1", { exact: true }).fill("Lisbon");
  await page.getByLabel("Option 2", { exact: true }).fill("Kraków");
  await page.getByLabel("Option 3", { exact: true }).fill("Tallinn");
  for (const heading of ["Method and seats", "Counting rules", "Who votes, who sees", "When can people vote?"]) {
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.getByLabel("Time zone").selectOption("America/New_York");
  await page.getByText("At a set time").click();
}

test.describe("new poll wizard", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test("T13: a time skipped by the clocks springing forward is explained", async ({ page }) => {
    await toSchedule(page);
    await page.getByLabel("Opens", { exact: true }).fill("2027-03-14 02:30");
    const gap = "2:30 AM doesn't exist on March 14, 2027 in America/New_York (clocks jump forward). We'll open the poll at 3:30 AM.";
    await expect(page.getByText(gap)).toBeVisible();
    await page.getByRole("button", { name: "Continue to review" }).click();
    await expect(page.getByRole("heading", { name: "Check and create" })).toBeVisible();
    await expect(page.getByText(gap)).toBeVisible();
    await expect(page.getByText("March 14, 2027, 3:30 AM (America/New_York)").first()).toBeVisible();
  });

  test("a time that happens twice when clocks fall back is explained", async ({ page }) => {
    await toSchedule(page);
    await page.getByLabel("Opens", { exact: true }).fill("2027-11-07 01:30");
    await expect(page.getByText("1:30 AM happens twice on November 7, 2027 in America/New_York. We'll use the first one (EDT).")).toBeVisible();
  });

  test("each step stops on what's missing, in words", async ({ page }) => {
    await page.goto("/new");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Give the poll a title of at least 3 characters.")).toBeVisible();
    await expect(page.getByText("Add at least two options.")).toBeVisible();
    await page.getByLabel("Title").fill("Team lunch");
    await page.getByLabel("Option 1", { exact: true }).fill("Pizza");
    await page.getByLabel("Option 2", { exact: true }).fill("pizza");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Two options are both called “pizza”. Give each one its own name.")).toBeVisible();
  });

  test("the rules step offers four presets, each in one sentence, and keeps them to the seats", async ({ page }) => {
    await page.goto("/new");
    await page.getByLabel("Title").fill("Committee");
    for (const [i, name] of ["Ana", "Ben", "Cleo", "Dev"].entries()) {
      if (i === 3) await page.getByRole("button", { name: "Add option" }).click();
      await page.getByLabel(`Option ${i + 1}`, { exact: true }).fill(name);
    }
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Several winners").click();
    await page.getByLabel("Seats to fill").fill("2");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Counting rules" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(4);
    await expect(page.getByRole("radio", { name: "New York City" })).toBeDisabled();
    await expect(page.getByRole("radio", { name: "Portland" })).toBeEnabled();
    await page.getByRole("radio", { name: "Portland" }).check();
    await expect(page.getByLabel("How many can each voter rank?")).toHaveValue("");
  });

  test("the side card shows what voters will see, live", async ({ page }) => {
    const errors = collectErrors(page);
    await toSchedule(page);
    const card = page.getByRole("region", { name: "What voters see before it opens" });
    await page.getByLabel("Opens", { exact: true }).fill("2027-01-15 12:00");
    await expect(card).toContainText("Voting hasn't started yet.");
    await expect(card).toContainText("Opens January 15, 2027, 12:00 PM (America/New_York).");
    await expect(card).toContainText("Kraków");
    expect(errors).toEqual([]);
  });

  test("creating the poll opens its manage page", async ({ page }) => {
    const slug = await createPollWithWizard(page, { title: "Lunch on Friday", options: ["Pizza", "Tacos", "Sushi"] });
    await expect(page.getByText("Share the link below with your voters.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Lunch on Friday" })).toBeVisible();
    await expect(page.getByLabel("Voter link")).toHaveValue(new RegExp(`/p/${slug}$`));
    await page.goto("/dashboard");
    await expect(page.getByText("Showing 1–1 of 1 poll")).toBeVisible();
  });
});
