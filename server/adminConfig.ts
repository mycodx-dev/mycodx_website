import { getConfig } from './config.ts'

export function getAdminConfig(env: NodeJS.ProcessEnv = process.env) {
  const forms = getConfig(env)
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  return {
    ...forms, publishableKey, newsEnabled: env.NEWS_CMS_ENABLED === 'true',
    secureCookies: Boolean(env.VERCEL) || env.NODE_ENV === 'production',
    enabled: /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(forms.supabaseUrl) &&
      /^sb_secret_[A-Za-z0-9_-]+$/.test(forms.supabaseSecretKey) &&
      /^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) &&
      Boolean(forms.blobToken) && forms.signingSecret.length >= 32 && forms.origins.length > 0,
  }
}
export type AdminConfig = ReturnType<typeof getAdminConfig>
