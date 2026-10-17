import { chromium } from '@playwright/test';

async function run() {
  console.log('Starting Playwright E2E for Collection Drives...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[Browser Error]:`, msg.text());
  });

  try {
    // 1. Visit /drives
    console.log('1. Navigating to http://localhost:4174/drives ...');
    await page.goto('http://localhost:4174/drives', { waitUntil: 'networkidle' });
    
    // Wait for initial splash screen to finish if present
    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await page.waitForTimeout(1000);

    // Check heading
    const titleLocator = page.getByRole('heading', { name: 'Collection Drives' }).first();
    await titleLocator.waitFor({ state: 'visible', timeout: 5000 });
    const title = await titleLocator.textContent();
    console.log(`Page title: "${title?.trim()}"`);
    if (!title?.includes('Collection Drives')) {
      throw new Error(`Expected title to include "Collection Drives", got "${title}"`);
    }

    // Check Start a drive button
    const startBtn = page.getByRole('button', { name: /Start a drive/i });
    if (!(await startBtn.isVisible())) {
      throw new Error('"Start a drive" button not visible on /drives');
    }

    // 2. Click "Start a drive" to go to /drives/create
    console.log('2. Clicking "Start a drive"...');
    await startBtn.click();
    await page.waitForURL('**/drives/create');
    console.log(`Navigated to: ${page.url()}`);

    // Check Create Drive Form elements
    console.log('3. Filling out the Drive creation form...');
    await page.fill('#from-city', 'Erode');
    await page.fill('#to-city', 'Chennai');
    await page.fill('#destination-event', 'Chennai Flood Relief 2026');
    await page.fill('#departure-date', '2026-10-25');
    await page.selectOption('#vehicle-type', 'Truck');
    await page.fill('#capacity-kg', '500');

    // Toggle Needs chips (e.g. Water, Hygiene)
    await page.getByRole('button', { name: 'Water' }).click();
    await page.getByRole('button', { name: 'Hygiene' }).click();

    // Submit form
    console.log('4. Submitting form...');
    const submitBtn = page.getByRole('button', { name: /Start Collection Drive/i });
    await submitBtn.click();

    // 5. Verify redirection to /drives/:id (not /drives/create)
    console.log('5. Waiting for redirect to /drives/:id ...');
    await page.waitForURL(url => url.pathname.startsWith('/drives/') && !url.pathname.includes('/create'), { timeout: 10000 });
    const detailUrl = page.url();
    console.log(`Successfully reached detail URL: ${detailUrl}`);

    // Wait for drive data to load (wait for the Erode text)
    const routeHeading = page.locator('h1:has-text("Erode")');
    await routeHeading.waitFor({ state: 'visible', timeout: 10000 });
    const detailRoute = await routeHeading.textContent();
    console.log(`Drive Route heading: "${detailRoute?.trim()}"`);
    if (!detailRoute?.includes('Erode') || !detailRoute?.includes('Chennai')) {
      throw new Error(`Expected route heading with Erode -> Chennai, got "${detailRoute}"`);
    }

    const eventText = await page.locator('text=Chennai Flood Relief 2026').first().isVisible();
    console.log(`Event text visible: ${eventText}`);
    if (!eventText) throw new Error('Destination event text not found on detail page');

    // Test contribute button and toast
    console.log('6. Testing contribute button...');
    const contributeBtn = page.getByRole('button', { name: /I want to contribute to this drive/i });
    await contributeBtn.click();

    // Wait for toast
    const toast = page.locator('text=Contribution logged! Drop off at the main camp.');
    await toast.waitFor({ timeout: 5000 });
    console.log('Toast notification appeared successfully!');

    // 7. Verify /drives list shows the newly created drive
    console.log('7. Navigating back to /drives to check listing...');
    await page.goto('http://localhost:4174/drives', { waitUntil: 'networkidle' });
    const cardRoute = page.locator('text=Erode → Chennai').first();
    await cardRoute.waitFor({ timeout: 5000 });
    console.log('Found newly created drive card "Erode → Chennai" on /drives!');

    // 8. Test Navigation links (Sidebar / BottomNav)
    console.log('8. Checking sidebar navigation link...');
    const drivesNav = page.locator('a[href="/drives"]').first();
    const isNavVisible = await drivesNav.isVisible();
    console.log(`Drives nav link visible: ${isNavVisible}`);

    console.log('ALL E2E TESTS PASSED SUCCESSFULLY! ✅');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
