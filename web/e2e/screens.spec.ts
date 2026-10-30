// Screenshots for the manual visual pass (M4 in replica/test-plan.md). Skipped unless
// asked for: SCREENS=1 npx playwright test screens --project=desktop
import { expect, startDemo, test } from "./fixtures";

const out = (name: string) => `../replica/test-screens/${name}.png`;

test.skip(!process.env.SCREENS, "only on request");

for (const width of [390, 1440]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`screens ${width} ${scheme}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/signin");
      await page.screenshot({ path: out(`${width}-${scheme}-signin`), fullPage: true });
      await startDemo(page);
      // Rate the first suggested quarter so Today shows a part-done day.
      await page.getByRole("radio", { name: "Good" }).first().click();
      await expect(page.getByRole("progressbar", { name: "Today's progress" })).toHaveAttribute("aria-valuenow", "1");
      for (const [name, path] of [
        ["today", "/today"],
        ["plan", "/plan"],
        ["stats", "/stats"],
        ["history", "/history"],
        ["settings", "/settings?tab=account"],
      ]) {
        await page.goto(path);
        await expect.poll(() => page.title()).not.toBe("");
        await page.screenshot({ path: out(`${width}-${scheme}-${name}`), fullPage: true });
      }
    });
  }
}
