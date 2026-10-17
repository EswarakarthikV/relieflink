import { chromium } from '@playwright/test'
import fs from 'fs'

async function generateAssets() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage()

  const logoBuf = fs.readFileSync('public/icons/relieflink-logo.png')
  const logoB64 = 'data:image/png;base64,' + logoBuf.toString('base64')

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0; background:#071426;">
        <canvas id="c512" width="512" height="512"></canvas>
        <canvas id="c192" width="192" height="192"></canvas>
        <canvas id="c64" width="64" height="64"></canvas>
      </body>
    </html>
  `)

  const result = await page.evaluate(async (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        // Draw 512x512 square PWA icon with deep navy background #071426
        const c512 = document.getElementById('c512')
        const ctx512 = c512.getContext('2d')
        ctx512.fillStyle = '#071426'
        ctx512.fillRect(0, 0, 512, 512)

        const targetW = 460
        const targetH = (targetW / img.width) * img.height
        const x = (512 - targetW) / 2
        const y = (512 - targetH) / 2
        ctx512.drawImage(img, x, y, targetW, targetH)

        // Draw 192x192
        const c192 = document.getElementById('c192')
        const ctx192 = c192.getContext('2d')
        ctx192.fillStyle = '#071426'
        ctx192.fillRect(0, 0, 192, 192)
        const w192 = 172
        const h192 = (w192 / img.width) * img.height
        ctx192.drawImage(img, (192 - w192)/2, (192 - h192)/2, w192, h192)

        // Draw 64x64 favicon
        const c64 = document.getElementById('c64')
        const ctx64 = c64.getContext('2d')
        ctx64.fillStyle = '#071426'
        ctx64.fillRect(0, 0, 64, 64)
        const w64 = 58
        const h64 = (w64 / img.width) * img.height
        ctx64.drawImage(img, (64 - w64)/2, (64 - h64)/2, w64, h64)

        resolve({
          icon512: c512.toDataURL('image/png'),
          icon192: c192.toDataURL('image/png'),
          favicon: c64.toDataURL('image/png')
        })
      }
      img.src = dataUrl
    })
  }, logoB64)

  fs.writeFileSync('public/icons/icon-512.png', Buffer.from(result.icon512.split(',')[1], 'base64'))
  fs.writeFileSync('public/icons/icon-192.png', Buffer.from(result.icon192.split(',')[1], 'base64'))
  fs.writeFileSync('public/icons/favicon.png', Buffer.from(result.favicon.split(',')[1], 'base64'))

  console.log('Generated icon-512.png, icon-192.png, and favicon.png successfully!')
  await browser.close()
}

generateAssets().catch(console.error)
