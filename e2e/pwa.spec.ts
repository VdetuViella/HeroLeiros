import { expect, test } from "@playwright/test";

test("PWA: el manifiesto es instalable", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const response = await page.request.get(new URL(href!, page.url()).toString());
  expect(response.ok()).toBeTruthy();
  const manifest = (await response.json()) as { short_name?: string; display?: string; icons?: unknown[] };
  expect(manifest.short_name).toBe("HeroLeiros");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons?.length ?? 0).toBeGreaterThanOrEqual(2);
});

test("PWA: el service worker se registra", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(async () => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r))), {
      timeout: 15_000,
    })
    .toBe(true);
});

test("PWA: descarga el repertorio para ensayar sin conexión", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // El botón necesita que el SW controle la página: tras registrarse, recarga.
  await page.reload();
  const box = page.getByTestId("sin-conexion");
  await expect(box).toHaveAttribute("data-estado", /pendiente|listo/, { timeout: 15_000 });
  await box.getByRole("button").click();
  await expect(box).toHaveAttribute("data-estado", "listo", { timeout: 60_000 });
  const saved = await page.evaluate(() => caches.match("/canciones/samba-de-ensayo").then(Boolean));
  expect(saved).toBe(true);
});
