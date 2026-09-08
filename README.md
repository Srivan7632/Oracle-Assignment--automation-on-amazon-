# Amazon TV Playwright & TypeScript Automation

This repository contains an end-to-end browser automation suite built using **Playwright** and **TypeScript** to perform automated product searching, dynamic filter application, and product data extraction on **Amazon India** (`https://www.amazon.in`).

---

## Technical Stack

- **Framework**: [Playwright](https://playwright.dev/) (`@playwright/test`)
- **Language**: TypeScript (`^5.7.2`)
- **Runtime**: Node.js (ES2022 / CommonJS)
- **Browser Engine**: Chromium

---

## Features & Automation Highlights

1. **Positional Brand Parameterization**:
   - Easily pass any 2 custom brand names directly after `npm start --` (e.g. `npm start -- "samsung" "sony"` or `npm start -- "tcl" "lg"`).
   - Dynamically selects requested brands and extracts product information.
   - Defaults to `Samsung` and `Sony` if no brand arguments are passed (`npm start`).
2. **Overlay & Dialog Management**: Conditionally handles initial location/pincode banners and cookie consent popups without failing test execution.
3. **Dynamic Screen-Size Filtering**: Searches and selects available 50-inch or 55-inch TV screen size filters from Amazon's refinement sidebar.
4. **Organic Product Identification**: Skips sponsored/advertisement items in search results to select the first genuine organic product.
5. **Multi-Tab Context Handling**: Intercepts and switches context smoothly when Amazon opens product links in a new browser tab (`target="_blank"`).
6. **Data Extraction & Graceful Degradation**: Extracts title, price, rating, bullet points under "About this item", and product specifications table, returning `"Not available"` cleanly if an optional section is missing.

---

## Project Structure

```
amazon-tv-automation/
├── pages/
│   └── amazonPage.ts          # Page Object Model encapsulating locators, filter logic, & extraction
├── tests/
│   └── amazon-tv.spec.ts      # End-to-end test scenario execution with CLI parameter parsing
├── run.js                     # CLI wrapper script enabling npm start -- "brand1" "brand2" syntax
├── package.json               # Node.js dependencies and run scripts
├── playwright.config.ts       # Playwright browser, viewport, and execution settings
├── tsconfig.json              # TypeScript compilation setup
└── README.md                  # Project documentation
```

---

## Installation & Setup

1. **Navigate to project directory**:
   ```bash
   cd "Oracle Assignment (automation on amazon)"
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright Chromium Browser**:
   ```bash
   npx playwright install chromium
   ```

---

## How to Run the Automation Test

### 1. Run with Custom Positional Brand Parameters
Pass any two brand names directly in quotes after `npm start --`:

```bash
npm start -- "samsung" "sony"
```
```bash
npm start -- "tcl" "lg"
```
```bash
npm start -- "redmi" "xiaomi"
```

---

### 2. Default Run (Default Brands: Samsung & Sony)
If no arguments are passed, it automatically selects Samsung and Sony:

```bash
npm start
```

---

### 3. Headed Mode (Visual Debugging / Demo)
Runs the test with browser UI visible on screen:
```bash
npm run test:headed
```

### 4. Debug Mode (Step-by-step Execution)
```bash
npm run test:debug
```

---

## Automation Execution Flow

```mermaid
flowchart TD
    A[Navigate to Amazon India] --> B[Dismiss Banners / Location Banners]
    B --> C[Search 'TV' in Search Bar]
    C --> D[Apply Screen Size Filter: 50" / 55"]
    D --> E[Select 2 Requested TV Brands via npm start -- 'brand1' 'brand2']
    E --> F[Skip Sponsored Cards & Select 1st Organic TV Result]
    F --> G[Switch Context to Product Detail Tab]
    G --> H[Extract Title, Price, Rating, 'About item', Specs]
    H --> I[Print Formatted Summary to Console]
```

---

## Example Console Output

```
Starting test runner...
Brand arguments passed: "tcl" "lg"

Target preferred brands configured: tcl, lg
Navigating to Amazon India (https://www.amazon.in)...
Searching for: "TV"
Search results page loaded successfully.
Applying screen size filter for: 50", 55"
Screen size filter "55 Inches" applied successfully.
Attempting to select brands (Preferring: tcl, lg)...
Selecting preferred brand: tcl
Selecting preferred brand: lg
Brands actually applied: tcl, lg
Locating first valid (non-sponsored) TV product...
Selected organic product: "LG 139 cm (55 inches) 4K Ultra HD Smart LED TV..."
Extracting product details...

========================================
AMAZON TV PRODUCT DETAILS
========================================

Product Title:
LG 139 cm (55 inches) 4K Ultra HD Smart LED TV 55UR7500PSC (Dark Iron Gray)

Price:
₹42,990

Customer Rating:
4.3 out of 5 stars

About this item:
* Resolution: 4K Ultra HD (3840x2160) | Refresh Rate: 60 Hertz
* Connectivity: Wi-Fi (Built-in) | 3 HDMI ports...
* Sound: 20 Watts Output | 2.0 Ch Speaker...
* Smart TV Features: WebOS Smart TV | AI Brightness Control...
* Display: 4K Ultra HD LED | Slim Design...

Product Specifications:
* Brand: LG
* Resolution: 4K
* Refresh Rate: 60 Hz
* Aspect Ratio: 16:9
* Product Dimensions: 23D x 123.5W x 78H Centimeters

========================================
```
