import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import forms from '../api/forms.ts'
import admin from '../api/admin.ts'

const server = createServer(async (req, res) => {
  const handler = { '/api/forms': forms, '/api/admin': admin }[req.url?.split('?')[0]]
  if (!handler) { res.writeHead(404).end(); return }
  try {
    const request = new Request(`http://127.0.0.1:3001${req.url}`, {
      method: req.method, headers: req.headers,
      ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
    })
    const response = await handler.fetch(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'UNAVAILABLE' }))
  }
})
server.listen(3001, '127.0.0.1', () => console.log('Forms API: http://127.0.0.1:3001'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
