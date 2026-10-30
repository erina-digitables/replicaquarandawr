import { expect, expectNoA11yViolations, rate, signUp, startDemo, test } from "./fixtures";

test.describe("F05 review or edit a past day", () => {
  test("F05-H1 previous/next day arrows; next is disabled on today", async ({ page }) => {
    await signUp(page);
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
    await page.getByRole("link", { name: "Previous day" }).click();
    await expect(page.getByText("Yesterday")).toBeVisible();
    await page.getByRole("link", { name: "Next day" }).click();
    await expect(page.getByRole("main").getByText("Today", { exact: true })).toBeVisible();
  });

  test("F05-H2 a chart bar on Progress opens that day", async ({ page }) => {
    await startDemo(page);
    await page.getByRole("link", { name: "Progress" }).click();
    await expect(page).toHaveURL(/\/stats/);
    await expectNoA11yViolations(page);
    const bars = page.getByRole("button", { name: /: \d+ quarters/ });
    await expect(bars).toHaveCount(7);
    await bars.first().click();
    await expect(page).toHaveURL(/\/today\?date=\d{4}-\d{2}-\d{2}/);
  });

  test("F05-H3 the demo's stats add up", async ({ page }) => {
    await startDemo(page);
    await page.goto("/history");
    // demoDays pattern 4,4,5,0,4,3,4,4,6,4,2,4,4: 12 logged days, 48 quarters, 10 with the goal met.
    const stat = (k: string) => page.locator("dl > div").filter({ has: page.getByText(k, { exact: true }) }).locator("dd");
    await expect(stat("Days")).toHaveText("12");
    await expect(stat("Quarters")).toHaveText("48");
    await expect(stat("Goal met")).toHaveText("10");
    await expect(page.getByRole("banner").getByText(/Streak: 2 days/)).toBeVisible();
    await expect(page.getByText("Sample account")).toBeVisible();
  });
});

test.describe("F06 browse history", () => {
  test("F06-H1 filter Goal met / Short, then open a day", async ({ page }) => {
    await startDemo(page);
    await page.goto("/history");
    await expectNoA11yViolations(page);
    const rows = page.getByRole("main").getByRole("listitem");
    await expect(rows).toHaveCount(12);
    await page.getByRole("tab", { name: "Goal met" }).click();
    await expect(rows).toHaveCount(10);
    await page.getByRole("tab", { name: "Short" }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByText("Short of goal").first()).toBeVisible();
    await rows.first().getByRole("link").click();
    await expect(page).toHaveURL(/\/today\?date=/);
  });

  test("F06-E1 search by juz, by ISO date, and with no match", async ({ page }) => {
    await startDemo(page);
    await page.goto("/history");
    const search = page.getByRole("searchbox", { name: "Search by date or juz" });
    await search.fill("juz 1");
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(2);
    await search.fill("1999-01-01");
    await expect(page.getByText("No days match")).toBeVisible();
  });

  test("F06-H2 delete a day, undo brings it back with its ratings", async ({ page }) => {
    await signUp(page);
    await rate(page, 1, 1, "Good");
    await rate(page, 1, 2, "Weak");
    await page.goto("/history");
    await page.getByRole("button", { name: /^Delete log for/ }).click();
    await expect(page.getByText("No days logged yet")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("link", { name: /2\/4/ })).toBeVisible();
    await page.reload();
    await expect(page.getByText("1 weak")).toBeVisible();
  });

  test("F06-E2 a deleted day stays deleted after the toast goes", async ({ page }) => {
    await signUp(page);
    await rate(page, 1, 1, "Good");
    await page.goto("/history");
    await page.getByRole("button", { name: /^Delete log for/ }).click();
    await expect(page.getByText(/Deleted the log for/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("No days logged yet")).toBeVisible();
  });
});
