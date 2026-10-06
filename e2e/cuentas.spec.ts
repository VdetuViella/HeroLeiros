import { expect, test } from "@playwright/test";

test("cuentas: formulario de entrar o aviso si no hay base de datos", async ({ page }) => {
  await page.goto("/entrar");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const title = (await heading.textContent()) ?? "";

  if (title.includes("no están activadas")) {
    test.info().annotations.push({ type: "skip-login", description: "Sin DATABASE_URL: solo se comprueba el aviso." });
    await expect(page.getByText(/DATABASE_URL/)).toBeVisible();
    return;
  }

  await expect(heading).toHaveText("Entrar");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();

  if (!process.env.DATABASE_URL) return;

  await page.getByLabel("Email").fill("ana@heroleiros.demo");
  await page.getByLabel("Contraseña").fill("batucada123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(progreso|director)/, { timeout: 20_000 });
});
