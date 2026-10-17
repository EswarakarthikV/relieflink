import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { processAIRequest } from './netlify/functions/ai'
import { processNotifyRequest } from './netlify/functions/notify'

function apiPlugin() {
  const setupMiddleware = (server: any, mode: string) => {
    // /api/ai handler
    server.middlewares.use('/api/ai', (req: any, res: any) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        res.end()
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Method not allowed' }))
        return
      }

      let data = ''
      req.on('data', (chunk: any) => { data += chunk })
      req.on('end', async () => {
        try {
          const body = data ? JSON.parse(data) : {}
          const env = loadEnv(mode, process.cwd(), '')
          const result = await processAIRequest(body, { ...process.env, ...env })
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify(result))
        } catch (err: any) {
          const msg = err?.message || ''
          const status = (msg.startsWith('INVALID_ACTION') || msg.startsWith('INPUT_TOO_LONG'))
            ? 400
            : msg === 'NO_AI_KEY_CONFIGURED'
              ? 503
              : 502
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify({
            error: status === 400
              ? msg
              : status === 503
                ? 'AI service not configured on server.'
                : 'AI service temporarily unavailable. Please try again later.'
          }))
        }
      })
    })

    // /api/notify handler
    server.middlewares.use('/api/notify', (req: any, res: any) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-secret',
        })
        res.end()
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Method not allowed' }))
        return
      }

      let data = ''
      req.on('data', (chunk: any) => { data += chunk })
      req.on('end', async () => {
        try {
          const body = data ? JSON.parse(data) : {}
          const env = loadEnv(mode, process.cwd(), '')
          const result = await processNotifyRequest(
            body,
            { ...process.env, ...env },
            undefined,
            {
              authorization: req.headers['authorization'],
              webhookSecret: req.headers['x-webhook-secret'],
              clientIp: req.socket?.remoteAddress,
            }
          )
          const status = result.statusCode || (result.success ? 200 : 400)
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify(result))
        } catch (err: any) {
          console.error('[Preview Notify Middleware Error]:', err)
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify({ error: 'Failed to process notification request.' }))
        }
      })
    })
  }

  return {
    name: 'api-plugin',
    configureServer(server: any) {
      setupMiddleware(server, 'development')
    },
    configurePreviewServer(server: any) {
      setupMiddleware(server, 'production')
    },
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
