import { expect, expectNoA11yViolations, expectNoHorizontalScroll, quarterGroup, rate, signUp, test } from "./fixtures";

test.describe("F04 plan a custom day", () => {
  test("F04-H1 pick two quarters in juz 30, start reading: checklist shows only those", async ({ page }) => {
    await signUp(page);
    await page.getByRole("link", { name: "Plan the day" }).click();
    await expect(page).toHaveURL(/\/plan/);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: /^30 Juz 30 ·/ }).click();
    const juz30 = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("button", { name: /Juz 30 ·/ }) });
    await juz30.getByRole("checkbox", { name: "Quarter 7" }).check();
    await juz30.getByRole("checkbox", { name: "Quarter 8" }).check();
    await expect(page.getByText("2 quarters picked")).toBeVisible();
    await expect(page.getByText("2 short of your goal")).toBeVisible();
    await page.getByRole("button", { name: "Start reading" }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByText("Showing your plan only.")).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(2);
    await expect(quarterGroup(page, 30, 7)).toBeVisible();
    await rate(page, 30, 8, "Good");
    await page.reload();
    await expect(page.getByRole("radiogroup")).toHaveCount(2);
  });

  test("F04-E1 Start reading is disabled with nothing picked", async ({ page }) => {
    await signUp(page);
    await page.goto("/plan");
    await expect(page.getByText("Nothing picked yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start reading" })).toBeDisabled();
  });

  test("F04-E2 juz search by number and by name, and an empty result", async ({ page }) => {
    await signUp(page);
    await page.goto("/plan");
    const search = page.getByRole("searchbox", { name: "Find a juz by number or name" });
    await search.fill("12");
    await expect(page.getByRole("button", { name: /Juz \d+ ·/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Juz 12 ·/ })).toBeVisible();
    await search.fill("juz 3");
    await expect(page.getByRole("button", { name: /Juz \d+ ·/ })).toHaveCount(1);
    await search.fill("rusul");
    await expect(page.getByRole("button", { name: /Juz 3 ·/ })).toBeVisible();
    await search.fill("zzzz");
    await expect(page.getByText("No juz matches that")).toBeVisible();
  });

  test("F04-E3 picking more than the goal says how many over", async ({ page }) => {
    await signUp(page);
    await page.goto("/plan");
    await page.getByRole("button", { name: "Next 4 in order" }).click();
    await page.getByRole("checkbox", { name: "Quarter 6" }).check();
    await expect(page.getByText("1 more than your goal")).toBeVisible();
  });

  test("F04-E4 change the plan after locking, then go back to suggestions", async ({ page }) => {
    await signUp(page);
    await page.goto("/plan");
    await page.getByRole("button", { name: "Next 4 in order" }).click();
    await page.getByRole("button", { name: "Start reading" }).click();
    await expect(page.getByText("Showing your plan only.")).toBeVisible();
    await page.getByRole("link", { name: "Edit plan" }).click();
    await page.getByRole("button", { name: "Clear selection" }).click();
    await page.getByRole("button", { name: "Use suggestions" }).click();
    await page.goto("/today");
    await expect(page.getByText("Showing your plan only.")).toHaveCount(0);
    await expect(page.getByRole("radiogroup")).toHaveCount(4);
  });

  test("F04-E5 goal presets on the plan screen change the goal", async ({ page }) => {
    await signUp(page);
    await page.goto("/plan");
    await page.getByRole("radio", { name: /^8 qtrs/ }).click();
    await expect(page.getByRole("spinbutton", { name: "Daily target" })).toHaveAttribute("aria-valuenow", "8");
    await expect(page.getByRole("button", { name: "Next 8 in order" })).toBeVisible();
    // Nothing rated today yet, so today's goal follows.
    await page.goto("/today");
    await expect(page.getByText(/0\s*of 8 quarters read/)).toBeVisible();
  });

  test("F04-E6 plan a past day from the empty state ('Log this day')", async ({ page }) => {
    await signUp(page);
    await page.getByRole("link", { name: "Previous day" }).click();
    await expect(page.getByText("Nothing logged on this day")).toBeVisible();
    await page.getByRole("link", { name: "Log this day" }).click();
    await page.getByRole("button", { name: "Next 4 in order" }).click();
    await page.getByRole("button", { name: "Start reading" }).click();
    await expect(page.getByText("Yesterday")).toBeVisible();
    await rate(page, 1, 1, "Good");
    await page.goto("/history");
    await expect(page.getByRole("link", { name: /1\/4/ })).toBeVisible();
  });
});
