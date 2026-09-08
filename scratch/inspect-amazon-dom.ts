import { chromium } from '@playwright/test';

async function printCardTitles() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/s?k=TV+samsung+sony', { waitUntil: 'domcontentloaded' });

  // Click 53.0 to 61.9 in
  const expanders = page.locator('#s-refinements a.a-expander-header, #s-refinements .a-expander-prompt');
  for (let i = 0; i < await expanders.count(); i++) {
    const text = (await expanders.nth(i).innerText().catch(() => '')).trim();
    if (text.toLowerCase().includes('see more')) {
      await expanders.nth(i).click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  const link = page.locator('#s-refinements a').filter({ hasText: '53.0 to 61.9 in' }).first();
  if (await link.count() > 0) {
    console.log('Clicking 53.0 to 61.9 in link...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      link.click({ force: true }),
    ]);
  }

  const cards = page.locator('div[data-component-type="s-search-result"]');
  const count = await cards.count();
  console.log(`Total cards on 53.0-61.9 filtered page: ${count}`);

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const titleLoc = card.locator('h2 a, h2 span').first();
    const title = (await titleLoc.innerText().catch(() => '')).trim().replace(/\n/g, ' ');
    const isSponsored = await card.locator('.s-sponsored-label-info-icon, [aria-label*="Sponsored"], span:text-is("Sponsored")').count() > 0;
    console.log(`Card #${i + 1} ${isSponsored ? '[SPONSORED]' : '[ORGANIC]'}: "${title}"`);
  }

  await browser.close();
}

printCardTitles().catch(console.error);
