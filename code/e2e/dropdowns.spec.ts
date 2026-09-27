import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('all dropdowns inset the arrow and keep native controls in forced colors', async ({ page }) => {
  const css = await readFile(join(process.cwd(), 'src', 'styles.css'), 'utf8');
  await page.setContent(`
    <style>${css}</style>
    <select id="theme"><option>signal</option><option>midnight</option></select>
    <div class="preview-heading"><select aria-label="Layout"><option>two columns</option></select></div>
    <div class="presenter-side"><select id="jump"><option>Slide 1</option></select></div>
    <div class="settings"><select aria-label="Background"><option>solid</option></select></div>
    <select id="disabled-layout" disabled><option>Unavailable layout</option></select>
  `);
  const dropdowns = page.locator('select:not(:disabled)');
  await expect(dropdowns).toHaveCount(4);
  for (const dropdown of await dropdowns.all()) {
    await dropdown.hover();
    const style = await dropdown.evaluate(element => {
      const computed = getComputedStyle(element);
      return {
        appearance: computed.appearance,
        cursor: computed.cursor,
        paddingRight: computed.paddingRight,
        backgroundImage: computed.backgroundImage,
        backgroundPositionX: computed.backgroundPositionX,
      };
    });
    expect(style.appearance).toBe('none');
    expect(style.cursor).toBe('pointer');
    expect(style.paddingRight).toBe('40px');
    expect(style.backgroundImage).toContain('data:image/svg+xml');
    expect(style.backgroundPositionX).toContain('14px');
  }
  await page.locator('#theme').selectOption('midnight');
  await expect(page.locator('#theme')).toHaveValue('midnight');
  await expect(page.locator('#theme')).toHaveCSS('cursor', 'pointer');
  await expect(page.locator('#disabled-layout')).toHaveCSS('cursor', 'not-allowed');
  await page.emulateMedia({ forcedColors: 'active' });
  for (const dropdown of await dropdowns.all()) {
    expect(await dropdown.evaluate(element => getComputedStyle(element).appearance)).toBe('auto');
    expect(await dropdown.evaluate(element => getComputedStyle(element).backgroundImage)).toBe('none');
    expect(await dropdown.evaluate(element => getComputedStyle(element).cursor)).toBe('pointer');
  }
  await expect(page.locator('#disabled-layout')).toHaveCSS('cursor', 'not-allowed');
});
