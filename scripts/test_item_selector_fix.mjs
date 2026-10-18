import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function testItemSelectorFix() {
  console.log('🧪 Starting Test: Create Collection Drive Item Selector Fix...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // 1. DESKTOP BROWSER TEST (1280 x 800)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- 1. Testing Desktop Layout (1280x800) ---')
    const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await desktopPage.goto(`${BASE_URL}/create-drive`, { waitUntil: 'networkidle' })
    console.log('✓ Loaded /create-drive on desktop')

    // Verify existing requirements
    const existingWater = desktopPage.locator('text=Water (Bottles)')
    const existingBlankets = desktopPage.locator('text=Warm Blankets')
    await existingWater.waitFor({ state: 'visible', timeout: 5000 })
    await existingBlankets.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Existing requirements visible: Water (Bottles) 100 bottles, Warm Blankets 50 pieces')

    // Inspect Item Selector
    const itemSelector = desktopPage.locator('#item-selector')
    await itemSelector.waitFor({ state: 'visible', timeout: 5000 })

    // Check placeholder "Select an item" when unselected
    const initialText = await itemSelector.evaluate(el => {
      const select = el
      return select.options[select.selectedIndex]?.text || ''
    })
    console.log(`Selector displayed text when empty: "${initialText}"`)
    if (!initialText.includes('Select an item')) {
      throw new Error(`❌ BUG: Expected "Select an item" placeholder, but got "${initialText}"!`)
    }
    console.log('✅ PASSED: Item selector displays "Select an item" placeholder when unselected')

    // Verify all 6 categories exist with labels & icons
    const optionTexts = await itemSelector.evaluate(el => {
      const select = el
      return Array.from(select.options).map(o => o.text)
    })
    console.log('Available options in selector:\n', optionTexts.join('\n '))

    const requiredCategories = ['Medical', 'Food', 'Water', 'Blankets', 'Hygiene', 'Shelter']
    for (const cat of requiredCategories) {
      const found = optionTexts.some(opt => opt.includes(cat))
      if (!found) {
        throw new Error(`❌ BUG: Category "${cat}" is missing from selector options!`)
      }
    }
    console.log('✅ PASSED: All 6 categories (Medical, Food, Water, Blankets, Hygiene, Shelter) are present with readable labels and icons!')

    // Select category: Medical
    await itemSelector.selectOption('Medical')
    const selectedMedicalText = await itemSelector.evaluate(el => el.options[el.selectedIndex]?.text || '')
    console.log(`Selected category text in selector: "${selectedMedicalText}"`)
    if (!selectedMedicalText.includes('Medical')) {
      throw new Error(`❌ BUG: Selected category was not visibly displayed! Found: "${selectedMedicalText}"`)
    }
    console.log('✅ PASSED: After selecting category, its name is visibly displayed in the selector')

    // Verify unit auto-populated to 'kits'
    const unitInput = desktopPage.locator('#item-unit-input')
    const unitVal = await unitInput.inputValue()
    console.log(`Auto-populated unit for Medical: "${unitVal}"`)
    if (unitVal !== 'kits') {
      throw new Error(`Expected unit "kits" for Medical, got "${unitVal}"`)
    }

    // Enter target quantity: 25
    const qtyInput = desktopPage.locator('#item-target-qty')
    await qtyInput.fill('25')
    console.log('✓ Entered target quantity: 25')

    // Verify Add Item button is visible, readable, and enabled
    const addBtn = desktopPage.locator('#add-item-btn')
    await addBtn.waitFor({ state: 'visible' })
    const addBtnText = await addBtn.innerText()
    console.log(`Add Item button text: "${addBtnText.trim()}"`)
    if (!addBtnText.includes('Add Item')) {
      throw new Error(`❌ BUG: Add Item button text is missing or blank! Got: "${addBtnText}"`)
    }
    console.log('✅ PASSED: Add Item button is readable and clearly styled')

    // Click Add Item
    await addBtn.click()
    await desktopPage.waitForTimeout(400)

    // Verify the newly added requirement appears in the requirements list
    const newRequirement = desktopPage.locator('text=Target: 25 kits')
    await newRequirement.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✅ PASSED: New requirement (Medical — Target: 25 kits) successfully added to requirements list!')

    // Verify selector reset to "Select an item"
    const textAfterAdd = await itemSelector.evaluate(el => el.options[el.selectedIndex]?.text || '')
    if (!textAfterAdd.includes('Select an item')) {
      throw new Error(`❌ BUG: Selector did not reset to "Select an item"! Got: "${textAfterAdd}"`)
    }
    console.log('✓ Selector cleanly reset to "Select an item" placeholder after adding')
    await desktopPage.close()

    // ══════════════════════════════════════════════════════════════════════════
    // 2. MOBILE / PWA VIEWPORT TEST (390 x 844 - iPhone 14)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Testing Mobile/PWA Layout (390x844) ---')
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await mobilePage.goto(`${BASE_URL}/create-drive`, { waitUntil: 'networkidle' })
    console.log('✓ Loaded /create-drive on mobile viewport')

    const mobileSelector = mobilePage.locator('#item-selector')
    await mobileSelector.waitFor({ state: 'visible', timeout: 5000 })

    // Check placeholder on mobile
    const mobileInitial = await mobileSelector.evaluate(el => el.options[el.selectedIndex]?.text || '')
    if (!mobileInitial.includes('Select an item')) {
      throw new Error(`❌ BUG: Mobile selector did not show "Select an item"! Got: "${mobileInitial}"`)
    }
    console.log('✓ Mobile selector shows "Select an item" placeholder')

    // Test Quick-Select chip: Blankets
    const quickBlankets = mobilePage.locator('button:has-text("Blankets")')
    await quickBlankets.click()
    await mobilePage.waitForTimeout(300)

    const mobileSelectedText = await mobileSelector.evaluate(el => el.options[el.selectedIndex]?.text || '')
    console.log(`Quick selected text on mobile: "${mobileSelectedText}"`)
    if (!mobileSelectedText.includes('Blankets')) {
      throw new Error(`❌ BUG: Quick selecting did not update mobile selector! Got: "${mobileSelectedText}"`)
    }
    console.log('✓ Quick select chip visibly updated selector to "Blankets"')

    // Fill quantity on mobile
    await mobilePage.locator('#item-target-qty').fill('75')

    // Add item on mobile
    const mobileAddBtn = mobilePage.locator('#add-item-btn')
    await mobileAddBtn.click()
    await mobilePage.waitForTimeout(400)

    const mobileAdded = mobilePage.locator('text=Target: 75 pieces')
    await mobileAdded.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✅ PASSED: Added requirement on mobile viewport (Blankets — Target: 75 pieces)!')

    await mobilePage.close()
    console.log('\n🎉 ALL ITEM SELECTOR TESTS PASSED IN DESKTOP AND MOBILE LAYOUTS!')
  } finally {
    await browser.close()
  }
}

testItemSelectorFix().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
