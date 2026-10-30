import * as fs from "node:fs";
import { join } from "node:path";
import { devDb, expect, expectNoA11yViolations, expectNoHorizontalScroll, ipFor, newAccount, quarterGroup, rate, signUp, test, todayIn, userRow } from "./fixtures";

const progress = (page: import("@playwright/test").Page) => page.getByRole("progressbar", { name: "Today's progress" });

test.describe("F03 log today's revision (core loop)", () => {
  test("F03-H1 rate all four quarters: progress fills, goal met, kept after reload", async ({ page }) => {
    await signUp(page);
    await expectNoHorizontalScroll(page);
    await rate(page, 1, 1, "Good");
    await expect(progress(page)).toHaveAttribute("aria-valuenow", "1");
    await rate(page, 1, 2, "Okay");
    await rate(page, 1, 3, "Weak");
    await rate(page, 1, 4, "Good");
    await expect(progress(page)).toHaveAttribute("aria-valuenow", "4");
    await expect(page.getByRole("status").filter({ hasText: "Goal met" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.reload();
    await expect(progress(page)).toHaveAttribute("aria-valuenow", "4");
    await expect(quarterGroup(page, 1, 3).getByRole("radio", { name: "Weak" })).toHaveAttribute("aria-checked", "true");
    // The header streak counts today once the goal is met.
    await expect(page.getByRole("banner").getByText("Streak: 1 day")).toBeVisible();
  });

  test("F03-E1 change a rating, then clear it", async ({ page }) => {
    const a = await signUp(page);
    await rate(page, 1, 1, "Good");
    await rate(page, 1, 1, "Weak");
    await page.reload();
    await expect(quarterGroup(page, 1, 1).getByRole("radio", { name: "Weak" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Clear rating" }).click();
    await expect(progress(page)).toHaveAttribute("aria-valuenow", "0");
    await expect(async () => {
      const u = userRow(a.username);
      const log = devDb().logs.find((l) => l.userId === u.id);
      expect(log?.quarters.filter((q) => q.quality) ?? []).toHaveLength(0);
    }).toPass();
  });

  test("F03-E2 keyboard only: arrow keys move and save the rating", async ({ page }) => {
    await signUp(page);
    const group = quarterGroup(page, 1, 1);
    await group.getByRole("radio", { name: "Good" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Okay" })).toHaveAttribute("aria-checked", "true");
    await expect(group.getByRole("radio", { name: "Okay" })).toBeFocused();
    // Focus stays put through the save, so the next arrow key keeps working.
    await expect(group).not.toHaveAttribute("aria-busy", "true");
    await expect(group.getByRole("radio", { name: "Okay" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Weak" })).toHaveAttribute("aria-checked", "true");
    await expect(group).not.toHaveAttribute("aria-busy", "true");
    await page.reload();
    await expect(group.getByRole("radio", { name: "Weak" })).toHaveAttribute("aria-checked", "true");
  });

  test("F03-E3 double-clicking a rating saves one row", async ({ page }) => {
    const a = await signUp(page);
    await quarterGroup(page, 1, 2).getByRole("radio", { name: "Good" }).dblclick();
    await expect(progress(page)).toHaveAttribute("aria-valuenow", "1");
    await expect(async () => {
      const log = devDb().logs.find((l) => l.userId === userRow(a.username).id)!;
      expect(log.quarters.filter((q) => q.rub === 2)).toHaveLength(1);
    }).toPass();
  });

  test("F03-E4 two tabs rating different quarters both stick", async ({ page, context }) => {
    await signUp(page);
    const tab2 = await context.newPage();
    await tab2.goto("/today");
    await Promise.all([rate(page, 1, 1, "Good"), rate(tab2, 1, 2, "Okay")]);
    await page.reload();
    await expect(progress(page)).toHaveAttribute("aria-valuenow", "2");
  });

  test("F03-E5 a future date in the URL shows today instead", async ({ page }) => {
    await signUp(page);
    await page.goto("/today?date=2099-01-01");
    await expect(page.getByRole("main").getByText("Today", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
  });

  test("F03-E6 a malformed date in the URL falls back to today, nothing is written", async ({ page }) => {
    const a = await signUp(page);
    for (const bad of ["not-a-date", "2026-02-30", "2026-13-01", "'; drop table--"]) {
      await page.goto(`/today?date=${encodeURIComponent(bad)}`);
      await expect(page.getByRole("main").getByText("Today", { exact: true }), bad).toBeVisible();
    }
    expect(devDb().logs.filter((l) => l.userId === userRow(a.username).id)).toHaveLength(0);
  });

  test("F03-E7 beyond the goal: a fifth rated quarter counts and says so", async ({ page }) => {
    await signUp(page);
    await page.goto("/plan");
    await page.getByRole("button", { name: /Next 4 in order/ }).click();
    await page.getByRole("button", { name: /Juz 1 ·/ }).getByText("4 of 8 picked").waitFor();
    await page.getByRole("checkbox", { name: "Quarter 5" }).check();
    await page.getByRole("button", { name: "Start reading" }).click();
    await expect(page).toHaveURL(/\/today/);
    for (const q of [1, 2, 3, 4, 5]) await rate(page, 1, q, "Good");
    await expect(page.getByText(/5\s*of 4 quarters read/)).toBeVisible();
    await expect(page.getByText("beyond today's goal")).toBeVisible();
  });

  test("F03-E8 slow network: the card shows it is saving until the server answers", async ({ page }) => {
    await signUp(page);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/today**", async (route) => {
      if (route.request().method() === "POST") await held;
      await route.continue();
    });
    const good = quarterGroup(page, 1, 1).getByRole("radio", { name: "Good" });
    await good.click();
    await expect(good).toHaveAttribute("aria-checked", "true");
    await expect(quarterGroup(page, 1, 1), "card says it is saving").toHaveAttribute("aria-busy", "true");
    await expect(good, "still operable while saving").toBeEnabled();
    release();
    await expect(quarterGroup(page, 1, 1)).not.toHaveAttribute("aria-busy", "true");
    await page.unroute("**/today**");
    await page.reload();
    await expect(good).toHaveAttribute("aria-checked", "true");
  });

  test("F03-N2 offline: a failed save says so, and tapping again saves it", async ({ page }) => {
    await signUp(page);
    await page.route("**/today**", (route) => (route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()));
    page.removeAllListeners("console"); // the aborted request logs a network error by design
    const good = quarterGroup(page, 1, 1).getByRole("radio", { name: "Good" });
    await good.click();
    await expect(page.getByText("Couldn't save. Tap a rating to try again.")).toBeVisible();
    await expect(page.getByText(/Check your connection/)).toBeVisible();
    await page.unroute("**/today**");
    await good.click();
    await expect(page.getByText("Couldn't save. Tap a rating to try again.")).toHaveCount(0);
    await page.reload();
    await expect(good).toHaveAttribute("aria-checked", "true");
  });

  test("F03-E9 dev backend: saves survive another program reading the data file @crowd", async ({ page }) => {
    await signUp(page);
    // Windows refuses to replace a file another process has open (antivirus, editors, this test).
    const file = join(__dirname, "..", ".data-e2e", "dev-db.json");
    let stop = false;
    const reader = (async () => {
      while (!stop) {
        try {
          const fd = fs.openSync(file, "r");
          await new Promise((r) => setTimeout(r, 15));
          fs.closeSync(fd);
        } catch {}
        await new Promise((r) => setTimeout(r, 1));
      }
    })();
    for (const q of [1, 2, 3, 4]) await rate(page, 1, q, "Good");
    stop = true;
    await reader;
    await page.reload();
    await expect(progress(page)).toHaveAttribute("aria-valuenow", "4");
  });

  test("F03-N1 a second user sees none of the first user's ratings", async ({ page, browser }) => {
    await signUp(page);
    await rate(page, 1, 1, "Good");
    await rate(page, 1, 2, "Good");
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipFor("second-user") }, timezoneId: "Asia/Karachi" });
    const p2 = await ctx.newPage();
    await signUp(p2, newAccount("other"));
    await expect(p2.getByRole("progressbar", { name: "Today's progress" })).toHaveAttribute("aria-valuenow", "0");
    await p2.goto("/history");
    await expect(p2.getByText("No days logged yet")).toBeVisible();
    await p2.goto(`/today?date=${todayIn()}`);
    await expect(p2.getByRole("radio", { checked: true })).toHaveCount(0);
    await ctx.close();
  });
});
