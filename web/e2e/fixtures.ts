// Shared fixture for every spec: fails on console errors and 5xx responses, gives each
// test its own client IP (so rate limits don't leak between tests), and has helpers
// for accounts, the axe scan and reading the dev backend's data file.
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export { expect };

export type Account = { fullName: string; username: string; email: string; password: string };

export function newAccount(prefix = "u"): Account {
  const tag = randomBytes(4).toString("hex");
  return { fullName: `Test ${tag}`, username: `${prefix}_${tag}`, email: `${prefix}_${tag}@example.test`, password: `pw-${tag}-long` };
}

export function ipFor(seed: string) {
  const h = createHash("sha256").update(seed).digest();
  return `10.${h[0]}.${h[1]}.${h[2]}`;
}

export const test = base.extend<{ guards: void }>({
  extraHTTPHeaders: async ({}, use, info) => {
    await use({ "x-forwarded-for": ipFor(info.testId + info.project.name) });
  },
  guards: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`console error: ${m.text()}`);
      });
      page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 500) problems.push(`${r.status()} on ${r.url()}`);
      });
      await use();
      expect(problems, "console errors or 5xx responses").toEqual([]);
    },
    { auto: true },
  ],
});

export async function signUp(page: Page, a: Account = newAccount()) {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(a.fullName);
  await page.getByLabel("Username").fill(a.username);
  await page.getByLabel("Email").fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/today/);
  return a;
}

export async function signIn(page: Page, identifier: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Username or email").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function startDemo(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Try it with sample data" }).click();
  await expect(page).toHaveURL(/\/today/);
}

/** The rating group for one quarter on the Today screen. */
export function quarterGroup(page: Page, juz: number, q: number) {
  return page.getByRole("radiogroup", { name: `How did Juz ${juz} · quarter ${q} go?` });
}

export async function rate(page: Page, juz: number, q: number, label: "Good" | "Okay" | "Weak") {
  const radio = quarterGroup(page, juz, q).getByRole("radio", { name: label });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
  // Wait for the save to finish (the group is aria-busy while saving).
  await expect(quarterGroup(page, juz, q)).not.toHaveAttribute("aria-busy", "true");
}

export async function expectNoA11yViolations(page: Page, skipRules: string[] = []) {
  // After a client-side navigation Next streams the new <title> a moment later.
  if (!skipRules.includes("document-title")) await expect.poll(() => page.title(), { message: "page has a title" }).not.toBe("");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).disableRules(skipRules).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
}

type DevDb = {
  users: { id: string; username: string; email: string; dailyTarget: number }[];
  resets: { userId: string; code: string }[];
  logs: { userId: string; date: string; target: number; quarters: { rub: number; quality: string | null }[] }[];
};

/** The dev backend's data file, as the e2e server writes it. */
export function devDb(): DevDb {
  return JSON.parse(readFileSync(join(__dirname, "..", ".data-e2e", "dev-db.json"), "utf8"));
}

export function userRow(username: string) {
  const u = devDb().users.find((x) => x.username === username);
  if (!u) throw new Error(`no user ${username}`);
  return u;
}

/** Today's date in the test browser's time zone (playwright.config timezoneId). */
export function todayIn(tz = "Asia/Karachi") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}
