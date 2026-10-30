import type { FormsConfig } from '../config.ts'
import type { SubmissionMail } from '../mail.ts'

export async function sendWithResend(id: string, mail: SubmissionMail, config: FormsConfig, fetcher: typeof fetch = fetch) {
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `mycodx-form/${id}`,
    },
    body: JSON.stringify({
      from: mail.from, to: mail.to, reply_to: mail.replyTo,
      subject: mail.subject, text: mail.text, headers: mail.headers,
      // Only verified bytes, never client-provided URLs or local file paths.
      attachments: mail.attachments.map(file => ({ filename: file.filename, content: file.content.toString('base64') })),
    }),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('Mail provider did not accept the request')
  }
  const result = await response.json() as { id?: unknown }
  if (typeof result.id !== 'string' || !result.id) throw new Error('Mail provider receipt missing')
  return { messageId: result.id }
}
