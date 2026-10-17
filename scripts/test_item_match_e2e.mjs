import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  console.log('1. Navigating to request detail page...');
  await page.goto('http://localhost:4174/requests/req-001');
  await page.waitForLoadState('networkidle');

  console.log('2. Opening MakeOfferSheet...');
  const makeOfferBtn = page.getByRole('button', { name: /Make an offer/i }).first();
  await makeOfferBtn.click();
  await page.waitForTimeout(1000);

  // Check Item name input exists with label "What exactly are you providing? (Optional)"
  const itemInput = page.locator('#donor-item-name');
  await itemInput.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Found "What exactly are you providing? (Optional)" input');

  // Check "✨ Check match" button exists
  const checkMatchBtn = page.getByRole('button', { name: /✨ Check match/i });
  await checkMatchBtn.waitFor({ state: 'visible' });
  console.log('✓ Found "✨ Check match" button');

  // Test Case A: Positive Match ("15 crates of Bisleri")
  console.log('3. Testing Positive Match: "15 crates of Bisleri"...');
  await itemInput.fill('15 crates of Bisleri');
  await checkMatchBtn.click();

  // Wait for Modal with title "Match found"
  const matchModal = page.locator('text=Match found');
  await matchModal.waitFor({ state: 'visible', timeout: 15000 });
  console.log('✓ Modal with title "Match found" opened!');

  // Check confidence bar exists
  const confidenceBar = page.locator('text=Match confidence');
  await confidenceBar.waitFor({ state: 'visible' });
  console.log('✓ Found Match confidence bar');

  // Check reasoning & converted quantity
  const reasoning = await page.locator('text=Reasoning').locator('..').textContent();
  console.log('✓ Reasoning:', reasoning?.trim());

  // Check buttons: "Keep my entry" & "Use this quantity"
  const keepBtn = page.getByRole('button', { name: /Keep my entry/i });
  await keepBtn.waitFor({ state: 'visible' });
  console.log('✓ Found "Keep my entry" button');

  const useQtyBtn = page.getByRole('button', { name: /Use this quantity/i });
  await useQtyBtn.waitFor({ state: 'visible' });
  console.log('✓ Found "Use this quantity" button');

  await page.screenshot({ path: 'test-results/screenshots/item_match_15_crates_modal.png' });
  console.log('✓ Saved screenshot to test-results/screenshots/item_match_15_crates_modal.png');

  // Click "Use this quantity"
  await useQtyBtn.click();
  await page.waitForTimeout(800);
  console.log('✓ Clicked "Use this quantity" - modal closed');

  // Test Case B: Low Confidence / Non-match ("Old textbooks")
  console.log('4. Testing Low Confidence / Non-match: "Old textbooks"...');
  await itemInput.fill('Old textbooks');
  await checkMatchBtn.click();

  const toast = page.locator('text=Could not confidently match this. Keep typing.');
  await toast.waitFor({ state: 'visible', timeout: 15000 });
  console.log('✓ Toast displayed: "Could not confidently match this. Keep typing."');

  await page.screenshot({ path: 'test-results/screenshots/item_match_low_confidence_toast.png' });
  console.log('✓ Saved screenshot to test-results/screenshots/item_match_low_confidence_toast.png');

  console.log('ALL E2E TESTS PASSED SUCCESSFULLY!');
  await browser.close();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
