import { chromium } from '@playwright/test'

async function runTests() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  try {
    console.log('--- 1. Testing Create Request with "TIDEL Park, Coimbatore" Search ---')
    await page.goto('http://localhost:4174/create', { waitUntil: 'networkidle' })

    // Open "Pick on map"
    const pickMapBtn = page.getByRole('button', { name: /Pick on map/i })
    await pickMapBtn.click()

    const searchInput = page.locator('input[placeholder="Search for a place or address"]')
    await searchInput.waitFor({ state: 'visible' })

    // Search for "TIDEL Park, Coimbatore"
    console.log('Searching for "TIDEL Park, Coimbatore"...')
    await searchInput.fill('TIDEL Park, Coimbatore')
    const searchBtn = page.getByRole('button', { name: 'Search' })
    await searchBtn.click()

    // Wait for dropdown results
    const dropdownResult = page.locator('button:has-text("Tidel Park")').first()
    await dropdownResult.waitFor({ state: 'visible', timeout: 10000 })
    console.log('Selecting "Tidel Park" from dropdown results...')
    await dropdownResult.click()

    // Click "Confirm this location"
    const confirmBtn = page.getByRole('button', { name: /Confirm this location/i })
    await confirmBtn.click()

    // Verify the location input on the Create form
    const locationInput = page.locator('input[placeholder="e.g. Kothrud, Pune"]')
    const locationVal = await locationInput.inputValue()
    console.log('Location field populated with:', locationVal)

    if (locationVal.includes('Ward 37') || !locationVal.toLowerCase().includes('tidel park')) {
      throw new Error(`Location bug reproduced! Expected Tidel Park, got: ${locationVal}`)
    }

    // Fill in other required fields and submit to test DB save & reload
    console.log('\n--- 2. Submitting Request and Verifying Saved Record Display ---')
    await page.locator('input[placeholder="e.g. Drinking water for 200 families"]').fill('TIDEL Park QA Relief Supplies')
    await page.locator('input[placeholder="e.g. Ramesh Kumar"]').fill('Ravi Kumar')
    await page.locator('input[placeholder="e.g. 9876543210"]').fill('9876543210')
    await page.locator('input[placeholder="e.g. Drinking water"]').fill('Bottled Water')
    await page.locator('input[placeholder="e.g. 200"]').fill('100')

    const submitBtn = page.getByRole('button', { name: /Submit Request/i })
    await submitBtn.click()

    // Click "View on Browse"
    const viewBrowseBtn = page.getByRole('button', { name: /View on Browse/i })
    await viewBrowseBtn.waitFor({ state: 'visible', timeout: 15000 })
    await viewBrowseBtn.click()

    await page.waitForURL(/\/browse/, { timeout: 10000 })
    console.log('Navigated to Browse feed!')

    // Find our newly created request card with TIDEL Park
    const tidelCard = page.locator('article, .rounded-card').filter({ hasText: 'TIDEL Park QA Relief Supplies' }).first()
    await tidelCard.waitFor({ state: 'visible', timeout: 10000 })
    const tidelCardText = await tidelCard.innerText()
    console.log('Browse card location text snippet:\n', tidelCardText.substring(0, 150))

    if (tidelCardText.includes('Ward 37') || !tidelCardText.toLowerCase().includes('tidel park')) {
      throw new Error(`Browse card displayed wrong location: ${tidelCardText}`)
    }

    // Click into Request Detail
    await tidelCard.click()
    await page.waitForURL(/\/requests\/.+/, { timeout: 10000 })
    console.log('Navigated to detail page:', page.url())

    // Check displayed location on the detail page
    const displayedLocation = await page.locator('.space-y-1 .font-medium').textContent()
    console.log('Detail page displayed location:', displayedLocation)

    if (displayedLocation?.includes('Ward 37') || !displayedLocation?.toLowerCase().includes('tidel park')) {
      throw new Error(`Detail page displayed wrong location: ${displayedLocation}`)
    }

    // Check Google Maps Directions link coordinates
    const directionsLink = await page.locator('a:has-text("Get directions")').getAttribute('href')
    console.log('Directions URL:', directionsLink)
    if (!directionsLink?.includes('destination=11.') || !directionsLink?.includes('77.')) {
      throw new Error(`Directions link does not have actual latitude/longitude: ${directionsLink}`)
    }

    console.log('\n--- 3. Testing a Different Coimbatore Location ("Peelamedu, Coimbatore") ---')
    await page.goto('http://localhost:4174/create', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Pick on map/i }).click()
    const searchInput2 = page.locator('input[placeholder="Search for a place or address"]')
    await searchInput2.waitFor({ state: 'visible' })
    await searchInput2.fill('Peelamedu, Coimbatore')
    await page.getByRole('button', { name: 'Search' }).click()

    const peelameduResult = page.locator('button:has-text("Peelamedu")').first()
    await peelameduResult.waitFor({ state: 'visible', timeout: 10000 })
    await peelameduResult.click()
    await page.getByRole('button', { name: /Confirm this location/i }).click()

    const peelameduVal = await locationInput.inputValue()
    console.log('Peelamedu location field value:', peelameduVal)
    if (peelameduVal.includes('Ward 37') || !peelameduVal.toLowerCase().includes('peelamedu')) {
      throw new Error(`Expected Peelamedu without Ward 37, got: ${peelameduVal}`)
    }

    console.log('\n--- 4. Testing Location Outside Coimbatore ("Connaught Place, New Delhi") ---')
    await page.getByRole('button', { name: /Pick on map/i }).click()
    const searchInput3 = page.locator('input[placeholder="Search for a place or address"]')
    await searchInput3.waitFor({ state: 'visible' })
    await searchInput3.fill('Connaught Place, New Delhi')
    await page.getByRole('button', { name: 'Search' }).click()

    const delhiResult = page.locator('button:has-text("Connaught Place")').first()
    await delhiResult.waitFor({ state: 'visible', timeout: 10000 })
    await delhiResult.click()
    await page.getByRole('button', { name: /Confirm this location/i }).click()

    const delhiVal = await locationInput.inputValue()
    console.log('Delhi location field value:', delhiVal)
    if (!delhiVal.toLowerCase().includes('connaught place')) {
      throw new Error(`Expected Connaught Place, got: ${delhiVal}`)
    }

    console.log('\nALL LOCATION BUG FIX ACCEPTANCE TESTS PASSED! ✅')
  } catch (err) {
    console.error('Test failed:', err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

runTests()
