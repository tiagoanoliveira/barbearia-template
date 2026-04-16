import { test, expect } from '@playwright/test'

// Fluxo completo base de marcação pública

test('utilizador anónimo consegue navegar pela home e iniciar marcação', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/barbearia/i)

  await expect(page.locator('text=/FAQ/i')).toBeVisible()

  const bookingLink = page.locator('a:has-text(/marcar|booking/i)').first()
  if (await bookingLink.isVisible()) {
    await bookingLink.click()
    await expect(page.locator('form')).toBeVisible()
  }
})

// Fluxo de login público simplificado

test('página de login público está acessível', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('form')).toBeVisible()
})
