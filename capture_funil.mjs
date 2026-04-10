import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const responses = [];
page.on('response', async (response) => {
  if (response.url().includes('/api/dashboard/funil')) {
    try {
      const json = await response.json();
      responses.push({ url: response.url(), data: json });
    } catch (e) {
      responses.push({ url: response.url(), text: await response.text().catch(() => 'failed') });
    }
  }
});

try {
  await page.goto('https://saleszone.vercel.app', { timeout: 20000, waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(JSON.stringify(responses, null, 2));
} catch(e) {
  console.error('Navigation error:', e.message);
}
await browser.close();
