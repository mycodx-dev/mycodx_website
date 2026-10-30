import nodemailer from 'nodemailer'
import type { SMTPTransportOptions, SMTPSentMessageInfo } from 'nodemailer'
import type { FormsConfig } from '../config.ts'
import type { SubmissionMail } from '../mail.ts'

interface SmtpTransport {
  sendMail(mail: SubmissionMail): Promise<Pick<SMTPSentMessageInfo, 'messageId' | 'response' | 'accepted' | 'rejected'>>
  close(): void
}

export type SmtpTransportFactory = (options: SMTPTransportOptions) => SmtpTransport

const createTransport: SmtpTransportFactory = options => nodemailer.createTransport(options)

export async function sendWithSmtp(mail: SubmissionMail, config: FormsConfig, factory = createTransport) {
  const transport = factory({
    host: config.smtpHost, port: config.smtpPort,
    secure: config.smtpPort === 465,
    requireTLS: true,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: config.smtpHost },
    auth: { user: config.smtpUser, pass: config.smtpPass },
    connectionTimeout: 15_000, greetingTimeout: 10_000, dnsTimeout: 10_000, socketTimeout: 60_000,
    disableFileAccess: true, disableUrlAccess: true,
    logger: false, debug: false,
  })
  try {
    // Await SMTP's final acceptance, not just a generated Message-ID or connection.
    const receipt = await transport.sendMail(mail)
    const accepted = receipt.accepted
    if (!receipt.messageId || !/^2\d\d(?:[ -]|$)/.test(receipt.response) || receipt.rejected.length ||
      accepted.length !== 1 || accepted[0]?.toLowerCase() !== mail.to[0].toLowerCase()) {
      throw new Error('SMTP delivery was not accepted for the intended recipient')
    }
    return { messageId: receipt.messageId }
  } finally {
    transport.close()
  }
}
