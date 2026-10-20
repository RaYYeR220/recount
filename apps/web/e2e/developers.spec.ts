import { expect, test } from "@playwright/test";

type OpenApi = { servers: Array<{ url: string }>; paths: Record<string, Record<string, unknown>> };

test("the developers page lists every path in the OpenAPI document", async ({ page, request }) => {
  const doc = (await (await request.get("/api/v1/openapi.json")).json()) as OpenApi;
  const base = doc.servers[0]!.url;
  const paths = Object.keys(doc.paths);
  expect(paths.length).toBeGreaterThan(0);

  const response = await page.goto("/developers");
  expect(response?.status()).toBe(200);
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of Object.keys(item)) {
      const heading = page.getByRole("heading", { level: 3, name: `${method.toUpperCase()} ${base}${path}`, exact: true });
      await expect(heading).toBeVisible();
    }
  }
});

test("the curl examples call this site", async ({ page, baseURL }) => {
  await page.goto("/developers");
  const tabulate = page.locator("#op-tabulate");
  await expect(tabulate.getByLabel("Example: POST /api/v1/tabulate")).toContainText(`curl -X POST "${baseURL}/api/v1/tabulate"`);
  await expect(tabulate).toContainText('"winners": ["Tacos"]');
});

test("tokens and the engine are explained", async ({ page }) => {
  await page.goto("/developers");
  await expect(page.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  await expect(page.locator("#tokens")).toContainText("rk_");
  await expect(page.locator("#engine")).toContainText('result.winners;        // ["Tacos"]');
});
