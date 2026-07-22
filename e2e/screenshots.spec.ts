import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const OUT = 'e2e/shots';

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

test('capture key pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Home must not reserve a sidebar column
  await expect(page.getByLabel('章节目录')).toHaveCount(0);
  await expect(page.getByLabel('课程目录 A–Z')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('!!! abstract');
  await expect(page.locator('main')).not.toContainText('-->');
  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

  await page.goto('/course');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('课程目录 A–Z')).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-course.png`, fullPage: false });

  await page.getByRole('button', { name: 'G', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/03-course-az-open.png`,
    fullPage: false,
  });

  await page.goto('/course/传感器技术');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main')).not.toContainText(':l-quote:');
  await expect(page.locator('main')).not.toContainText(':l-user:');
  await expect(page.locator('main svg').first()).toBeVisible();
  await expect(page.locator('main')).toContainText('传感器原理与实验教程');
  await page.screenshot({ path: `${OUT}/04-course-doc.png`, fullPage: true });

  await page.goto('/skill');
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: `${OUT}/05-skill-sidebar.png`,
    fullPage: false,
  });

  const chevron = page.locator('[aria-label="展开"]').first();
  if (await chevron.count()) {
    await chevron.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${OUT}/06-skill-tree-expanded.png`,
      fullPage: false,
    });
  }

  await page.goto('/curriculum');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('章节目录')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/07-curriculum.png`, fullPage: false });
});
