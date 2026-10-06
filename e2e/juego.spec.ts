import { expect, test, type Page } from "@playwright/test";

async function startSong(page: Page, slug = "ijexa-de-ensayo") {
  await page.goto("/");
  await page.getByTestId(`cancion-${slug}`).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Tocar / }).first().click();
  await expect(page.getByTestId("terminar")).toBeVisible({ timeout: 30_000 });
}

test("elige canción, toca con teclado y ve resultados", async ({ page }) => {
  await startSong(page);
  await page.keyboard.press("KeyD");
  await page.keyboard.press("KeyF");
  await page.keyboard.press("KeyJ");
  await page.keyboard.press("KeyK");
  await page.getByTestId("terminar").click();
  await expect(page.getByTestId("resultados")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("resultados").getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("resultados").getByText("precisión", { exact: true })).toBeVisible();
});

test("cambia a la vista de partitura durante la partida", async ({ page }) => {
  await startSong(page);
  await page.getByTestId("vista-partitura").click();
  await expect(page.getByRole("button", { name: "Leyenda" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Compás 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Leyenda" }).click();
  await expect(page.getByLabel("Leyenda de símbolos")).toBeVisible();
});

test("el selector de micrófono está en los ajustes", async ({ page }) => {
  await page.goto("/canciones/primeros-pasos");
  await expect(page.getByTestId("entrada-microfono")).toBeVisible();
  await expect(page.getByRole("button", { name: /Teclado o pantalla/ })).toBeVisible();
});
