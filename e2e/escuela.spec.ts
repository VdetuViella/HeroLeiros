import { expect, test } from "@playwright/test";

test("Escuela: el primer ejercicio está abierto y los niveles altos cerrados", async ({ page }) => {
  await page.goto("/escuela");
  await expect(page.getByRole("heading", { level: 1, name: "Escuela" })).toBeVisible();
  await expect(page.getByTestId("ejercicio-caixa-ocho-por-mano")).toBeVisible();
  await expect(page.getByTestId("ejercicio-surdo-negras")).toBeVisible();
  await expect(page.getByTestId("ejercicio-caixa-paradiddle")).toHaveCount(0);
  await page.getByLabel("Modo libre (todo abierto)").click();
  await expect(page.getByTestId("ejercicio-caixa-paradiddle")).toBeVisible();
});

test("Escuela: se toca un ejercicio con digitación y metrónomo", async ({ page }) => {
  await page.goto("/escuela");
  await page.getByTestId("ejercicio-caixa-golpes-sencillos").click();
  await expect(page.getByTestId("ficha-ejercicio")).toBeVisible();
  await expect(page.getByRole("button", { name: "60 BPM", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "70 BPM (cerrado)" })).toBeDisabled();
  await page.getByRole("button", { name: /Tocar / }).first().click();
  await expect(page.getByTestId("terminar")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("KeyD");
  await page.getByTestId("terminar").click();
  await expect(page.getByTestId("resultados")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Volver a Escuela" })).toBeVisible();
});

test("Escuela: la portada enlaza a la Escuela", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("ir-escuela").click();
  await expect(page).toHaveURL(/\/escuela$/);
});
