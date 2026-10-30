import type { Page } from "@playwright/test";
import { devDb, expect, expectNoA11yViolations, rate, signIn, signUp, test, userRow } from "./fixtures";

async function requestCode(page: Page, identifier: string) {
  await page.goto("/signin");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot$/);
  await page.getByLabel("Username or email").fill(identifier);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page).toHaveURL(/\/forgot\/code/);
}

function codeFor(username: string) {
  const u = userRow(username);
  return devDb().resets.find((r) => r.userId === u.id)?.code;
}

test.describe("F08 reset password", () => {
  test("F08-H1 code by username: wrong code refused, right code works, old password stops working", async ({ page }) => {
    const a = await signUp(page);
    await page.context().clearCookies();
    await requestCode(page, a.username);
    await expectNoA11yViolations(page);
    // The identifier is kept out of the URL.
    expect(page.url()).not.toContain(a.username);
    await expect(page.getByLabel("Username or email")).toHaveCount(0);
    const code = codeFor(a.username)!;
    expect(code).toMatch(/^\d{6}$/);

    const wrong = code === "000000" ? "111111" : "000000";
    await page.getByLabel("Code").fill(wrong);
    await page.getByLabel("New password", { exact: true }).fill("a-new-password-1");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(/wrong or has expired/);

    await page.getByLabel("Code").fill(`${code.slice(0, 3)} ${code.slice(3)}`);
    await page.getByLabel("New password", { exact: true }).fill("a-new-password-1");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("heading", { name: "Password changed. Sign in with your new password." })).toBeVisible();

    await signIn(page, a.username, a.password);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That username or password isn't right.");
    await signIn(page, a.email, "a-new-password-1");
    await expect(page).toHaveURL(/\/today/);
  });

  test("F08-H2 reset signs out the account's other sessions", async ({ page, browser }) => {
    const a = await signUp(page);
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await requestCode(p2, a.email);
    await p2.getByLabel("Code").fill(codeFor(a.username)!);
    await p2.getByLabel("New password", { exact: true }).fill("another-new-pass");
    await p2.getByRole("button", { name: "Set new password" }).click();
    await expect(p2.getByText(/Password changed/)).toBeVisible();
    await page.goto("/today");
    await expect(page).toHaveURL(/\/signin/);
    await ctx.close();
  });

  test("F08-N1 an unknown account looks the same as a real one (no account probing)", async ({ page }) => {
    await requestCode(page, "nobody_by_this_name");
    await expect(page.getByText(/If an account matches, a code is on its way/)).toBeVisible();
    await page.getByLabel("Code").fill("123456");
    await page.getByLabel("New password", { exact: true }).fill("whatever-password");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(/wrong or has expired/);
  });

  test("F08-N2 a 5-digit code and a short password are caught before checking", async ({ page }) => {
    const a = await signUp(page);
    await page.context().clearCookies();
    await requestCode(page, a.username);
    await page.getByLabel("Code").fill("12345");
    await page.getByLabel("New password", { exact: true }).fill("long-enough-pw");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByText("The code is 6 digits.")).toBeVisible();
    await page.getByLabel("Code").fill("123456");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  });

  test("F08-N3 guessing is capped: after 5 wrong codes even the right one fails", async ({ page }) => {
    const a = await signUp(page);
    await page.context().clearCookies();
    await requestCode(page, a.username);
    const code = codeFor(a.username)!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Code").fill(wrong);
      await page.getByLabel("New password", { exact: true }).fill("a-new-password-1");
      // Wait for each answer: React resets the form when it lands.
      const answered = page.waitForResponse((r) => r.request().method() === "POST");
      await page.getByRole("button", { name: "Set new password" }).click();
      await answered;
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    }
    await page.getByLabel("Code").fill(code);
    await page.getByLabel("New password", { exact: true }).fill("a-new-password-1");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByText(/Password changed/)).toHaveCount(0);
  });

  test("F08-E1 'I already have a code' asks who the code is for", async ({ page }) => {
    await page.goto("/forgot");
    await page.getByRole("link", { name: "I already have a code" }).click();
    await expect(page.getByLabel("Username or email")).toBeVisible();
  });
});

test.describe("F11 reset all logs / delete account", () => {
  test("F11-H1 delete all logs needs RESET typed exactly", async ({ page }) => {
    const a = await signUp(page);
    await rate(page, 1, 1, "Good");
    await page.goto("/settings?tab=account");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Delete all logs" }) });
    await form.getByLabel("Type RESET to confirm").fill("reset");
    await form.getByRole("button", { name: "Delete all logs" }).click();
    await expect(page.getByText("Type RESET in capitals to confirm.")).toBeVisible();
    expect(devDb().logs.filter((l) => l.userId === userRow(a.username).id)).toHaveLength(1);
    await form.getByLabel("Type RESET to confirm").fill("RESET");
    await form.getByRole("button", { name: "Delete all logs" }).click();
    await expect(page.getByText("All revision logs deleted")).toBeVisible();
    await page.goto("/history");
    await expect(page.getByText("No days logged yet")).toBeVisible();
  });

  test("F11-H2 delete account removes the user, their logs and their sessions", async ({ page }) => {
    const a = await signUp(page);
    await rate(page, 1, 1, "Good");
    const id = userRow(a.username).id;
    await page.goto("/settings?tab=account");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Delete my account" }) });
    await form.getByLabel(`Type ${a.username} to confirm`).fill("someone_else");
    await form.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText(`Type ${a.username} to confirm.`)).toBeVisible();
    await form.getByLabel(`Type ${a.username} to confirm`).fill(a.username);
    await form.getByRole("button", { name: "Delete my account" }).click();
    await expect(page).toHaveURL(/\/signup/);
    const db = devDb();
    expect(db.users.some((u) => u.id === id)).toBe(false);
    expect(db.logs.some((l) => l.userId === id)).toBe(false);
    await signIn(page, a.username, a.password);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That username or password isn't right.");
  });
});
