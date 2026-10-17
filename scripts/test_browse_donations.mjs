import { chromium } from '@playwright/test'

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage()

  try {
    console.log('Navigating to http://localhost:4174/browse-donations...')
    await page.goto('http://localhost:4174/browse-donations', { waitUntil: 'networkidle' })

    // Check header
    const topBar = await page.textContent('header')
    console.log('TopBar text:', topBar)
    if (!topBar?.includes('Browse Donations')) {
      throw new Error(`Expected Browse Donations in header, got ${topBar}`)
    }

    // Check search input
    const searchInput = await page.locator('input[placeholder="Search donations by item name..."]')
    await searchInput.waitFor({ state: 'visible' })
    console.log('Search input is visible')

    // Check cards exist
    const cards = await page.locator('.rounded-card')
    const count = await cards.count()
    console.log(`Found ${count} donation cards`)
    if (count === 0) {
      throw new Error('Expected at least 1 donation card')
    }

    // Inspect first card content
    const firstCardText = await cards.first().innerText()
    console.log('First card text snippet:\n', firstCardText)

    // Test Search filtering
    console.log('Searching for "Water"...')
    await searchInput.fill('Water')
    await page.waitForTimeout(300)

    const filteredCards = await page.locator('.rounded-card')
    const filteredCount = await filteredCards.count()
    console.log(`Filtered card count: ${filteredCount}`)
    const filteredText = await filteredCards.first().innerText()
    if (!filteredText.toLowerCase().includes('water')) {
      throw new Error(`Filtered card does not contain Water: ${filteredText}`)
    }

    // Test non-matching search
    console.log('Searching for "NonExistentItem"...')
    await searchInput.fill('NonExistentItem')
    await page.waitForTimeout(300)
    const emptyHeading = await page.textContent('h3')
    console.log('Empty state heading:', emptyHeading)
    if (!emptyHeading?.includes('No donations found')) {
      throw new Error(`Expected "No donations found", got ${emptyHeading}`)
    }

    // Test Sidebar navigation link on desktop
    await page.setViewportSize({ width: 1280, height: 800 })
    const donationsNav = page.locator('a[href="/browse-donations"]')
    const isNavVisible = await donationsNav.first().isVisible()
    console.log('Sidebar Donations link visible:', isNavVisible)

    console.log('ALL CHECKS PASSED!')
  } catch (err) {
    console.error('Test failed:', err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

run()
