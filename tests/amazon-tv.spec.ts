import { test, expect } from '@playwright/test';
import { AmazonPage } from '../pages/amazonPage';

/**
 * Helper to dynamically parse brand parameters passed from CLI command or environment variable.
 * Supported formats:
 *   - npm start -- "LG" "TCL"
 *   - npm start -- --brands="Sony,LG"
 *   - BRANDS="Samsung,Sony" npm start
 */
function parseTargetBrands(): string[] {
  if (process.env.BRANDS) {
    return process.env.BRANDS.split(',').map((b) => b.trim()).filter(Boolean);
  }

  const rawArgs = process.argv.slice(2);
  const customBrands: string[] = [];

  for (const arg of rawArgs) {
    if (arg.startsWith('--brands=')) {
      return arg.replace('--brands=', '').split(',').map((b) => b.trim()).filter(Boolean);
    }
    if (
      !arg.startsWith('-') &&
      !arg.endsWith('.ts') &&
      !arg.endsWith('.js') &&
      !arg.includes('playwright') &&
      !arg.includes('node_modules')
    ) {
      customBrands.push(arg.trim());
    }
  }

  if (customBrands.length > 0) {
    return customBrands;
  }

  // Default fallback brands
  return ['Samsung', 'Sony'];
}

test.describe('Amazon TV Automation Suite', () => {
  test('should search and extract TV product details from Amazon', async ({ page, context }) => {
    const amazonPage = new AmazonPage(page, context);
    const targetBrands = parseTargetBrands();

    console.log(`Target preferred brands configured: ${targetBrands.join(', ')}`);

    try {
      // Step 1: Open Amazon India and handle initial overlays
      await amazonPage.navigate();

      // Step 2: Search for "TV" + user-provided brand parameters (e.g., "TV samsung onida")
      const searchQuery = targetBrands.length > 0 ? `TV ${targetBrands.join(' ')}` : 'TV';
      await amazonPage.searchForProduct(searchQuery);

      // Step 3: Apply screen-size filter (53.0 to 61.9 in)
      await amazonPage.applyScreenSizeFilter();

      // Step 4: (Optional brand sidebar filter step commented out as brands are directly included in search query)
      // const selectedBrands = await amazonPage.selectBrands(targetBrands);

      // Step 5: Select first valid non-sponsored product matching target brands
      const productPage = await amazonPage.selectFirstProduct(targetBrands);

      // Step 6: Extract product information
      const productDetails = await amazonPage.extractProductDetails(productPage);

      // Step 7: Output formatted details to console
      amazonPage.printProductDetails(productDetails);

      // Verify essential extraction result
      expect(productDetails.title).not.toBe('Not available');
    } catch (error) {
      console.error('Automation encountered an error:', error);
      throw error;
    }
  });
});
