import { expect, test } from "@playwright/test";

test("serves a valid web manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();

  const manifest = await response.json();
  expect(manifest.name).toBe("テニスサークル運営サポート");
  expect(manifest.short_name).toBe("Tennis Organizing");
  expect(manifest.start_url).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-192.png" }),
      expect.objectContaining({ src: "/icons/icon-512.png" }),
    ]),
  );
});

test("serves the service worker with update-safe headers", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/javascript");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["service-worker-allowed"]).toBe("/");

  const serviceWorker = await response.text();
  expect(serviceWorker).toContain("/_next/static/");
  expect(serviceWorker).toContain("/brand/");
  expect(serviceWorker).toContain("/icons/");
  expect(serviceWorker).toContain("/fonts/");
  expect(serviceWorker).toContain('STATIC_CACHE_POLICY_VERSION = "v1"');
  expect(serviceWorker).not.toContain("tennis-organizing-static-v1.0.0");
});

test("caches static assets without caching API responses", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) {
      return {
        supported: false,
        staticAssetCached: false,
        apiResponseCached: false,
        staticCacheName: null,
      };
    }

    const existingRegistration = await navigator.serviceWorker.getRegistration(
      "/",
    );
    await existingRegistration?.unregister();

    const existingCacheNames = await caches.keys();
    await Promise.all(
      existingCacheNames
        .filter((cacheName) => cacheName.startsWith("tennis-organizing-static-"))
        .map((cacheName) => caches.delete(cacheName)),
    );

    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;

    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
      });
    }

    const staticUrl = `/icons/icon-192.png?sw-test=${Date.now()}`;
    const brandLogoUrl = `/brand/logo-bamboosato.webp?sw-test=${Date.now()}`;
    const apiUrl = `/api/matchups/generate?sw-test=${Date.now()}`;
    await fetch(staticUrl);
    await fetch(brandLogoUrl);
    await fetch(apiUrl).catch(() => undefined);

    const cacheNames = await caches.keys();
    const staticCacheName = cacheNames.find((cacheName) =>
      cacheName.startsWith("tennis-organizing-static-"),
    );
    const staticCache = staticCacheName
      ? await caches.open(staticCacheName)
      : null;

    const staticAssetCached = Boolean(
      staticCache && (await staticCache.match(staticUrl)),
    );
    const brandLogoCached = Boolean(
      staticCache && (await staticCache.match(brandLogoUrl)),
    );
    const apiResponseCached = Boolean(
      staticCache && (await staticCache.match(apiUrl)),
    );

    await registration.unregister();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("tennis-organizing-static-"))
        .map((cacheName) => caches.delete(cacheName)),
    );

    return {
      supported: true,
      staticAssetCached,
      brandLogoCached,
      apiResponseCached,
      staticCacheName,
    };
  });

  expect(result.supported).toBe(true);
  expect(result.staticAssetCached).toBe(true);
  expect(result.brandLogoCached).toBe(true);
  expect(result.apiResponseCached).toBe(false);
  expect(result.staticCacheName).toContain("tennis-organizing-static-");
});

test("shows the app splash once in standalone PWA mode", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  });

  await page.goto("/");

  const splash = page.getByTestId("pwa-splash-screen");
  await expect(splash).toBeVisible();
  await expect(page.getByTestId("pwa-splash-logo")).toHaveAttribute(
    "src",
    "/brand/logo-bamboosato.webp?brandv=bamboosato-v1",
  );
  await expect(splash).toBeHidden({ timeout: 5_000 });

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sessionStorage.getItem("tennis-organizing-pwa-splash-shown-v1"),
      ),
    )
    .toBe("shown");

  await page.reload();
  await expect(page.getByTestId("pwa-splash-screen")).toHaveCount(0);
});

test("keeps app icon URLs stable across app updates", async ({ page }) => {
  await page.goto("/");

  const headerIconSrc = await page.locator(".brand-mark-image").getAttribute("src");
  const iconHrefs = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((elements) =>
      elements.map((element) => (element as HTMLLinkElement).href),
    );

  expect(headerIconSrc).toContain("/icons/icon-192.png?iconv=crop-v1");
  expect(iconHrefs.length).toBeGreaterThan(0);
  expect(
    iconHrefs.some((href) => href.includes("/icons/icon-192.png?iconv=crop-v1")),
  ).toBe(true);
  expect(
    iconHrefs.some((href) => href.includes("/icons/icon-512.png?iconv=crop-v1")),
  ).toBe(true);
  expect(iconHrefs.every((href) => !href.includes("assetv="))).toBe(true);
});
