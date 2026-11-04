import type { FormsConfig } from './config.ts'

// Private Vercel runtime log only. Do not add this report to the public API response.
export function createConfigurationLogger(write: (message: string) => void = console.info) {
  let lastReport = ''
  return (config: FormsConfig) => {
    const report = JSON.stringify({
      event: 'forms_configuration',
      enabled: config.enabled,
      careersEnabled: config.recruitEnabled,
      mailProvider: config.mailProvider ?? null,
      testRecipientConfigured: Boolean(config.testTo),
      ...config.diagnostics,
    })
    if (report !== lastReport) {
      write(report)
      lastReport = report
    }
  }
}
