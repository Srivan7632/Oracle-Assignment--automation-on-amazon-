import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Navigating to Amazon India...');
  await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded' });

  console.log('Searching for TV...');
  const searchBox = page.locator('#twotabsearchtextbox');
  await searchBox.fill('TV');
  await page.locator('#nav-search-submit-button').click();

  await page.waitForTimeout(4000);

  console.log('Inspecting Brands section in sidebar...');
  
  const brandsSection = page.locator('#s-refinements div:has(span:text-is("Brands")), #brandsRefinements, #s-refinements div:has(span:text-is("Brand"))').first();
  console.log('Brands section count:', await brandsSection.count());

  const seeMoreBtns = page.locator('#s-refinements a:has-text("See more"), #s-refinements a:has-text("See More"), #s-refinements span:has-text("See more"), #s-refinements [aria-label*="See more"]');
  console.log('See More buttons count:', await seeMoreBtns.count());

  for (let i = 0; i < await seeMoreBtns.count(); i++) {
    const text = await seeMoreBtns.nth(i).innerText().catch(() => '');
    const parentText = await seeMoreBtns.nth(i).locator('xpath=ancestor::div[2]').innerText().catch(() => '');
    console.log(`See More button #${i + 1}: text="${text}", parentSnippet="${parentText.substring(0, 50).replace(/\n/g, ' ')}"`);
  }

  // Find Onida and LG text anywhere in sidebar
  const onidaLoc = page.locator('#s-refinements').locator('text=/onida/i');
  console.log('Onida in sidebar count:', await onidaLoc.count());

  const lgLoc = page.locator('#s-refinements').locator('text=/lg/i');
  console.log('LG in sidebar count:', await lgLoc.count());

  await browser.close();
})();
