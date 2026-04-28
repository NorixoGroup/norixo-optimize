/**
 * Diagnostic temporaire : SERP Booking via Playwright (hors pipeline).
 * Usage : npx tsx scripts/debug-booking-serp.ts
 */
import { writeFileSync } from "fs";
import { chromium } from "playwright";

const targetUrl =
  "https://www.booking.com/searchresults.fr.html?ss=Sidi%20Bouzid%2C%20Maroc&ssne=Sidi%20Bouzid&ssne_untouched=Sidi%20Bouzid&checkin=2026-05-04&checkout=2026-05-07&group_adults=2&no_rooms=1&group_children=0&selected_currency=EUR&lang=fr";

const OUTPUT_HTML = "/tmp/booking-serp-rendered.html";

async function main() {
  const context = await chromium.launchPersistentContext("/tmp/lco-booking-profile", {
    headless: false,
    viewport: { width: 1365, height: 900 },
    locale: "fr-FR",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });
  const page = context.pages()[0] ?? (await context.newPage());

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (
      url.includes("booking.com/searchresults") ||
      (status >= 300 && status < 400)
    ) {
      console.log("[response]", status, url);
      const location = response.headers()["location"];
      if (location) console.log("[redirect-location]", location);
    }
  });

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      console.log("[frame navigated]", frame.url());
    }
  });

  let cookieAccepted = false;
  let hotelLinksWaitTimeout = false;

  try {
    console.log("targetUrl:", targetUrl);
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    console.log("finalUrl:", page.url());

    try {
      const acceptBtn = page
        .locator('button:has-text("Accepter"), button:has-text("Accept")')
        .first();
      if (await acceptBtn.isVisible({ timeout: 3000 })) {
        await acceptBtn.click();
        cookieAccepted = true;
        console.log("cookie banner accepted");
      }
    } catch {
      /* bannière absente ou autre langue */
    }

    try {
      await page.waitForSelector('a[href*="/hotel/ma/"]', { timeout: 15_000 });
      console.log("hotel /hotel/ma/ links detected in DOM");
    } catch {
      hotelLinksWaitTimeout = true;
      console.log("timeout waiting for hotel /hotel/ma/ links");
    }

    const htmlPreview = (await page.content()).slice(0, 500);
    console.log("DOM preview:", htmlPreview);

    const finalUrl = page.url();
    const html = await page.content();
    writeFileSync(OUTPUT_HTML, html, "utf8");

    const hotelLinks = await page.$$eval('a[href*="/hotel/ma/"]', (els) =>
      els.map((e) => e.getAttribute("href")).filter(Boolean)
    ) as string[];

    const uniqueLinks = [...new Set(hotelLinks)];

    console.log("hotelLinks count:", hotelLinks.length);
    console.log("unique hotelLinks:", uniqueLinks.length);
    console.log("first 20:", uniqueLinks.slice(0, 20));

    const pageTitle = await page.title();
    const bodyText = await page.locator("body").innerText();
    const bodyTextPreview = bodyText.slice(0, 1000);

    const containsSaisissezDestination = bodyText.includes("Saisissez votre destination");
    const containsDestination = bodyText.includes("destination");
    const containsAucunResultat = bodyText.includes("Aucun résultat");
    const containsElJadida = bodyText.includes("El Jadida");

    const containsSidiBouzid = /sidi bouzid/i.test(bodyText);
    const containsBlueMirage = /blue mirage/i.test(bodyText);
    const containsWishIsBouzid = /wish is bouzid/i.test(bodyText);
    const containsDarSofiane = /dar sofiane/i.test(bodyText);

    console.log("");
    console.log("--- résumé ---");
    console.log("page.url:", finalUrl);
    console.log("page title:", pageTitle);
    console.log("body text preview (1000 chars):", bodyTextPreview);
    console.log('contains "Saisissez votre destination":', containsSaisissezDestination ? "oui" : "non");
    console.log('contains "destination":', containsDestination ? "oui" : "non");
    console.log('contains "Aucun résultat":', containsAucunResultat ? "oui" : "non");
    console.log('contains "El Jadida":', containsElJadida ? "oui" : "non");
    console.log("saved:", OUTPUT_HTML);
    console.log("hotelLinks count:", hotelLinks.length);
    console.log("uniqueLinks count:", uniqueLinks.length);
    console.log("first 20 links:", uniqueLinks.slice(0, 20));
    console.log("cookie accepted:", cookieAccepted ? "oui" : "non");
    console.log("timeout attente liens hôtel:", hotelLinksWaitTimeout ? "oui" : "non");
    console.log("contains Sidi Bouzid:", containsSidiBouzid ? "oui" : "non");
    console.log("contains Blue Mirage:", containsBlueMirage ? "oui" : "non");
    console.log("contains Wish is Bouzid:", containsWishIsBouzid ? "oui" : "non");
    console.log("contains Dar Sofiane:", containsDarSofiane ? "oui" : "non");
    console.log("(aperçu HTML brut dans les logs ci-dessus — DOM preview)");
    console.log("");
    console.log("Pause 10s (fenêtre visible — cookies / URL dans la barre)…");
    await page.waitForTimeout(10_000);
  } finally {
    await context.close().catch(() => null);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
