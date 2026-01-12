# E2E Tests Design
*Created: 2026-01-09*

## Overview

Add end-to-end testing with Playwright to verify critical user flows work correctly. E2E tests catch integration issues that unit tests miss.

**Estimated time:** 12-16 hours

**Key flows to test:**
1. Wallet connection via WalletConnect
2. ENS address entry and resolution
3. Collection fetching and display
4. Collection selection
5. Kindred spirit analysis
6. Results display and interaction

## Part 1: Playwright Setup (~2-3h)

### Installation

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

### Directory Structure

```
e2e/
├── fixtures/
│   ├── test-data.ts        # Test addresses, collections
│   └── mocks.ts            # API mock handlers
├── pages/
│   ├── home.page.ts        # Page object for home
│   └── results.page.ts     # Page object for results
├── tests/
│   ├── ens-input.spec.ts
│   ├── collection-fetch.spec.ts
│   ├── collection-selection.spec.ts
│   ├── analysis.spec.ts
│   └── smoke.spec.ts
└── global-setup.ts
```

---

## Part 2: Test Fixtures & Page Objects (~2h)

### Test Data

```typescript
// e2e/fixtures/test-data.ts

export const TEST_ADDRESSES = {
  // Well-known addresses with predictable NFT holdings
  VITALIK: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  VITALIK_ENS: 'vitalik.eth',

  // Address with known POAP holdings
  POAP_HOLDER: '0x...',

  // Address with ERC-20 holdings on Base
  BASE_TOKEN_HOLDER: '0x...',
};

export const KNOWN_COLLECTIONS = {
  // Collections these addresses are known to hold
  CRYPTOPUNKS: {
    contract: '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB',
    network: 'eth',
    name: 'CryptoPunks',
  },
};
```

### Page Objects

```typescript
// e2e/pages/home.page.ts
import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly ensInput: Locator;
  readonly connectWalletButton: Locator;
  readonly collectionTable: Locator;
  readonly analyzeButton: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.ensInput = page.getByPlaceholder(/address|ens/i);
    this.connectWalletButton = page.getByRole('button', { name: /connect/i });
    this.collectionTable = page.locator('[data-testid="collection-table"]');
    this.analyzeButton = page.getByRole('button', { name: /find kindred/i });
    this.loadingSpinner = page.locator('[data-testid="loading"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async enterAddress(address: string) {
    await this.ensInput.fill(address);
    await this.ensInput.press('Enter');
  }

  async waitForCollections() {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 });
    await this.collectionTable.waitFor({ state: 'visible' });
  }

  async selectCollection(name: string) {
    const row = this.collectionTable.locator(`tr:has-text("${name}")`);
    await row.locator('input[type="checkbox"]').check();
  }

  async getCollectionCount(): Promise<number> {
    return this.collectionTable.locator('tbody tr').count();
  }

  async clickAnalyze() {
    await this.analyzeButton.click();
  }
}
```

```typescript
// e2e/pages/results.page.ts
import { Page, Locator } from '@playwright/test';

export class ResultsPage {
  readonly page: Page;
  readonly resultsTable: Locator;
  readonly resultRows: Locator;
  readonly progressBar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.resultsTable = page.locator('[data-testid="results-table"]');
    this.resultRows = this.resultsTable.locator('tbody tr');
    this.progressBar = page.locator('[data-testid="analysis-progress"]');
  }

  async waitForResults() {
    await this.progressBar.waitFor({ state: 'hidden', timeout: 120000 });
    await this.resultsTable.waitFor({ state: 'visible' });
  }

  async getResultCount(): Promise<number> {
    return this.resultRows.count();
  }

  async clickResult(index: number) {
    await this.resultRows.nth(index).click();
  }
}
```

---

## Part 3: API Mocking (~2h)

For reliable tests, mock external API responses:

```typescript
// e2e/fixtures/mocks.ts
import { Page, Route } from '@playwright/test';

export async function mockAlchemyApi(page: Page) {
  await page.route('**/api/alchemy/**', async (route: Route) => {
    const url = route.request().url();

    if (url.includes('/collections')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collections: [
            { contract: '0x123', network: 'eth', name: 'Mock NFT 1' },
            { contract: '0x456', network: 'polygon', name: 'Mock NFT 2' },
          ],
        }),
      });
    } else if (url.includes('/owners-count')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1500 }),
      });
    } else {
      await route.continue();
    }
  });
}

export async function mockPoapApi(page: Page) {
  await page.route('**/api/poap**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        events: [
          { id: 1, name: 'ETHDenver 2024', image_url: 'https://...' },
        ],
      }),
    });
  });
}

export async function mockFarcasterApi(page: Page) {
  await page.route('**/api/socials/farcaster**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        socials: [
          {
            dappName: 'farcaster',
            profileName: 'testuser',
            profileImage: 'https://...',
            followerCount: 100,
          },
        ],
      }),
    });
  });
}
```

---

## Part 4: Test Suites (~8-12h)

### Smoke Test

```typescript
// e2e/tests/smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ghost context/i);
  });

  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });
});
```

### ENS Input Tests

```typescript
// e2e/tests/ens-input.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { TEST_ADDRESSES } from '../fixtures/test-data';
import { mockAlchemyApi } from '../fixtures/mocks';

test.describe('ENS Input', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    await mockAlchemyApi(page);
    homePage = new HomePage(page);
    await homePage.goto();
  });

  test('accepts valid Ethereum address', async () => {
    await homePage.enterAddress(TEST_ADDRESSES.VITALIK);
    await homePage.waitForCollections();
    expect(await homePage.getCollectionCount()).toBeGreaterThan(0);
  });

  test('accepts valid ENS name', async () => {
    await homePage.enterAddress(TEST_ADDRESSES.VITALIK_ENS);
    await homePage.waitForCollections();
    expect(await homePage.getCollectionCount()).toBeGreaterThan(0);
  });

  test('shows error for invalid address', async ({ page }) => {
    await homePage.enterAddress('invalid-address');
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });

  test('shows error for non-existent ENS', async ({ page }) => {
    await homePage.enterAddress('thisdoesnotexist12345.eth');
    await expect(page.getByText(/not found|error/i)).toBeVisible();
  });
});
```

### Collection Fetching Tests

```typescript
// e2e/tests/collection-fetch.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { mockAlchemyApi, mockPoapApi } from '../fixtures/mocks';

test.describe('Collection Fetching', () => {
  test('displays NFT collections', async ({ page }) => {
    await mockAlchemyApi(page);
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');
    await homePage.waitForCollections();

    await expect(page.getByText('Mock NFT 1')).toBeVisible();
    await expect(page.getByText('Mock NFT 2')).toBeVisible();
  });

  test('displays POAP events', async ({ page }) => {
    await mockAlchemyApi(page);
    await mockPoapApi(page);
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');
    await homePage.waitForCollections();

    await expect(page.getByText('ETHDenver 2024')).toBeVisible();
  });

  test('shows loading state during fetch', async ({ page }) => {
    await mockAlchemyApi(page);
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');

    await expect(homePage.loadingSpinner).toBeVisible();
    await homePage.waitForCollections();
    await expect(homePage.loadingSpinner).not.toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    await page.route('**/api/alchemy/**', (route) =>
      route.fulfill({ status: 500, body: 'Server error' })
    );

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');

    await expect(page.getByText(/error|failed/i)).toBeVisible();
  });
});
```

### Collection Selection Tests

```typescript
// e2e/tests/collection-selection.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { mockAlchemyApi } from '../fixtures/mocks';

test.describe('Collection Selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockAlchemyApi(page);
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');
    await homePage.waitForCollections();
  });

  test('can select a collection', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.selectCollection('Mock NFT 1');

    const checkbox = page.locator('tr:has-text("Mock NFT 1") input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test('can select multiple collections', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.selectCollection('Mock NFT 1');
    await homePage.selectCollection('Mock NFT 2');

    // Verify selection count indicator
    await expect(page.getByText(/2 selected/i)).toBeVisible();
  });

  test('analyze button disabled without selection', async ({ page }) => {
    const homePage = new HomePage(page);
    await expect(homePage.analyzeButton).toBeDisabled();
  });

  test('analyze button enabled with selection', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.selectCollection('Mock NFT 1');
    await expect(homePage.analyzeButton).toBeEnabled();
  });
});
```

### Analysis Tests

```typescript
// e2e/tests/analysis.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { ResultsPage } from '../pages/results.page';
import { mockAlchemyApi, mockFarcasterApi } from '../fixtures/mocks';

test.describe('Kindred Spirit Analysis', () => {
  test('runs analysis and shows results', async ({ page }) => {
    await mockAlchemyApi(page);
    await mockFarcasterApi(page);

    // Mock the analysis endpoint
    await page.route('**/api/analyze-combined-overlap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { address: '0xabc...', sharedCount: 5 },
            { address: '0xdef...', sharedCount: 3 },
          ],
        }),
      });
    });

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');
    await homePage.waitForCollections();
    await homePage.selectCollection('Mock NFT 1');
    await homePage.clickAnalyze();

    const resultsPage = new ResultsPage(page);
    await resultsPage.waitForResults();

    expect(await resultsPage.getResultCount()).toBe(2);
  });

  test('shows progress during analysis', async ({ page }) => {
    await mockAlchemyApi(page);

    // Slow mock to see progress
    await page.route('**/api/analyze-combined-overlap', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      });
    });

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');
    await homePage.waitForCollections();
    await homePage.selectCollection('Mock NFT 1');
    await homePage.clickAnalyze();

    const resultsPage = new ResultsPage(page);
    await expect(resultsPage.progressBar).toBeVisible();
  });

  test('clicking result shows detail modal', async ({ page }) => {
    await mockAlchemyApi(page);
    await mockFarcasterApi(page);

    await page.route('**/api/analyze-combined-overlap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ address: '0xabc123...', sharedCount: 5 }],
        }),
      });
    });

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.enterAddress('0x1234567890abcdef1234567890abcdef12345678');
    await homePage.waitForCollections();
    await homePage.selectCollection('Mock NFT 1');
    await homePage.clickAnalyze();

    const resultsPage = new ResultsPage(page);
    await resultsPage.waitForResults();
    await resultsPage.clickResult(0);

    // Modal should open with address details
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('0xabc123')).toBeVisible();
  });
});
```

---

## Part 5: CI Integration (~1h)

### GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, sloan-updates]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          # Use test API keys or mocks
          NEXT_PUBLIC_PROJECT_ID: ${{ secrets.TEST_WALLETCONNECT_ID }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

---

## Checklist

### Phase 1: Setup (2-3h)
- [ ] Install Playwright
- [ ] Create `playwright.config.ts`
- [ ] Add test scripts to `package.json`
- [ ] Create directory structure
- [ ] Verify `npm run test:e2e` works

### Phase 2: Fixtures & Page Objects (2h)
- [ ] Create `e2e/fixtures/test-data.ts`
- [ ] Create `e2e/fixtures/mocks.ts`
- [ ] Create `e2e/pages/home.page.ts`
- [ ] Create `e2e/pages/results.page.ts`

### Phase 3: Core Tests (6-8h)
- [ ] Create `smoke.spec.ts`
- [ ] Create `ens-input.spec.ts`
- [ ] Create `collection-fetch.spec.ts`
- [ ] Create `collection-selection.spec.ts`
- [ ] Create `analysis.spec.ts`
- [ ] Verify all tests pass

### Phase 4: CI Integration (1h)
- [ ] Create `.github/workflows/e2e.yml`
- [ ] Add test secrets to GitHub
- [ ] Verify CI runs on PR

### Phase 5: Polish (1-2h)
- [ ] Add mobile viewport tests
- [ ] Add accessibility checks
- [ ] Add visual regression tests (optional)
- [ ] Document how to run tests locally

## Success Criteria

- All E2E tests pass locally
- CI runs tests on every PR
- Tests cover happy paths for all major flows
- Tests use mocks for reliable, fast execution
- Test failures produce clear error messages + screenshots
