import { devDb, expect, expectNoA11yViolations, rate, signIn, signUp, test, userRow } from "./fixtures";

test.describe("F07 change the default daily target", () => {
  test("F07-H1 preset from the header gear saves instantly and drives today", async ({ page }) => {
    const a = await signUp(page);
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expectNoA11yViolations(page);
    await page.getByRole("radio", { name: /^8 qtrs/ }).click();
    await expect(page.getByText("Saved. New days use this goal.")).toBeVisible();
    expect((await userRow(a.username)).dailyTarget).toBe(8);
    await page.goto("/today");
    await expect(page.getByRole("radiogroup")).toHaveCount(8);
  });

  test("F07-E1 stepper by keyboard stays within 1-240", async ({ page }) => {
    await signUp(page);
    await page.goto("/settings");
    const spin = page.getByRole("spinbutton", { name: "Daily target" });
    await spin.focus();
    await page.keyboard.press("Home");
    await expect(spin).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByRole("button", { name: "Fewer quarters" })).toBeDisabled();
    await page.keyboard.press("End");
    await expect(spin).toHaveAttribute("aria-valuenow", "240");
    await page.keyboard.press("PageDown");
    await expect(spin).toHaveAttribute("aria-valuenow", "232");
    await expect(page.getByText("Saved. New days use this goal.")).toBeVisible();
  });

  test("F07-E2 a day already started keeps its goal when the goal changes", async ({ page }) => {
    const a = await signUp(page);
    await rate(page, 1, 1, "Good");
    await page.goto("/settings");
    await page.getByRole("radio", { name: /^2 qtrs/ }).click();
    await expect(page.getByText("Saved. New days use this goal.")).toBeVisible();
    await page.goto("/today");
    await expect(page.getByText(/1\s*of 4 quarters read/)).toBeVisible();
    const { id } = await userRow(a.username);
    expect((await devDb()).logs.find((l) => l.userId === id)!.target).toBe(4);
  });
});

test.describe("F09 toggle theme", () => {
  test("F09-H1 header toggle switches and is remembered after reload", async ({ page }) => {
    await signUp(page);
    const saved = page.waitForResponse((r) => r.request().method() === "POST");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await saved;
    await expectNoA11yViolations(page);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  });

  test("F09-H2 Match device follows the OS", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await signUp(page);
    await page.goto("/settings?tab=account");
    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("radio", { name: "Match device" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  });

  test("F09-E1 the toggle works on signed-out screens", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("button", { name: /Switch to (dark|light) theme/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", /dark|light/);
  });
});

test.describe("S08 account", () => {
  test("S08-H1 rename and change username; sign in with the new one", async ({ page }) => {
    const a = await signUp(page);
    await page.goto("/settings?tab=account");
    await page.getByLabel("Username").fill(`${a.username}_2`);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.context().clearCookies();
    await signIn(page, `${a.username}_2`, a.password);
    await expect(page).toHaveURL(/\/today/);
  });

  test("S08-N1 change password needs the current one", async ({ page }) => {
    const a = await signUp(page);
    await page.goto("/settings?tab=account");
    await page.getByLabel("Current password", { exact: true }).fill("wrong-password");
    await page.getByLabel("New password", { exact: true }).fill("brand-new-password");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("That isn't your current password.")).toBeVisible();
    await page.getByLabel("Current password", { exact: true }).fill(a.password);
    await page.getByLabel("New password", { exact: true }).fill("brand-new-password");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await page.context().clearCookies();
    await signIn(page, a.username, "brand-new-password");
    await expect(page).toHaveURL(/\/today/);
  });

  test("S08-E1 no password is shown anywhere on the account page", async ({ page }) => {
    const a = await signUp(page);
    await page.goto("/settings?tab=account");
    await expect(page.getByText(a.password)).toHaveCount(0);
    expect(await page.content()).not.toContain(a.password);
  });
});
