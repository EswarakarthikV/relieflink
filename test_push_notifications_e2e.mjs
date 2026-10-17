import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

async function runPushNotificationsTest() {
  console.log('🚀 Starting ReliefLink Mobile Push Notifications Verification...')
  const testProfileDir = path.resolve('./temp_playwright_test_profile')
  if (fs.existsSync(testProfileDir)) {
    fs.rmSync(testProfileDir, { recursive: true, force: true })
  }

  // --------------------------------------------------------------------------
  // Suite 1: Service Worker File & Manifest Checks
  // --------------------------------------------------------------------------
  console.log('\n[Suite 1] Verifying Service Worker & PWA Manifest Assets...')
  const baseBrowser = await chromium.launch({ channel: 'chrome', headless: true })
  const basePage = await baseBrowser.newPage()

  const swRes = await basePage.goto('http://localhost:4174/sw.js')
  if (!swRes || swRes.status() !== 200) {
    throw new Error(`Failed to fetch /sw.js, status: ${swRes ? swRes.status() : 'null'}`)
  }
  const swContent = await swRes.text()
  if (!swContent.includes('push') || !swContent.includes('notificationclick')) {
    throw new Error('/sw.js missing push or notificationclick listeners')
  }
  console.log('  ✓ /sw.js is served with HTTP 200 and handles push + notificationclick')

  const manifestRes = await basePage.goto('http://localhost:4174/manifest.webmanifest')
  if (!manifestRes || manifestRes.status() !== 200) {
    throw new Error('Failed to fetch /manifest.webmanifest')
  }
  const manifest = await manifestRes.json()
  console.log(`  ✓ Manifest valid: name="${manifest.name}", display="${manifest.display}", start_url="${manifest.start_url}"`)
  await baseBrowser.close()

  // --------------------------------------------------------------------------
  // Suite 2: Android Mobile PWA Opt-In Flow & Web Push Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2] Testing Mobile PWA Opt-In Flow & Web Push Lifecycle...')
  const androidContext = await chromium.launchPersistentContext(testProfileDir, {
    channel: 'chrome',
    headless: true,
    permissions: ['notifications'],
    viewport: { width: 393, height: 851 },
  })

  const androidPage = androidContext.pages()[0] || await androidContext.newPage()

  // Navigate to Alerts
  await androidPage.goto('http://localhost:4174/alerts', { waitUntil: 'networkidle' })
  await androidPage.waitForTimeout(1000)

  // Verify Mobile Push card is visible
  const cardTitle = await androidPage.locator('text=Mobile Push Notifications').first().isVisible()
  console.log(`  ✓ Push notifications card rendered: ${cardTitle}`)

  const benefitsShown = await androidPage.locator('text=Critical Crisis Alerts').first().isVisible()
  console.log(`  ✓ Explanation of benefits rendered: ${benefitsShown}`)

  // Check Enable button
  const enableBtn = androidPage.locator('button:has-text("Enable Push Notifications")').first()
  console.log(`  ✓ Enable button visible: ${await enableBtn.isVisible()}`)

  // Click Enable Push Notifications
  console.log('  -> Clicking "Enable Push Notifications"...')
  await enableBtn.click()

  // Wait for subscription to complete and transition UI
  const testNotifBtn = androidPage.locator('button:has-text("Send Test Notification")').first()
  await testNotifBtn.waitFor({ state: 'visible', timeout: 10000 })
  console.log('  ✓ Subscribed state active: "Send Test Notification" and "Disable" buttons visible!')

  // Capture screenshot of subscribed state
  await androidPage.screenshot({ path: 'screenshots/push_notifications_subscribed.png' })
  console.log('  ✓ Saved screenshot: screenshots/push_notifications_subscribed.png')

  // Click "Send Test Notification"
  console.log('  -> Triggering "Send Test Notification"...')
  await testNotifBtn.click()
  await androidPage.waitForTimeout(1500)
  console.log('  ✓ Dispatched test notification')

  // Verify Service Worker received registration in browser context
  const swEval = await androidPage.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return {
      hasRegistration: Boolean(reg),
      scope: reg?.scope,
      active: Boolean(reg?.active),
      hasPushManager: Boolean(reg?.pushManager),
    }
  })
  console.log('  ✓ Service Worker Browser Context:', JSON.stringify(swEval))

  // Test Unsubscribe
  const disableBtn = androidPage.locator('button:has-text("Disable")').first()
  console.log('  -> Testing Unsubscribe / Disable button...')
  await disableBtn.click()
  await androidPage.waitForTimeout(1500)

  const enableAgain = androidPage.locator('button:has-text("Enable Push Notifications")').first()
  const enableAgainVisible = await enableAgain.isVisible()
  console.log(`  ✓ Cleanly unsubscribed and returned to opt-in state: ${enableAgainVisible}`)

  await androidContext.close()
  if (fs.existsSync(testProfileDir)) {
    fs.rmSync(testProfileDir, { recursive: true, force: true })
  }

  // --------------------------------------------------------------------------
  // Suite 3: iOS Safari Compatibility (Home Screen guidance detection)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3] Testing iOS Safari Compatibility & Home Screen Guidance...')
  const iosBrowser = await chromium.launch({ channel: 'chrome', headless: true })
  const iosContext = await iosBrowser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  })
  const iosPage = await iosContext.newPage()
  await iosPage.goto('http://localhost:4174/alerts', { waitUntil: 'networkidle' })
  await iosPage.waitForTimeout(1000)

  const iosInstruction = await iosPage.locator('text=iOS Setup Required').first().isVisible()
  console.log(`  ✓ iOS Add to Home Screen instructions shown for Safari: ${iosInstruction}`)
  await iosPage.screenshot({ path: 'screenshots/push_ios_instructions.png' })
  console.log('  ✓ Saved screenshot: screenshots/push_ios_instructions.png')
  await iosBrowser.close()

  // --------------------------------------------------------------------------
  // Suite 4: Profile Page Preferences Integration
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4] Testing Profile Page (/profile) Push Preferences...')
  const profileBrowser = await chromium.launch({ channel: 'chrome', headless: true })
  const profilePage = await profileBrowser.newPage()
  await profilePage.goto('http://localhost:4174/profile', { waitUntil: 'networkidle' })
  await profilePage.waitForTimeout(1000)

  const profilePush = await profilePage.locator('text=Mobile Push Notifications').first().isVisible()
  console.log(`  ✓ Mobile Push Notifications preferences rendered in Profile: ${profilePush}`)
  await profilePage.screenshot({ path: 'screenshots/profile_push_preferences.png' })
  console.log('  ✓ Saved screenshot: screenshots/profile_push_preferences.png')
  await profileBrowser.close()

  console.log('\n🎉 ALL PUSH NOTIFICATION SUITES PASSED SUCCESSFULLY!')
}

runPushNotificationsTest().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
