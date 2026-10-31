import { devDb, expect, expectNoA11yViolations, ipFor, newAccount, signUp, test } from "./fixtures";

test.describe("F01 new user signs up and starts revising", () => {
  test("F01-H1 sign up lands on Today with the default goal of 4", async ({ page }) => {
    await page.goto("/signup");
    await expectNoA11yViolations(page);
    const a = await signUp(page);
    await expect(page.getByText("Today's portion")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: /^How did Juz \d+ · quarter \d+ go\?$/ })).toHaveCount(4);
    await expect(page.getByText(a.email)).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("F01-E1 empty form shows an error on every field and creates nothing", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Tell us what to call you.")).toBeVisible();
    await expect(page.getByText(/3-24 characters/)).toBeVisible();
    await expect(page.getByText(/Enter an email like/)).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/signup/);
    // Other workers sign people up in parallel, so look for a blank account, not a count.
    expect((await devDb()).users.filter((u) => !u.isDemo && (!u.username || !u.email))).toEqual([]);
  });

  test("F01-E2 username taken, case-insensitively", async ({ page, browser }) => {
    const a = await signUp(page);
    const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipFor(a.username) } });
    const p2 = await other.newPage();
    const b = newAccount();
    await p2.goto("/signup");
    await p2.getByLabel("Your name").fill(b.fullName);
    await p2.getByLabel("Username").fill(a.username.toUpperCase());
    await p2.getByLabel("Email").fill(b.email);
    await p2.getByLabel("Password", { exact: true }).fill(b.password);
    await p2.getByRole("button", { name: "Create account" }).click();
    await expect(p2.getByText("That username is taken.")).toBeVisible();
    // What they typed is kept, except the password.
    await expect(p2.getByLabel("Email")).toHaveValue(b.email);
    await expect(p2.getByLabel("Password", { exact: true })).toHaveValue("");
    await other.close();
  });

  test("F01-E3 email already used, with different capitals and spaces", async ({ page, browser }) => {
    const a = await signUp(page);
    const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipFor(a.email) } });
    const p2 = await other.newPage();
    const b = newAccount();
    await p2.goto("/signup");
    await p2.getByLabel("Your name").fill(b.fullName);
    await p2.getByLabel("Username").fill(b.username);
    await p2.getByLabel("Email").fill(`  ${a.email.toUpperCase()} `);
    await p2.getByLabel("Password", { exact: true }).fill(b.password);
    await p2.getByRole("button", { name: "Create account" }).click();
    await expect(p2.getByText("There's already an account with that email.")).toBeVisible();
    await other.close();
  });

  test("F01-E4 short password and bad username rejected", async ({ page }) => {
    const a = newAccount();
    await page.goto("/signup");
    await page.getByLabel("Your name").fill(a.fullName);
    await page.getByLabel("Username").fill("no spaces!");
    await page.getByLabel("Email").fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/3-24 characters/)).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  });

  test("F01-E5 accents and emoji in the name are kept; 81 characters is refused", async ({ page }) => {
    const a = { ...newAccount(), fullName: "Zaynab Al-Ḥasanī 🌙" };
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("x".repeat(81));
    // maxLength stops typing past 80, so check the server too by removing it.
    await page.getByLabel("Your name").evaluate((el) => {
      el.removeAttribute("maxlength");
      (el as HTMLInputElement).value = "x".repeat(81);
    });
    await page.getByLabel("Username").fill(a.username);
    await page.getByLabel("Email").fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(a.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Keep it under 80 characters.")).toBeVisible();

    await signUp(page, a);
    await page.goto("/settings?tab=account");
    await expect(page.getByLabel("Your name")).toHaveValue("Zaynab Al-Ḥasanī 🌙");
  });

  test("F01-E6 double-clicking Create account makes one account, no error", async ({ page }) => {
    const a = newAccount();
    await page.goto("/signup");
    await page.getByLabel("Your name").fill(a.fullName);
    await page.getByLabel("Username").fill(a.username);
    await page.getByLabel("Email").fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(a.password);
    await page.getByRole("button", { name: "Create account" }).dblclick();
    await expect(page).toHaveURL(/\/today/);
    expect((await devDb()).users.filter((u) => u.username === a.username)).toHaveLength(1);
  });

  test("F01-E7 sign-up is not capped for everyone: 6 people on 6 networks can join in the same hour @crowd", async ({ browser }) => {
    for (let i = 0; i < 6; i++) {
      const a = newAccount("crowd");
      const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipFor(a.username) } });
      const p = await ctx.newPage();
      await p.goto("/signup");
      await p.getByLabel("Your name").fill(a.fullName);
      await p.getByLabel("Username").fill(a.username);
      await p.getByLabel("Email").fill(a.email);
      await p.getByLabel("Password", { exact: true }).fill(a.password);
      await p.getByRole("button", { name: "Create account" }).click();
      await expect(p, `person ${i + 1} of 6`).toHaveURL(/\/today/);
      await ctx.close();
    }
  });

  test("F01-E10 the sample account is not capped for everyone: 11 visitors on 11 networks @crowd", async ({ browser }) => {
    for (let i = 0; i < 11; i++) {
      const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipFor(`demo-crowd-${i}-${Date.now()}`) } });
      const p = await ctx.newPage();
      await p.goto("/signin");
      await p.getByRole("button", { name: "Try it with sample data" }).click();
      await expect(p, `visitor ${i + 1} of 11`).toHaveURL(/\/today/);
      await ctx.close();
    }
  });

  test("F01-N1 one network still can't mass-create accounts @crowd", async ({ page }) => {
    const results: string[] = [];
    for (let i = 0; i < 14; i++) {
      const a = newAccount("flood");
      await page.context().clearCookies();
      await page.goto("/signup");
      await page.getByLabel("Your name").fill(a.fullName);
      await page.getByLabel("Username").fill(a.username);
      await page.getByLabel("Email").fill(a.email);
      await page.getByLabel("Password", { exact: true }).fill(a.password);
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL(/\/today/, { timeout: 4000 }).then(
        () => results.push("ok"),
        () => results.push("blocked"),
      );
    }
    expect(results.filter((r) => r === "ok").length).toBeLessThan(14);
    expect(results.at(-1)).toBe("blocked");
  });

  test("F01-E8 keyboard only: tab through the form and submit with Enter", async ({ page }) => {
    const a = newAccount();
    await page.goto("/signup");
    await page.getByLabel("Your name").focus();
    await page.keyboard.type(a.fullName);
    await page.keyboard.press("Tab");
    await page.keyboard.type(a.username);
    await page.keyboard.press("Tab");
    await page.keyboard.type(a.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(a.password);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today/);
  });

  test("F01-E9 'today' follows the browser's time zone, not the server's", async ({ browser }) => {
    // UTC+14: on most of the planet's clock it is already tomorrow there.
    const ctx = await browser.newContext({ timezoneId: "Pacific/Kiritimati", extraHTTPHeaders: { "x-forwarded-for": "10.200.0.14" } });
    const p = await ctx.newPage();
    const a = newAccount("tz");
    await p.goto("/signup");
    await p.getByLabel("Your name").fill(a.fullName);
    await p.getByLabel("Username").fill(a.username);
    await p.getByLabel("Email").fill(a.email);
    await p.getByLabel("Password", { exact: true }).fill(a.password);
    await p.getByRole("button", { name: "Create account" }).click();
    await expect(p).toHaveURL(/\/today/);
    const expected = new Intl.DateTimeFormat("en-GB", { timeZone: "Pacific/Kiritimati", day: "numeric", month: "short", year: "numeric" }).format(new Date());
    await expect(p.getByText(expected)).toBeVisible();
    await ctx.close();
  });
});
