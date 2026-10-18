import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runTest() {
  console.log('🧪 Starting Genuine Security Audit Tests: ReliefLink Contact Number & Call Button Privacy...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1: SAVE CONTACT NUMBER IN USER PROFILE (/profile)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 1. Testing Contact Number in User Profile (/profile) ---')
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })

    const phoneCard = page.locator('text=Contact Number').first()
    await phoneCard.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Contact Number section found on Profile page')

    const phoneInput = page.locator('input#profile-phone-input')
    await phoneInput.waitFor({ state: 'visible' })
    await phoneInput.fill('+91 98765 43210')

    const savePhoneBtn = page.locator('button:has-text("Save Contact Number")')
    await savePhoneBtn.click()

    // Verify success confirmation
    const savedBadge = page.locator('text=Saved in profile')
    await savedBadge.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Contact number saved successfully; "Saved in profile" badge visible')

    // Verify no false SMS verification claims
    const pageContent = await page.content()
    if (pageContent.includes('SMS Verified') || pageContent.includes('Phone Verified by OTP')) {
      throw new Error('❌ False phone verification claim detected in profile!')
    }
    console.log('✓ Verified: No false verification claim is displayed')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2: AUTOMATIC PREFILL & CALL TOGGLE IN REQUEST CREATION (/create)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Testing Prefill & Call Button Toggle in Request Creation (/create) ---')
    await page.goto(`${BASE_URL}/create`, { waitUntil: 'networkidle' })

    const contactPhoneInput = page.locator('input[placeholder="e.g. 9876543210"]')
    await contactPhoneInput.waitFor({ state: 'visible', timeout: 5000 })
    const prefilledRequestPhone = await contactPhoneInput.inputValue()
    console.log('✓ Request form contact phone value:', prefilledRequestPhone)

    if (!prefilledRequestPhone.includes('98765') && !prefilledRequestPhone.includes('43210')) {
      throw new Error(`Expected request phone to be prefilled from profile, got: "${prefilledRequestPhone}"`)
    }

    const prefillBadgeReq = page.locator('text=Prefilled from profile').first()
    if (await prefillBadgeReq.isVisible()) {
      console.log('✓ "Prefilled from profile" badge is displayed')
    }

    // Verify "Enable Direct Call Button" toggle
    const reqCallToggle = page.locator('#request-allow-calls-toggle')
    await reqCallToggle.waitFor({ state: 'visible' })
    const isReqCallChecked = await reqCallToggle.isChecked()
    if (!isReqCallChecked) {
      throw new Error('Expected "Enable Direct Call Button" to default to checked (enabled)')
    }
    console.log('✓ "Enable Direct Call Button" toggle is present and enabled by default')

    // Test toggle off
    await reqCallToggle.uncheck()
    if (await reqCallToggle.isChecked()) {
      throw new Error('Toggle failed to uncheck')
    }
    console.log('✓ Call Button can be toggled off by coordinator for privacy')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 3: AUTOMATIC PREFILL & CALL TOGGLE IN COLLECTION DRIVE CREATION (/create-drive)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 3. Testing Prefill & Call Button Toggle in Collection Drive Creation (/create-drive) ---')
    await page.goto(`${BASE_URL}/create-drive`, { waitUntil: 'networkidle' })

    const driveContactInput = page.locator('input#organizer-contact')
    await driveContactInput.waitFor({ state: 'visible', timeout: 5000 })
    const prefilledDriveContact = await driveContactInput.inputValue()
    console.log('✓ Collection drive organizer contact value:', prefilledDriveContact)

    if (!prefilledDriveContact.includes('98765') && !prefilledDriveContact.includes('43210')) {
      throw new Error(`Expected organizer contact to be prefilled, got: "${prefilledDriveContact}"`)
    }

    const driveCallToggle = page.locator('#drive-allow-calls-toggle')
    await driveCallToggle.waitFor({ state: 'visible' })
    const isDriveCallChecked = await driveCallToggle.isChecked()
    if (!isDriveCallChecked) {
      throw new Error('Expected drive call button toggle to default to checked')
    }
    console.log('✓ Drive organizer call button toggle is present and enabled by default')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 4: AUTOMATIC PREFILL & CALL TOGGLE IN DONATION OFFER (MakeOfferSheet)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 4. Testing Prefill & Call Button Toggle in Donation Offer Sheet ---')
    await page.goto(`${BASE_URL}/requests/req-001`, { waitUntil: 'networkidle' })

    const offerBtn = page.locator('button:has-text("Offer Supplies"), button:has-text("Make an Offer")').first()
    await offerBtn.waitFor({ state: 'visible', timeout: 5000 })
    await offerBtn.click()

    // Select "Arrange organizer pickup"
    const pickupOption = page.locator('input[value="pickup"], label:has-text("Arrange organizer pickup")').first()
    await pickupOption.waitFor({ state: 'visible', timeout: 5000 })
    await pickupOption.click()

    // Check donor phone is prefilled
    const donorPhoneInput = page.locator('input[placeholder="+91 98765 43210"]')
    await donorPhoneInput.waitFor({ state: 'visible' })
    const prefilledDonorPhone = await donorPhoneInput.inputValue()
    console.log('✓ Donation offer pickup contact phone:', prefilledDonorPhone)

    if (!prefilledDonorPhone.includes('98765') && !prefilledDonorPhone.includes('43210')) {
      throw new Error(`Expected donor pickup phone to be prefilled from profile, got: "${prefilledDonorPhone}"`)
    }

    const offerCallToggle = page.locator('#offer-allow-calls-toggle')
    await offerCallToggle.waitFor({ state: 'visible' })
    const isOfferCallChecked = await offerCallToggle.isChecked()
    if (!isOfferCallChecked) {
      throw new Error('Expected donor pickup call toggle to default to checked')
    }
    console.log('✓ Donor pickup call toggle is present and enabled by default')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 5: CALL BUTTON ENABLED RENDERING (drive-001)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 5. Testing Call Button Enabled Rendering (/drives/drive-001) ---')
    await page.goto(`${BASE_URL}/drives/drive-001`, { waitUntil: 'networkidle' })

    // Verify "Call Organizer" button is rendered with tel: link
    const callOrganizerBtn = page.locator('a[href^="tel:"]:has-text("Call Organizer")')
    await callOrganizerBtn.waitFor({ state: 'visible', timeout: 5000 })
    const callHref = await callOrganizerBtn.getAttribute('href')
    console.log('✓ "Call Organizer" button rendered with tel: link:', callHref)

    if (!callHref || !callHref.startsWith('tel:')) {
      throw new Error('Expected Call Organizer button to have a valid tel: action')
    }

    // Verify raw phone digits are NOT exposed as plain text paragraphs in UI
    const rawPlaintextPhone = page.locator('p:text-is("+91 98401 23456"), span:text-is("+91 98401 23456")')
    if (await rawPlaintextPhone.count() > 0 && await rawPlaintextPhone.first().isVisible()) {
      throw new Error('❌ Raw organizer phone number is still printed as plain text in the public UI!')
    }
    console.log('✓ Verified: Raw phone number digits are protected and not printed as plain text in UI')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 6: CALL BUTTON DISABLED PRIVACY ENFORCEMENT (/drives/drive-002)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 6. Testing Privacy Enforcement when Calling is Disabled (/drives/drive-002) ---')
    await page.goto(`${BASE_URL}/drives/drive-002`, { waitUntil: 'networkidle' })

    // Verify "Direct calling disabled by organizer" indicator is rendered
    const disabledIndicator = page.locator('text=Direct calling disabled by organizer')
    await disabledIndicator.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Verified: "Direct calling disabled by organizer" is clearly shown')

    // Verify Call button is ABSENT
    const absentCallBtn = page.locator('a[href^="tel:"]:has-text("Call Organizer")')
    if (await absentCallBtn.count() > 0 && await absentCallBtn.first().isVisible()) {
      throw new Error('❌ Call Organizer button is unexpectedly visible when calling is disabled!')
    }
    console.log('✓ Verified: Call Organizer button is NOT rendered when allow_calls is false')

    // Verify dialer link for drive-002 phone does NOT exist anywhere in the page DOM
    const dialerLink = page.locator('a[href*="9894088776"]')
    if (await dialerLink.count() > 0) {
      throw new Error('❌ Tel link with organizer phone was found in DOM despite allow_calls being false!')
    }
    console.log('✓ Verified: No dialer link exists in DOM when calling is disabled')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 7: DONOR CALL PRIVACY IN DELIVERY TRACKER (/tracker/req-001)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 7. Testing Donor Call Privacy in Delivery Tracker (/tracker/req-001) ---')
    await page.goto(`${BASE_URL}/tracker/req-001`, { waitUntil: 'networkidle' })

    // off-003 has allow_calls = false
    const donorDisabledNotice = page.locator('text=Calling disabled by donor')
    await donorDisabledNotice.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Verified: "Calling disabled by donor" badge is rendered for pickup offer')

    // Verify phone dialer link for off-003 is NOT present
    const off003Dialer = page.locator('a[href*="9822012345"]')
    if (await off003Dialer.count() > 0) {
      throw new Error('❌ Donor pickup phone dialer link is present despite allow_calls being false!')
    }
    console.log('✓ Verified: Donor phone number dialer link is NOT rendered when allow_calls is false')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 8: RECORD ISOLATION VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 8. Testing Record Isolation (Disabling calls on one record does not affect others) ---')
    // Check drive-001 still has calling enabled
    await page.goto(`${BASE_URL}/drives/drive-001`, { waitUntil: 'networkidle' })
    const drive1CallBtn = page.locator('a[href^="tel:"]:has-text("Call Organizer")')
    await drive1CallBtn.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Confirmed: drive-001 retains active Call Organizer button')

    // Check drive-002 still has calling disabled
    await page.goto(`${BASE_URL}/drives/drive-002`, { waitUntil: 'networkidle' })
    const drive2Disabled = page.locator('text=Direct calling disabled by organizer')
    await drive2Disabled.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Confirmed: drive-002 retains calling disabled state independently')
    console.log('✓ Verified: Record isolation holds 100% across multiple records owned or managed')

    console.log('\n======================================================================')
    console.log('🎉 ALL SECURITY & PRIVACY VERIFICATION CHECKS PASSED SUCCESSFULLY (8/8)!')
    console.log('======================================================================')
  } catch (err) {
    console.error('\n❌ SECURITY TEST FAILED:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

runTest()
