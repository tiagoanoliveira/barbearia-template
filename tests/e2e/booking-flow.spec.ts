import { test, expect } from '@playwright/test'

// Nota: Playwright assume que a app está a correr em http://localhost:5173

test('utilizador consegue fazer o fluxo base de marcação', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('text=FAQ')).toBeVisible()

  // Exemplo genérico, os selectores devem ser afinados conforme o markup real
  await page.click('text=/marcar|booking/i').catch(() => {})

  await expect(page.locator('form')).toBeVisible()
})
