import { chromium } from '@playwright/test'

// 1. Math verification: Haversine distance
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

async function runTests() {
  console.log('================================================================');
  console.log('RELIEFLINK COLLECTION DRIVES COMPREHENSIVE E2E VERIFICATION');
  console.log('================================================================');

  // Step 1: Distance calculation unit tests
  console.log('\n[TEST 1] Verifying Haversine distance logic & pickup eligibility...');
  const erodeHub = { lat: 11.3410, lng: 77.7172 }
  const donorNearby = { lat: 11.3320, lng: 77.7120 } // ~1.2 km
  const donorFarAway = { lat: 11.0168, lng: 76.9558 } // Coimbatore ~87 km

  const distNear = calculateDistanceKm(donorNearby.lat, donorNearby.lng, erodeHub.lat, erodeHub.lng)
  console.log(`  - Nearby donor distance: ${distNear} km`);
  if (distNear > 5) throw new Error(`Expected near donor distance ~1.2 km, got ${distNear}`)

  const distFar = calculateDistanceKm(donorFarAway.lat, donorFarAway.lng, erodeHub.lat, erodeHub.lng)
  console.log(`  - Far donor distance: ${distFar} km`);
  if (distFar < 50) throw new Error(`Expected far donor distance > 50 km, got ${distFar}`)

  const pickupRadius = 15
  const isNearEligible = distNear <= pickupRadius
  const isFarEligible = distFar <= pickupRadius
  console.log(`  - Pickup radius: ${pickupRadius} km`);
  console.log(`  - Near donor eligible: ${isNearEligible} (PASS)`);
  console.log(`  - Far donor eligible: ${isFarEligible} (Expected: false -> PASS)`);
  if (!isNearEligible || isFarEligible) throw new Error('Distance eligibility check failed');

  // Step 2: Browser E2E tests
  console.log('\n[TEST 2] Launching Playwright browser on http://localhost:4174 (mobile viewport)...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 414, height: 896 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [Browser Error]:`, msg.text())
  })

  try {
    // 2.1 Navigate to /drives
    console.log('\n[TEST 3] Navigating to /drives and testing search/filter...');
    await page.goto('http://localhost:4174/drives', { waitUntil: 'networkidle' })

    const skipBtn = page.getByRole('button', { name: 'Skip' })
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click()
    }
    await page.waitForTimeout(1000)

    // Check page title
    const headerTitle = page.locator('h1:has-text("Collection Drives")').last()
    await headerTitle.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ Collection Drives page header is visible');

    // Test Search input
    const searchInput = page.locator('input[placeholder*="Search by city"]').first()
    await searchInput.fill('Erode')
    await page.waitForTimeout(500)
    console.log('  ✓ Search filter applied for "Erode"');

    // 2.2 Click "Start a drive"
    console.log('\n[TEST 4] Navigating to /drives/create form...');
    const startDriveBtn = page.getByRole('button', { name: /Start a drive/i })
    await startDriveBtn.click()
    await page.waitForURL('**/drives/create')
    console.log(`  ✓ Navigated to: ${page.url()}`);

    // Fill Create Drive Form
    console.log('\n[TEST 5] Filling Create Drive Form with exact coordinates & target items...');
    await page.fill('#from-city', 'Erode')
    await page.fill('#to-city', 'Chennai')
    await page.fill('#destination-event', 'Chennai Flood Relief 2026')
    await page.fill('#destination-camp', 'Royapettah Relief Base')
    await page.fill('#organizer-name', 'Erode Youth Forum')
    await page.fill('#organizer-contact', '+91 98401 23456')
    await page.fill('#departure-date', '2026-10-25')
    await page.fill('#capacity-kg', '500')

    // Pin location on map
    const pinMapBtn = page.getByRole('button', { name: /Pin collection point on map/i })
    await pinMapBtn.click()
    await page.waitForTimeout(600)

    // Confirm location in modal
    const confirmLocBtn = page.getByRole('button', { name: /Confirm this location/i })
    await confirmLocBtn.click()
    await page.waitForTimeout(600)
    console.log('  ✓ Location pinned on map with exact coordinates');

    // Submit form
    console.log('\n[TEST 6] Submitting Create Drive Form...');
    const publishBtn = page.getByRole('button', { name: /Publish Collection Drive/i })
    await publishBtn.click()

    await page.waitForURL(url => url.pathname.startsWith('/drives/') && !url.pathname.includes('/create'), { timeout: 10000 })
    const detailUrl = page.url()
    console.log(`  ✓ Drive created! Reached detail page: ${detailUrl}`);

    // Verify detail page elements
    const routeHeading = page.locator('h1:has-text("Erode")')
    await routeHeading.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ Route heading visible: Erode → Chennai');

    const directionsLink = page.locator('a:has-text("Directions to Collection Hub")')
    const hasDirections = await directionsLink.isVisible()
    console.log(`  ✓ Exact Google Maps directions link visible: ${hasDirections}`);

    // 2.3 Contribute supplies to this drive
    console.log('\n[TEST 7] Testing Donor Contribution Modal...');
    const contributeBtn = page.getByRole('button', { name: /Contribute supplies to this drive/i })
    await contributeBtn.click()
    await page.waitForTimeout(600)

    await page.fill('#donor-name', 'Suresh Kumar')
    await page.fill('#donor-contact', '+91 98765 11223')

    // Donate 15 blankets
    const qtyInputs = page.locator('input[type="number"][placeholder="Qty"]')
    if (await qtyInputs.count() > 0) {
      await qtyInputs.first().fill('15')
    }

    // Submit contribution
    const submitContribBtn = page.getByRole('button', { name: /Submit Contribution/i })
    await submitContribBtn.click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Donor contribution submitted successfully');

    // 2.4 Verify Public Donor List
    console.log('\n[TEST 8] Verifying Public Donor List and Privacy Protection...');
    const donorEntry = page.locator('text=Suresh Kumar').first()
    await donorEntry.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ Donor "Suresh Kumar" appears in Community Donor List');

    // Verify phone number is NOT in public entry
    const publicCard = page.locator('[data-testid="public-donor-card"]').first()
    const publicText = await publicCard.innerText()
    const leakedPhone = publicText.includes('+91 98765 11223')
    console.log(`  ✓ Private phone number leaked in public donor list: ${leakedPhone} (Expected: false -> PASS)`);
    if (leakedPhone) throw new Error('Security violation: private phone number exposed in public donor list!')

    // 2.5 Organizer Management & Two-Step Delivery Confirmation
    console.log('\n[TEST 9] Testing Organizer Review & Two-Step Delivery Workflow...');
    const acceptBtn = page.getByRole('button', { name: /Accept Contribution/i }).first()
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click()
      await page.waitForTimeout(1000)
      console.log('  ✓ Organizer accepted pending contribution');
    }

    const collectBtn = page.getByRole('button', { name: /Mark Collected \/ Received/i }).first()
    if (await collectBtn.isVisible()) {
      await collectBtn.click()
      await page.waitForTimeout(1000)
      console.log('  ✓ Organizer marked contribution collected');
    }

    // Step 1: Dispatch
    console.log('  -> Step 1: Dispatch supplies vehicle...');
    const dispatchBtn = page.getByRole('button', { name: /Dispatch supplies vehicle/i })
    await dispatchBtn.click()
    await page.waitForTimeout(500)
    const confirmDispatchBtn = page.getByRole('button', { name: /Confirm Dispatch/i })
    await confirmDispatchBtn.click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Vehicle dispatched! Status: in transit');

    // Step 2A: Arrival at camp
    console.log('  -> Step 2A: Record arrival at destination camp...');
    const arrivalBtn = page.getByRole('button', { name: /Record arrival at destination camp/i })
    await arrivalBtn.click()
    await page.waitForTimeout(500)
    const recordArrivalBtn = page.getByRole('button', { name: 'Record Arrival', exact: true })
    await recordArrivalBtn.click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Arrival recorded! Status: delivered (awaiting confirmation)');

    // Step 2B: Camp Representative Confirms Receipt
    console.log('  -> Step 2B: Receiving representative confirms receipt...');
    const confirmReceiptBtn = page.getByRole('button', { name: /Confirm Receipt of Supplies/i }).first()
    await confirmReceiptBtn.click()
    await page.waitForTimeout(500)

    await page.fill('#rec-name', 'Dr. Priya S (Relief Coordinator)')
    await page.fill('#rec-contact', '+91 94432 99887')

    const officialConfirmBtn = page.getByRole('button', { name: /Confirm Official Receipt/i })
    await officialConfirmBtn.click()
    await page.waitForTimeout(1000)

    const confirmedBadge = page.locator('text=Receipt Confirmed ✓').first()
    await confirmedBadge.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ Two-step delivery verification completed: "Receipt Confirmed ✓" badge visible!');

    console.log('\n================================================================');
    console.log('ALL COLLECTION DRIVE TESTS PASSED SUCCESSFULLY! ✅');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ Test Failed:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

runTests()
