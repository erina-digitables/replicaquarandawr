import { expect, expectNoA11yViolations, newAccount, signIn, signUp, test } from "./fixtures";

const WRONG = "That username or password isn't right.";

test.describe("F02 returning user signs in / F10 sign out", () => {
  test("F02-H1 sign in with username, and F10-H1 sign out from the header", async ({ page }) => {
    const a = await signUp(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/signin/);
    await expectNoA11yViolations(page);
    await signIn(page, a.username, a.password);
    await expect(page).toHaveURL(/\/today/);
  });

  test("F02-H2 sign in with email in capitals and spaces", async ({ page }) => {
    const a = await signUp(page);
    await page.context().clearCookies();
    await signIn(page, `  ${a.email.toUpperCase()} `, a.password);
    await expect(page).toHaveURL(/\/today/);
  });

  test("F02-N1 wrong password and unknown user get the same message", async ({ page }) => {
    const a = await signUp(page);
    await page.context().clearCookies();
    await signIn(page, a.username, "not-the-password");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(WRONG);
    // The identifier is kept so they only retype the password.
    await expect(page.getByLabel("Username or email")).toHaveValue(a.username);
    await signIn(page, "nobody_here_" + a.username, "whatever-123");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(WRONG);
  });

  test("F02-N2 empty submit asks for both fields", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter your username or email and your password.");
  });

  test("F02-N3 ninth try in ten minutes is refused even with the right password", async ({ page }) => {
    const a = await signUp(page);
    await page.context().clearCookies();
    for (let i = 0; i < 8; i++) {
      await signIn(page, a.username, `wrong-${i}-password`);
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(WRONG);
    }
    await signIn(page, a.username, a.password);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(/Too many tries/);
  });

  test("F02-E1 signed-out visitors are sent to sign in from every app screen", async ({ page }) => {
    for (const path of ["/today", "/plan", "/stats", "/history", "/settings"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/signin/);
    }
  });

  test("F02-E2 a forged session cookie is ignored", async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "dawr_session", value: "forged-token", url: baseURL! }]);
    await page.goto("/today");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("F02-E3 session cookie is httpOnly, so page scripts can't read it", async ({ page }) => {
    await signUp(page);
    expect(await page.evaluate(() => document.cookie)).not.toContain("dawr_session");
    const c = (await page.context().cookies()).find((x) => x.name === "dawr_session");
    expect(c?.httpOnly).toBe(true);
    expect(c?.sameSite).toBe("Lax");
  });

  test("F10-E1 after sign out, Back does not show the app", async ({ page }) => {
    await signUp(page);
    await page.goto("/history");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/signin/);
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(/\/signin/);
  });

  test("F10-H2 sign out from Settings (the phone layout's route)", async ({ page }) => {
    await signUp(page, newAccount());
    await page.goto("/settings");
    await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/signin/);
  });
});
