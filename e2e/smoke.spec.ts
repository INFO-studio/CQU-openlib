import { expect, test } from '@playwright/test';

test.describe('docs shell smoke', () => {
  test('home loads and search opens', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('CQU-openlib').first()).toBeVisible();
    await page.getByRole('button', { name: '搜索目录' }).click();
    await expect(page.getByPlaceholder('搜索目录标题…')).toBeVisible();
  });

  test('course sidebar uses A–Z groups', async ({ page }) => {
    await page.goto('/course');
    await expect(page.getByLabel('课程目录 A–Z')).toBeVisible();
    await expect(page.getByLabel('字母索引')).toBeVisible();
    // Expand a letter that should exist for 高等数学 → G
    await page.getByRole('button', { name: 'G', exact: true }).click();
    await expect(page.getByRole('link', { name: '高等数学' }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('bookmark persists via soft navigation', async ({ page }) => {
    await page.goto('/skill');
    await page.getByRole('button', { name: '收藏本页' }).click();
    await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible();
    await page.getByRole('link', { name: 'CQU-openlib' }).click();
    await expect(page.getByRole('heading', { name: '您的收藏页' })).toBeVisible();
    await expect(page.locator('a', { hasText: /技巧|skill/i }).first()).toBeVisible();
  });
});
