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

  test("going back keeps what was typed, by Back, the stepper or the browser", async ({ page }) => {
    await toSchedule(page);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Who votes, who sees" })).toBeVisible();
    await page.getByRole("list", { name: "New poll steps" }).getByRole("link", { name: /Options/ }).click();
    await expect(page.getByRole("heading", { name: "What are people choosing between?" })).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue("Spring offsite 2027");
    await expect(page.getByLabel("Option 2", { exact: true })).toHaveValue("Kraków");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Who votes, who sees" })).toBeVisible();
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

  test("an opening time that has already passed is refused on the Opens field", async ({ page }) => {
    await toSchedule(page);
    const opens = page.getByLabel("Opens", { exact: true });
    await opens.fill("2020-01-01 10:00");
    await expect(page.getByText("The opening time has already passed. Pick a later time, or open the poll as soon as it's created.")).toBeVisible();
    await expect(opens).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Continue to review" }).click();
    await expect(page.getByRole("heading", { name: "When can people vote?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check and create" })).toHaveCount(0);
  });

  test("a closing time before the opening time says so", async ({ page }) => {
    await toSchedule(page);
    await page.getByLabel("Opens", { exact: true }).fill("2027-03-15 03:30");
    await page.getByLabel(/^Closes/).fill("2027-03-15 02:15");
    await expect(page.getByText("The closing time must come after the opening time.")).toBeVisible();
    await page.getByLabel(/^Closes/).fill("2027-03-15 03:30");
    await expect(page.getByText("The poll must stay open for at least a minute.")).toBeVisible();
  });

  test("a time written the way the API takes it is understood too", async ({ page }) => {
    await toSchedule(page);
    await page.getByLabel("Opens", { exact: true }).fill("2027-01-15T12:00");
    const card = page.getByRole("region", { name: "What voters see before it opens" });
    await expect(card).toContainText("Opens January 15, 2027, 12:00 PM (America/New_York).");
    await page.getByRole("button", { name: "Continue to review" }).click();
    await expect(page.getByRole("heading", { name: "Check and create" })).toBeVisible();
  });

  test("the time zones are listed once each, by their IANA names", async ({ page }) => {
    await toSchedule(page);
    const zones = page.getByLabel("Time zone");
    await expect(zones.locator('option[value="Asia/Kolkata"]')).toHaveCount(1);
    await expect(zones.locator('option[value="Europe/Kyiv"]')).toHaveCount(1);
    await expect(zones.locator('option[value="Asia/Calcutta"]')).toHaveCount(0);
    await expect(zones.locator('option[value="Europe/Kiev"]')).toHaveCount(0);
  });

  test("pasting a list fills one option per line and leaves no empty rows under it", async ({ page }) => {
    await page.goto("/new");
    await page.getByLabel("Option 1", { exact: true }).focus();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData("text/plain", "- Lisbon\n- Kraków\n- Tallinn\n- Valencia\n");
      document.activeElement!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole("textbox", { name: /^Option \d+$/ })).toHaveCount(4);
    await expect(page.getByLabel("Option 4", { exact: true })).toHaveValue("Valencia");
  });

  test("a reload keeps the draft, and creating the poll lets it go", async ({ page }) => {
    await toSchedule(page);
    await page.getByLabel("Opens", { exact: true }).fill("2027-01-15 12:00");
    await page.reload();
    await expect(page.getByRole("heading", { name: "When can people vote?" })).toBeVisible();
    await expect(page.getByLabel("Opens", { exact: true })).toHaveValue("2027-01-15 12:00");
    await expect(page.getByLabel("Time zone")).toHaveValue("America/New_York");
    await page.getByRole("button", { name: "Continue to review" }).click();
    await expect(page.getByRole("heading", { name: "Check and create" })).toBeVisible();
    await page.getByRole("button", { name: "Create poll" }).click();
    await expect(page).toHaveURL(/\/dashboard\/p\/[^/?]+\?created=1$/);
    await page.goto("/new");
    await expect(page.getByLabel("Title")).toHaveValue("");
  });

  test("creating the poll opens its manage page", async ({ page }) => {
    const slug = await createPollWithWizard(page, { title: "Lunch on Friday", options: ["Pizza", "Tacos", "Sushi"] });
    await expect(page.getByText("Share the link below with your voters.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Lunch on Friday" })).toBeVisible();
    await expect(page.getByLabel("Voter link")).toHaveValue(new RegExp(`/p/${slug}$`));
    await page.goto("/dashboard");
    await expect(page.getByText("Showing 1–1 of 1 poll")).toBeVisible();
  });

  test.describe("in India", () => {
    test.use({ timezoneId: "Asia/Kolkata" });

    test("the browser's zone is offered under its IANA name", async ({ page }) => {
      await page.goto("/new");
      await page.getByLabel("Title").fill("Diwali lunch");
      await page.getByLabel("Option 1", { exact: true }).fill("Thali");
      await page.getByLabel("Option 2", { exact: true }).fill("Dosa");
      for (const heading of ["Method and seats", "Counting rules", "Who votes, who sees", "When can people vote?"]) {
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      }
      await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Kolkata");
    });
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("each step's heading comes into view below the header, with nothing half hidden behind it", async ({ page }) => {
      await page.goto("/new");
      await page.getByLabel("Title").fill("Spring offsite 2027");
      await page.getByLabel("Option 1", { exact: true }).fill("Lisbon");
      await page.getByLabel("Option 2", { exact: true }).fill("Kraków");
      for (const heading of ["Method and seats", "Counting rules", "Who votes, who sees", "When can people vote?"]) {
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page.getByRole("heading", { name: heading })).toBeFocused();
        const { header, step, cut } = await page.evaluate(() => {
          const header = document.querySelector(".site-header")!.getBoundingClientRect().bottom;
          const current = '[aria-label="New poll steps"] [aria-current="step"]';
          // The page title and this step's dot and label: each wholly behind the header or wholly below it.
          const below = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top >= header;
          const cut = ["h1", `${current} .stepper-dot`, `${current} .stepper-label`].filter((selector) => {
            const { top, bottom } = document.querySelector(selector)!.getBoundingClientRect();
            return top < header && bottom > header;
          });
          if (below(`${current} .stepper-label`) && !below(`${current} .stepper-dot`)) cut.push("label without its dot");
          return { header, step: document.getElementById("step-title")!.getBoundingClientRect().top, cut };
        });
        expect(step).toBeGreaterThanOrEqual(header);
        expect(cut).toEqual([]);
      }
    });
  });
});
