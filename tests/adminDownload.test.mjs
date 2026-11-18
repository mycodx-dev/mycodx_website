import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applicationDownloadFilename, downloadApplicationFile } from '../src/services/adminDownload.ts'
import { AdminError, adminErrorMessage } from '../src/services/admin.ts'

const file = { id: 'test-file-id', group: 'application', name: '이력서.pdf', size: 12, content_type: 'application/pdf' }
const signedUrl = 'https://storage.example.test/object/sign/random-id.pdf?token=test-only&download='

function browserFixture(t) {
  const links = [], blobs = [], revoked = [], timers = []
  const document = {
    createElement(tag) {
      assert.equal(tag, 'a')
      return { click() { this.clicked = true }, remove() { this.removed = true } }
    },
    body: { appendChild(link) { links.push(link) } },
  }
  const window = { setTimeout(callback, delay) { timers.push({ callback, delay }) } }
  for (const [key, value] of Object.entries({ document, window })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else delete globalThis[key]
    })
  }
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:test-download' })
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url))
  return { links, blobs, revoked, timers }
}

test('download names identify the applicant and document while preserving Korean and extensions', () => {
  for (const [group, label, name] of [
    ['application', '입사지원서', '이력서.pdf'], ['degree', '학위 증명', '졸업증명서.PDF'],
    ['transcript', '성적 증명', '성적표.doc'], ['papers', '논문 및 기타', '논문 묶음.zip'],
    ['application', '입사지원서', '입사지원서.docx'],
  ]) {
    assert.equal(applicationDownloadFilename('홍길동', { group, name }), `홍길동_${label}_${name}`)
  }
  assert.equal(applicationDownloadFilename('홍길동'.normalize('NFD'), file), '홍길동_입사지원서_이력서.pdf')
  assert.equal(applicationDownloadFilename('다른 지원자', file), '다른 지원자_입사지원서_이력서.pdf')
})

test('unsafe filename characters are replaced and long Unicode names retain the extension within filesystem limits', () => {
  const unsafe = applicationDownloadFilename('홍/길\\동\n', { ...file, name: '문서<>:"|?*\u202e.pdf' })
  assert.doesNotMatch(unsafe, /[<>:"/\\|?*\p{Cc}\p{Cf}]/u)
  assert.ok(unsafe.endsWith('.pdf'))
  const long = applicationDownloadFilename('홍길동'.repeat(34), { ...file, name: `${'긴문서😀'.repeat(40)}.docx` })
  assert.ok(Buffer.byteLength(long, 'utf8') <= 240)
  assert.ok(long.startsWith('홍길동'))
  assert.ok(long.includes('_입사지원서_'))
  assert.ok(long.endsWith('.docx'))
  assert.equal(long.isWellFormed(), true)
})

test('signed storage bytes are saved with a local filename, without sending applicant details to storage', async t => {
  const browser = browserFixture(t)
  const requests = []
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 255, 10])
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    if (url === '/api/admin') return Response.json({ url: signedUrl })
    return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="random-id.pdf"' } })
  })
  await downloadApplicationFile('홍길동', file, new AbortController().signal)
  assert.deepEqual(JSON.parse(requests[0].options.body), { fileId: file.id, action: 'download' })
  assert.equal(requests[1].url, signedUrl)
  assert.equal(requests[1].options.credentials, 'omit')
  assert.equal(requests[1].options.cache, 'no-store')
  assert.equal(requests[1].options.referrerPolicy, 'no-referrer')
  assert.equal(browser.links.length, 1)
  assert.equal(browser.links[0].href, 'blob:test-download')
  assert.equal(browser.links[0].download, '홍길동_입사지원서_이력서.pdf')
  assert.equal(browser.links[0].clicked, true)
  assert.equal(browser.links[0].removed, true)
  assert.deepEqual(new Uint8Array(await browser.blobs[0].arrayBuffer()), bytes)
  assert.deepEqual(browser.revoked, [])
  assert.ok(browser.timers[0].delay > 0)
  browser.timers[0].callback()
  assert.deepEqual(browser.revoked, ['blob:test-download'])
})

test('authentication errors stop before fetching storage and preserve the session error', async t => {
  const browser = browserFixture(t)
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 }))
  await assert.rejects(downloadApplicationFile('홍길동', file, new AbortController().signal), { code: 'AUTH_REQUIRED', status: 401 })
  assert.equal(request.mock.callCount(), 1)
  assert.equal(browser.links.length, 0)
})

test('expired links, connection failures and interrupted bodies show a retryable error without saving an error document', async t => {
  for (const failure of ['expired', 'network', 'body']) {
    await t.test(failure, async t => {
      const browser = browserFixture(t)
      t.mock.method(globalThis, 'fetch', async url => {
        if (url === '/api/admin') return Response.json({ url: signedUrl })
        if (failure === 'expired') return new Response('Expired token', { status: 401 })
        if (failure === 'network') throw new TypeError('Connection failed')
        return { ok: true, blob: async () => { throw new TypeError('Body interrupted') } }
      })
      await assert.rejects(downloadApplicationFile('홍길동', file, new AbortController().signal), error => {
        assert.ok(error instanceof AdminError)
        assert.equal(error.code, 'DOWNLOAD_FAILED')
        assert.equal(error.status, 503)
        assert.match(adminErrorMessage(error), /다시 눌러/)
        return true
      })
      assert.equal(browser.links.length, 0)
      assert.equal(browser.blobs.length, 0)
    })
  }
})

test('closing the detail or logging out aborts storage and prevents a delayed download', async t => {
  for (const stage of ['sign', 'body']) {
    await t.test(stage, async t => {
      const browser = browserFixture(t)
      const controller = new AbortController()
      let storageSignal
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (url === '/api/admin') {
          if (stage === 'sign') controller.abort()
          return Response.json({ url: signedUrl })
        }
        storageSignal = options.signal
        return { ok: true, blob: async () => { controller.abort(); return new Blob(['test']) } }
      })
      await assert.rejects(downloadApplicationFile('홍길동', file, controller.signal), { name: 'AbortError' })
      if (stage === 'body') assert.equal(storageSignal.aborted, true)
      else assert.equal(storageSignal, undefined)
      assert.equal(browser.links.length, 0)
      assert.equal(browser.blobs.length, 0)
    })
  }
})
