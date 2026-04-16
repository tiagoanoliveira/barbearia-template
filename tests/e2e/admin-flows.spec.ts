import { test, expect } from '@playwright/test'

// Fluxo base de autenticação admin

test('admin consegue abrir página de login', async ({ page }) => {
  await page.goto('/admin/login')
  await expect(page.locator('form')).toBeVisible()
})

// Nota: o fluxo de login real depende de credenciais válidas/configuração backend
