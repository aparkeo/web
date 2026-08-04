// Script ad-hoc: carga /, /map, /login contra el build de producción local
// y captura mensajes de consola relacionados con CSP (report-only los loguea
// sin bloquear).
import { chromium } from 'playwright';

const BASE = process.env.CSP_CHECK_BASE || 'http://localhost:3100';
const ROUTES = ['/', '/map', '/login'];

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const route of ROUTES) {
    const page = await browser.newPage();
    const cspMessages = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/content security policy|refused to|violat/i.test(text)) {
        cspMessages.push(`[${msg.type()}] ${text.slice(0, 300)}`);
      }
    });
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    // Dar tiempo a tiles/hidratación tardía
    await page.waitForTimeout(4000);
    console.log(`\n=== ${route} ===`);
    if (cspMessages.length === 0) {
      console.log('sin mensajes CSP');
    } else {
      total += cspMessages.length;
      cspMessages.forEach((m) => console.log(m));
    }
    await page.close();
  }
  await browser.close();
  console.log(`\nTOTAL mensajes CSP: ${total}`);
  process.exit(0);
})();
