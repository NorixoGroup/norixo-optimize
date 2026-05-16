
const { chromium } = require('playwright');

(async () => {
  const ws = 'wss://brd-customer-hl_84775b84-zone-lco_scraper:jeilhcov8x4f@brd.superproxy.io:9222';
  const browser = await chromium.connectOverCDP(ws);
  const page = await browser.newPage({ locale: 'fr-FR' });

  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/api/v3/')) {
      try {
        const txt = await res.text();
        if (/1008|1007|944|63,25|€|au total|price|amount/i.test(txt)) {
          console.log('\n[API_MATCH]', res.status(), u.slice(0, 260));
          console.log(txt.slice(0, 2500));
        }
      } catch {}
    }
  });

  await page.goto('https://www.airbnb.fr/rooms/1465932264852038989?adults=4&check_in=2026-05-20&check_out=2026-05-25&guests=4', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });

  await page.waitForTimeout(8000);

  for (const txt of ['Réserver', 'Continuer', 'Afficher le prix', 'Voir les détails du prix']) {
    const el = page.getByText(txt, { exact: false }).first();
    if (await el.count().catch(() => 0)) {
      console.log('[CLICK]', txt);
      await el.click({ timeout: 5000 }).catch(e => console.log('[CLICK_FAIL]', txt, e.message));
      await page.waitForTimeout(5000);
    }
  }

  const body = await page.locator('body').innerText();
  console.log('[BODY_MATCHES]', body.match(/.{0,80}(1008|1007|944|63,25|€|au total|nuits?).{0,100}/gi)?.slice(0, 60) || []);

  await browser.close();
})();
