import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ADMIN_PASSWORD_MAX, passwordChangeError } from '../../shared/adminPassword'
import { AdminError, adminErrorMessage, adminRequest } from '../services/admin'

interface Props {
  email: string
  onChanged: () => void
  onExpired: (cause: unknown) => void
  onBusy: (value: boolean) => void
}

export default function AdminPassword({ email, onChanged, onExpired, onBusy }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const values = {
      currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword'), confirmPassword: data.get('confirmPassword'),
    }
    const invalid = passwordChangeError(values.currentPassword, values.newPassword, values.confirmPassword)
    if (invalid) { setError(adminErrorMessage(new AdminError(invalid, 400))); return }
    pending.current = true
    setBusy(true); onBusy(true); setError('')
    try {
      await adminRequest('password:change', values)
      if (mounted.current) { form.reset(); onChanged() }
    } catch (cause) {
      if (!mounted.current) return
      // Do not keep passwords in component state, browser storage or error output.
      form.reset()
      if (!(cause instanceof AdminError) || cause.code === 'PASSWORD_CHANGE_UNCERTAIN') {
        // Lost responses can hide a successful update. Return to login, without resubmitting.
        onExpired(new AdminError('PASSWORD_CHANGE_UNCERTAIN', 503))
      } else if (cause.status === 401 || cause.code === 'ADMIN_FORBIDDEN') onExpired(cause)
      else setError(adminErrorMessage(cause))
    } finally {
      pending.current = false
      onBusy(false)
      if (mounted.current) setBusy(false)
    }
  }

  return <main className="admin-login admin-password">
    <h1>비밀번호 변경</h1>
    <p className="admin-muted">현재 계정의 비밀번호를 변경합니다. 변경 후 새 비밀번호로 다시 로그인해 주세요.</p>
    <form className="admin-login-form" onSubmit={submit} aria-busy={busy}>
      <input type="text" name="username" autoComplete="username" value={email} hidden readOnly />
      <label>현재 비밀번호<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} /></label>
      <label>새 비밀번호<input name="newPassword" type="password" autoComplete="new-password" required maxLength={ADMIN_PASSWORD_MAX} aria-describedby="password-help" disabled={busy} /></label>
      <p id="password-help" className="admin-muted">12자 이상으로 입력해 주세요. 영문·숫자·기호를 조합한 긴 비밀번호를 권장합니다.</p>
      <label>새 비밀번호 확인<input name="confirmPassword" type="password" autoComplete="new-password" required maxLength={ADMIN_PASSWORD_MAX} disabled={busy} /></label>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <button type="submit" className="admin-button admin-button--primary" disabled={busy}>{busy ? '변경 중…' : '비밀번호 변경하기'}</button>
    </form>
  </main>
}
