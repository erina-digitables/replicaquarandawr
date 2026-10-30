// Every screen, at 1440 (desktop project) and 390 (mobile project): axe WCAG 2.2 AA,
// no sideways scroll, exactly one h1, and every input has an accessible name.
import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, expectNoHorizontalScroll, startDemo, test } from "./fixtures";

async function checkScreen(page: Page, path: string) {
  await page.goto(path);
  await expectNoA11yViolations(page);
  await expectNoHorizontalScroll(page);
  await expect(page.locator("h1"), `${path}: one h1`).toHaveCount(1);
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("input:not([type=hidden]), select, textarea, button")]
      .filter((el) => !(el as HTMLElement).innerText?.trim() && !el.getAttribute("aria-label") && !(el as HTMLInputElement).labels?.length && !el.getAttribute("aria-labelledby"))
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(unnamed, `${path}: controls without a name`).toEqual([]);
}

test.describe("Accessibility and layout sweep", () => {
  for (const path of ["/signin", "/signup", "/forgot", "/forgot/code", "/privacy"]) {
    test(`signed out ${path}`, async ({ page }) => checkScreen(page, path));
  }

  test("signed in: every screen with sample data, light and dark", async ({ page }) => {
    test.setTimeout(180_000);
    await startDemo(page);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ["/today", "/plan", "/stats", "/history", "/settings", "/settings?tab=account", "/settings?tab=tips"]) {
        await test.step(`${scheme} ${path}`, () => checkScreen(page, path));
      }
    }
  });

  test("the loading skeleton has no axe violations", async ({ page }) => {
    await startDemo(page);
    // Hold the next page's data so the skeleton stays on screen.
    await page.route(/\/history/, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.getByRole("link", { name: "History" }).first().click();
    await expect(page.getByRole("status", { name: "Loading" })).toBeVisible();
    // Mid-navigation Next has removed the old <title> and not streamed the new one yet.
    await expectNoA11yViolations(page, ["document-title"]);
    await page.unroute(/\/history/);
  });

  test("the 404 page", async ({ browser }) => {
    // Own page without the console guard: Chrome always logs the 404 itself.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const r = await page.goto("/no-such-page");
    expect(r?.status()).toBe(404);
    await expectNoA11yViolations(page);
    await ctx.close();
  });
});
