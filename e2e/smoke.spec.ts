import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * Collects console.error output and uncaught page errors for an assertion that
 * the app rendered cleanly. A render-time throw lands in the ErrorBoundary
 * fallback ("Something went wrong"), so we also assert that text is absent.
 */
function trackErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('app mounts without crashing', async ({ page }) => {
  const errors = trackErrors(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The ErrorBoundary fallback must NOT be on screen.
  await expect(page.getByText('Something went wrong')).toHaveCount(0);

  // Core chrome is present: at least one numeric input renders.
  await expect(page.locator('input[type="number"]').first()).toBeVisible();

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('unit switch and add-rectangle do not crash', async ({ page }) => {
  const errors = trackErrors(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const inputs = page.locator('input[type="number"]');
  const before = await inputs.evaluateAll((els) =>
    (els as HTMLInputElement[]).map((e) => e.value),
  );

  // Switch the active unit to feet via the unit button group.
  const ft = page.getByRole('button', { name: 'ft', exact: true });
  if (await ft.count()) {
    await ft.first().click();
    // At least one length input should resync its displayed value to the new
    // unit (zero-valued inputs like offsets stay 0, so compare the whole set).
    await expect
      .poll(async () =>
        inputs.evaluateAll(
          (els, prev) =>
            (els as HTMLInputElement[]).some((e, i) => e.value !== prev[i]),
          before,
        ),
      )
      .toBe(true);
  }

  // Add a rectangle to the shape; the geometry pipeline must not throw.
  const addRect = page.getByRole('button', { name: /add rectangle/i });
  if (await addRect.count()) {
    await addRect.first().click();
    await page.waitForTimeout(300);
  }

  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});
