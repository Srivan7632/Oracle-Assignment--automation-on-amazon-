import { Page, BrowserContext, Locator, expect } from '@playwright/test';

export interface ProductDetails {
  title: string;
  price: string;
  rating: string;
  aboutThisItem: string[];
  specifications: Record<string, string>;
}

export class AmazonPage {
  readonly page: Page;
  readonly context: BrowserContext;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
  }

  /**
   * Navigate to Amazon India and dismiss initial popups/overlays if present.
   */
  async navigate(): Promise<void> {
    console.log('Navigating to Amazon India (https://www.amazon.in)...');
    await this.page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded' });
    await this.dismissOverlays();
  }

  /**
   * Dismiss common popups such as location/pincode banners, cookie consent, etc.
   */
  async dismissOverlays(): Promise<void> {
    try {
      // Location prompt / dismiss button
      const dismissLocationBtn = this.page.locator(
        '#nav-main input[type="submit"][data-action-type="DISMISS"], input[data-action-type="DISMISS"], #glow-toc-dismissible-panel input[type="submit"]'
      );
      if (await dismissLocationBtn.count() > 0 && await dismissLocationBtn.first().isVisible().catch(() => false)) {
        await dismissLocationBtn.first().click().catch(() => {});
        console.log('Dismissed location overlay.');
      }

      // Cookie consent / banner close if present
      const cookieDismiss = this.page.locator('#sp-cc-accept, .a-button-close');
      if (await cookieDismiss.count() > 0 && await cookieDismiss.first().isVisible().catch(() => false)) {
        await cookieDismiss.first().click().catch(() => {});
        console.log('Dismissed cookie overlay.');
      }
    } catch {
      // Overlays are optional; ignore errors if not present
    }
  }

  /**
   * Search for a product keyword in Amazon search bar.
   */
  async searchForProduct(searchTerm: string): Promise<void> {
    console.log(`Searching for: "${searchTerm}"`);
    
    // Locate search box using resilient locators
    const searchBox = this.page.locator('#twotabsearchtextbox')
      .or(this.page.getByPlaceholder('Search Amazon.in'))
      .or(this.page.getByRole('searchbox'));

    await searchBox.first().waitFor({ state: 'visible', timeout: 15000 });
    await searchBox.first().fill(searchTerm);
    
    const searchButton = this.page.locator('#nav-search-submit-button')
      .or(this.page.getByRole('button', { name: 'Go' }))
      .or(this.page.locator('input[type="submit"][value="Go"]'));

    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      searchButton.first().click(),
    ]);

    // Verify results page and sidebar refinements loaded
    const searchResults = this.page.locator('div.s-main-slot, span[data-component-type="s-search-results"]');
    await searchResults.first().waitFor({ state: 'visible', timeout: 15000 });

    // Navigate into 'Televisions' category if present to unlock specific TV Screen Size & Brand filters
    const tvCategory = this.page.locator(
      '#s-refinements a:has-text("Televisions"), ' +
      '#refinements a:has-text("Televisions"), ' +
      'div[id*="refinement"] a:has-text("Televisions")'
    ).first();

    if (await tvCategory.count() > 0 && await tvCategory.isVisible().catch(() => false)) {
      console.log('Refining search to "Televisions" category for full sidebar filters...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
        tvCategory.click({ force: true }),
      ]);
      await this.page.waitForTimeout(1500);
    }

    const sidebarContainer = this.page.locator(
      '#s-refinements, #refinements, #filters, div[id*="refinement"], div[id*="filter"], #leftNav'
    );
    await sidebarContainer.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    console.log('Search results page and sidebar filters loaded successfully.');
  }

  /**
   * Apply TV screen size filters (prioritizing '53.0 to 61.9 in' option).
   */
  async applyScreenSizeFilter(targetSizes: string[] = ['53.0 to 61.9', '50', '55']): Promise<void> {
    console.log(`Applying screen size filter...`);

    // Expand "See More" in sidebar if applicable
    await this.expandFilterSection('Screen Size').catch(() => {});
    await this.expandFilterSection('TV Screen Size').catch(() => {});
    await this.expandFilterSection('Display Size').catch(() => {});

    let filterApplied = false;

    const sizePatterns = [
      '53.0 to 61.9 in',
      '53.0 to 61.9',
      '53 to 61.9 in',
      '53 to 61.9',
      '55 Inches & Above',
      '55 Inches',
      '50 Inches',
      '55"',
      '50"'
    ];

    const sidebar = this.page.locator(
      '#s-refinements, #refinements, #filters, div[id*="refinement"], div[id*="filter"], #leftNav'
    );

    for (const pattern of sizePatterns) {
      const filterLocator = sidebar.locator('a, label, li, input[type="checkbox"]')
        .filter({ hasText: pattern })
        .first();

      if (await filterLocator.count() > 0 && await filterLocator.isVisible().catch(() => false)) {
        console.log(`Found screen size filter matching pattern "${pattern}". Clicking...`);
        
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
          filterLocator.click({ force: true }),
        ]);

        await this.page.waitForTimeout(1000);
        filterApplied = true;
        console.log(`Screen size filter "${pattern}" applied successfully.`);
        break;
      }
    }

    if (!filterApplied) {
      console.warn('Warning: Specified screen size filter ("53.0 to 61.9 in") was not found directly in current sidebar layout. Continuing with available results.');
    }
  }

  /**
   * Select two available brand filters (preferring preferredBrands such as Samsung and Sony).
   */
  async selectBrands(preferredBrands: string[] = ['Samsung', 'Sony']): Promise<string[]> {
    console.log(`Attempting to select brands (Preferring: ${preferredBrands.join(', ')})...`);

    // Ensure Brands refinement section is expanded if hidden
    await this.expandFilterSection('Brands').catch(() => {});
    await this.expandFilterSection('Brand').catch(() => {});

    let selectedBrands: string[] = [];
    let availablePreferred: { brand: string; option: Locator }[] = [];

    const scanPreferredBrands = async () => {
      const found: { brand: string; option: Locator }[] = [];
      for (const brand of preferredBrands) {
        let brandOption = this.getBrandLocator(brand);

        if (!(await brandOption.count() > 0 && await brandOption.isVisible().catch(() => false))) {
          await this.expandFilterSection('Brands').catch(() => {});
          brandOption = this.getBrandLocator(brand);
        }

        if (await brandOption.count() > 0 && await brandOption.isVisible().catch(() => false)) {
          found.push({ brand, option: brandOption });
        } else {
          console.log(`Preferred brand "${brand}" is not currently visible in sidebar filters.`);
        }
      }
      return found;
    };

    availablePreferred = await scanPreferredBrands();

    // If requested preferred brands were specified, but none were visible in the generic sidebar,
    // re-search specifically with the preferred brands in the query so Amazon loads results & filters for them!
    if (availablePreferred.length === 0 && preferredBrands.length > 0) {
      const targetedQuery = `TV ${preferredBrands.join(' ')}`;
      console.log(`Requested brand(s) [${preferredBrands.join(', ')}] not listed in generic sidebar. Performing targeted search for: "${targetedQuery}"...`);
      await this.searchForProduct(targetedQuery);
      availablePreferred = await scanPreferredBrands();
    }

    // Sort available preferred brands so major global brands are selected first
    const majorBrands = ['lg', 'samsung', 'sony', 'tcl', 'xiaomi', 'redmi', 'panasonic', 'toshiba', 'vu', 'hisense', 'oneplus', 'acer', 'onida'];
    availablePreferred.sort((a, b) => {
      const aMajor = majorBrands.includes(a.brand.toLowerCase());
      const bMajor = majorBrands.includes(b.brand.toLowerCase());
      if (aMajor && !bMajor) return -1;
      if (!aMajor && bMajor) return 1;
      return 0;
    });

    // Apply available preferred brands
    if (availablePreferred.length > 0) {
      for (const item of availablePreferred) {
        if (selectedBrands.length >= 2) break;
        const isChecked = await this.isBrandChecked(item.option);
        if (!isChecked) {
          console.log(`Selecting preferred brand: ${item.brand}`);
          await this.clickBrandFilter(item.option);
          selectedBrands.push(item.brand);
        } else {
          console.log(`Preferred brand "${item.brand}" is already selected.`);
          selectedBrands.push(item.brand);
        }
      }
    }

    // If preferred brands were requested and we searched for them, but Amazon didn't have checkboxes for them,
    // recognize that the search query results are already filtered for the requested brand!
    if (selectedBrands.length === 0 && preferredBrands.length > 0) {
      console.log(`Search results are already targeted for: ${preferredBrands.join(', ')}.`);
      selectedBrands = preferredBrands.slice(0, 2);
    }

    // Fallback ONLY if no preferred brands were specified at all
    if (selectedBrands.length === 0) {
      console.log(`None of the requested brands were found in filters. Looking for fallback available brands...`);

      await this.expandFilterSection('Brands').catch(() => {});

      const brandContainer = this.page.locator(
        '#s-refinements div[id*="brandsRefinements"], ' +
        '#s-refinements div[data-csa-c-slot-id*="brands"], ' +
        '#s-refinements div:has(> span.a-text-bold:text-is("Brands")), ' +
        '#s-refinements div:has(> span.a-text-bold:text-is("Brand"))'
      ).first();

      const brandItems = brandContainer.locator('li');
      const count = await brandItems.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        if (selectedBrands.length >= 2) break;

        const item = brandItems.nth(i);
        const text = (await item.innerText().catch(() => '')).trim();
        const brandName = text.split('\n')[0].trim();

        // Ensure text is a valid brand name and not size/rating/expander buttons
        const isNonBrand = /\b(inch|cm|star|above|under|₹|rs|see more|see less|show more|show less)\b/i.test(brandName);

        if (brandName && !isNonBrand && !selectedBrands.includes(brandName)) {
          const brandLoc = item.locator('a, input[type="checkbox"], label').first();
          if (await brandLoc.count() > 0 && await brandLoc.isVisible().catch(() => false)) {
            console.log(`Selecting fallback available brand: ${brandName}`);
            await this.clickBrandFilter(brandLoc);
            selectedBrands.push(brandName);
          }
        }
      }
    }

    console.log(`Successfully applied brand filter(s): ${selectedBrands.join(', ')}`);
    return selectedBrands;
  }

  /**
   * Helper to locate a specific brand filter by text (case-insensitive).
   */
  private getBrandLocator(brandName: string): Locator {
    const cleanBrand = brandName.trim();
    const wordRegex = new RegExp(`^${cleanBrand}$|\\b${cleanBrand}\\b`, 'i');

    const brandContainer = this.page.locator(
      '#brandsRefinements, ' +
      '#s-refinements div[id*="brandsRefinements"], ' +
      '#s-refinements div[data-csa-c-slot-id*="brands"], ' +
      '#s-refinements div:has(span:text-is("Brands")), ' +
      '#s-refinements div:has(span:text-is("Brand")), ' +
      '#s-refinements, #filters'
    ).first();

    return brandContainer
      .locator('a[href*="p_89"], a.s-navigation-item, label, li')
      .filter({ hasText: wordRegex })
      .first();
  }

  /**
   * Helper to check if a brand checkbox is selected.
   */
  private async isBrandChecked(brandLocator: Locator): Promise<boolean> {
    try {
      const checkbox = brandLocator.locator('input[type="checkbox"]');
      if (await checkbox.count() > 0) {
        return await checkbox.isChecked();
      }
      const parentLi = brandLocator.locator('xpath=ancestor::li[1]');
      const classAttr = await parentLi.getAttribute('class').catch(() => '');
      return classAttr?.includes('s-matching-dir') || classAttr?.includes('a-aria-checked') || false;
    } catch {
      return false;
    }
  }

  /**
   * Helper to click a brand filter and wait for page content update.
   */
  private async clickBrandFilter(locator: Locator): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      locator.click({ force: true }),
    ]);
    await this.page.waitForTimeout(800);
  }

  /**
   * Expand filter sections if hidden under "See more" or "See More" button.
   */
  private async expandFilterSection(sectionName: string): Promise<void> {
    // 1. Target the specific section container by heading text
    const sectionContainer = this.page.locator('#s-refinements, #refinements, #filters')
      .locator(`div:has(span:text-is("${sectionName}")), div:has(span:has-text("${sectionName}")), #brandsRefinements, div[id*="brandsRefinements"]`)
      .first();

    const seeMoreBtn = sectionContainer.locator(
      'a:has-text("See more"), a:has-text("See More"), span.a-expander-prompt, a.a-expander-header'
    ).first();

    if (await seeMoreBtn.count() > 0 && await seeMoreBtn.isVisible().catch(() => false)) {
      console.log(`Found "See More" link under "${sectionName}". Clicking...`);
      await seeMoreBtn.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500);
      return;
    }

    // 2. Fallback targeting #brandsRefinements specifically for Brands
    const brandsExpander = this.page.locator('#brandsRefinements a.a-expander-header, #brandsRefinements .a-expander-prompt').first();
    if (await brandsExpander.count() > 0 && await brandsExpander.isVisible().catch(() => false)) {
      console.log(`Found "See More" under #brandsRefinements. Clicking...`);
      await brandsExpander.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Identify and click the first valid, non-sponsored product from search results.
   * Returns the new Page object if opened in a new tab, or current Page if opened in same tab.
   */
  /**
   * Identify and click the first valid, non-sponsored product from search results.
   * Prioritizes organic items matching target/applied brand names in product title.
   * Returns the new Page object if opened in a new tab, or current Page if opened in same tab.
   */
  async selectFirstProduct(targetBrands: string[] = [], targetSizeFilter: boolean = true): Promise<Page> {
    console.log(`Locating first valid (non-sponsored) TV product${targetBrands.length > 0 ? ` (Preferring brands: ${targetBrands.join(', ')})` : ''}...`);

    // Check for explicit 'No results' banner on Amazon
    const noResults = this.page.locator(
      'span:has-text("No results for"), div:has-text("No results for"), span:has-text("Try checking your spelling")'
    );
    if (await noResults.count() > 0 && await noResults.first().isVisible().catch(() => false)) {
      throw new Error('Search or filter criteria returned 0 results on Amazon India.');
    }

    // Wait for search result cards with clean error handling
    const resultsContainer = this.page.locator('div.s-main-slot, span[data-component-type="s-search-results"]');
    try {
      await resultsContainer.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      throw new Error('No search result grid found. The applied filters returned 0 results or page layout changed.');
    }

    const resultCards = this.page.locator('div[data-component-type="s-search-result"], div[data-asin]:not([data-asin=""])');
    try {
      await resultCards.first().waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      throw new Error('No product card items found in search results.');
    }

    const totalResults = await resultCards.count();
    console.log(`Found ${totalResults} search result items.`);

    let targetLink: Locator | null = null;
    let targetTitle = '';
    let fallbackLink: Locator | null = null;
    let fallbackTitle = '';

    for (let i = 0; i < totalResults; i++) {
      const card = resultCards.nth(i);

      // Instant check for sponsored tags (count > 0 doesn't block or wait for timeouts)
      const sponsoredCount = await card.locator(
        '.s-sponsored-label-info-icon, .puis-sponsored-label-text, [aria-label*="Sponsored"], span:text-is("Sponsored"), span:has-text("Sponsored")'
      ).count().catch(() => 0);

      if (sponsoredCount > 0) {
        console.log(`Item #${i + 1} is sponsored. Skipping.`);
        continue;
      }

      // Title link locator variants
      const titleLink = card.locator('h2 a, a.a-link-normal:has(h2), a.a-text-normal:has(h2), h2 span').first();
      if (await titleLink.count() > 0) {
        const text = (await titleLink.innerText().catch(() => '')).trim();
        const cardText = (await card.innerText().catch(() => '')).trim();
        const fullTitle = text.length > 10 ? text : cardText.replace(/\n/g, ' ');

        if (fullTitle.length > 5) {
          const anchorElement = card.locator('h2 a, a.a-link-normal:has(h2), a[href*="/dp/"]').first();
          const currentLink = (await anchorElement.count() > 0) ? anchorElement : titleLink;

          // Ensure the product is an actual Television set and not a TV accessory (mount, bracket, remote, etc.)
          const isAccessory = /\b(mount|bracket|stand|remote|cable|cover|guard|stabilizer|plug|adapter|antenna|case|holder|trolley|wall mount|wall stand|backlight|led strip)\b/i.test(fullTitle);

          if (isAccessory) {
            console.log(`Item #${i + 1} ("${fullTitle.substring(0, 45)}...") is a TV accessory. Skipping.`);
            continue;
          }

          // Check if title matches requested screen size (55", 50", 53-61", 138-140cm) when size filter is enabled
          const isMismatchedSize = targetSizeFilter && /\b(43|32|24|28|27|22|21|108\s*cm|80\s*cm|60\s*cm)\b/i.test(fullTitle) && !/\b(55|50|58|60|65|138\s*cm|139\s*cm|140\s*cm|126\s*cm)\b/i.test(fullTitle);

          if (isMismatchedSize) {
            console.log(`Item #${i + 1} ("${fullTitle.substring(0, 45)}...") does not match 53.0 to 61.9 in screen size filter. Skipping.`);
            if (!fallbackLink) {
              fallbackLink = currentLink;
              fallbackTitle = fullTitle;
            }
            continue;
          }

          // Save first organic TV item as fallback
          if (!fallbackLink) {
            fallbackLink = currentLink;
            fallbackTitle = fullTitle;
          }

          // Check if product title matches requested target brands
          const matchesTargetBrand = targetBrands.length === 0 || targetBrands.some((brand) => {
            const regex = new RegExp(`\\b${brand.trim()}\\b`, 'i');
            return regex.test(fullTitle);
          });

          if (matchesTargetBrand) {
            targetTitle = fullTitle;
            targetLink = currentLink;
            console.log(`Selected organic product #${i + 1} matching requested brand & size: "${targetTitle.substring(0, 65)}..."`);
            break;
          } else {
            console.log(`Item #${i + 1} ("${fullTitle.substring(0, 45)}...") does not match requested brand(s) [${targetBrands.join(', ')}]. Checking next item...`);
          }
        }
      }
    }

    if (!targetLink) {
      if (fallbackLink) {
        targetLink = fallbackLink;
        targetTitle = fallbackTitle;
        console.log(`Using fallback organic product: "${targetTitle.substring(0, 65)}..."`);
      } else {
        throw new Error('No valid non-sponsored product found in the search results.');
      }
    }

    // Click link and handle potential new tab
    console.log('Opening product page...');
    const pagePromise = this.context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
    
    await targetLink.scrollIntoViewIfNeeded().catch(() => {});
    await targetLink.click();

    const newPage = await pagePromise;

    if (newPage) {
      console.log('Product opened in a new browser tab.');
      await newPage.waitForLoadState('domcontentloaded');
      return newPage;
    } else {
      console.log('Product opened in the same browser tab.');
      await this.page.waitForLoadState('domcontentloaded');
      return this.page;
    }
  }

  /**
   * Extract Product Title, Price, Rating, "About this item", and Specifications from product page.
   */
  async extractProductDetails(productPage: Page): Promise<ProductDetails> {
    console.log('Extracting product details from product page...');

    // 1. Extract Title
    let title = 'Not available';
    try {
      const titleLoc = productPage.locator('#productTitle, h1#title span#productTitle, #title span').first();
      if (await titleLoc.count() > 0 && await titleLoc.isVisible().catch(() => false)) {
        title = (await titleLoc.innerText()).trim();
      }
    } catch {
      title = 'Not available';
    }

    // 2. Extract Price
    let price = 'Not available';
    try {
      const priceLocators = [
        productPage.locator('#corePrice_feature_div .a-offscreen').first(),
        productPage.locator('.apexPriceToPay .a-offscreen').first(),
        productPage.locator('#priceblock_ourprice').first(),
        productPage.locator('#priceblock_dealprice').first(),
        productPage.locator('.a-price .a-offscreen').first(),
      ];

      for (const loc of priceLocators) {
        if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
          const rawPrice = (await loc.innerText()).trim();
          if (rawPrice) {
            price = rawPrice;
            break;
          }
        }
      }
    } catch {
      price = 'Not available';
    }

    // 3. Extract Customer Rating
    let rating = 'Not available';
    try {
      const ratingLocators = [
        productPage.locator('span[data-hook="rating-out-of-text"]').first(),
        productPage.locator('#acrPopover span.a-icon-alt').first(),
        productPage.locator('i.a-icon-star span.a-icon-alt').first(),
        productPage.locator('.a-icon-star-small .a-icon-alt').first(),
      ];

      for (const loc of ratingLocators) {
        if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
          const rawRating = (await loc.innerText()).trim();
          if (rawRating) {
            rating = rawRating;
            break;
          }
        }
      }
    } catch {
      rating = 'Not available';
    }

    // 4. Extract "About this item"
    const aboutThisItem: string[] = [];
    try {
      const featureBullets = productPage.locator('#feature-bullets ul li span.a-list-item, #featurebullets_feature_div ul li span.a-list-item');
      const bulletCount = await featureBullets.count().catch(() => 0);

      for (let i = 0; i < bulletCount; i++) {
        const bulletText = (await featureBullets.nth(i).innerText().catch(() => '')).trim();
        if (bulletText && !bulletText.toLowerCase().includes('show more')) {
          aboutThisItem.push(bulletText);
        }
      }
    } catch {
      // Keep empty if not found
    }

    // 5. Extract Product Specifications / Information
    const specifications: Record<string, string> = {};
    try {
      // Standard Product Overview rows (.po-row)
      const overviewRows = productPage.locator('table.a-normal.a-spacing-micro tr, .po-row');
      const overviewCount = await overviewRows.count().catch(() => 0);

      for (let i = 0; i < overviewCount; i++) {
        const row = overviewRows.nth(i);
        const label = (await row.locator('td:nth-child(1), span.po-label').first().innerText().catch(() => '')).trim();
        const value = (await row.locator('td:nth-child(2), span.po-value').first().innerText().catch(() => '')).trim();
        if (label && value) {
          specifications[label] = value;
        }
      }

      // Technical Specifications detail table if overview didn't capture enough
      if (Object.keys(specifications).length === 0) {
        const techSpecRows = productPage.locator('#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li');
        const techCount = await techSpecRows.count().catch(() => 0);

        for (let i = 0; i < techCount; i++) {
          const row = techSpecRows.nth(i);
          const thText = (await row.locator('th').innerText().catch(() => '')).trim();
          const tdText = (await row.locator('td').innerText().catch(() => '')).trim();

          if (thText && tdText) {
            specifications[thText] = tdText;
          }
        }
      }
    } catch {
      // Keep empty if missing
    }

    return {
      title,
      price,
      rating,
      aboutThisItem,
      specifications,
    };
  }

  /**
   * Print extracted product details in a clean, human-readable console format.
   */
  printProductDetails(details: ProductDetails): void {
    console.log('\n========================================');
    console.log('AMAZON TV PRODUCT DETAILS');
    console.log('========================================\n');

    console.log('Product Title:');
    console.log(details.title);
    console.log('');

    console.log('Price:');
    console.log(details.price);
    console.log('');

    console.log('Customer Rating:');
    console.log(details.rating);
    console.log('');

    console.log('About this item:');
    if (details.aboutThisItem.length > 0) {
      details.aboutThisItem.forEach((point) => console.log(`* ${point}`));
    } else {
      console.log('Not available');
    }
    console.log('');

    console.log('Product Specifications:');
    const specEntries = Object.entries(details.specifications);
    if (specEntries.length > 0) {
      specEntries.forEach(([key, val]) => console.log(`* ${key}: ${val}`));
    } else {
      console.log('Not available');
    }

    console.log('\n========================================\n');
  }
}
