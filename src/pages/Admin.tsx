import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AdminApplicationDetail, AdminApplicationList, AdminUser, ApplicationCursor, ReviewStatus } from '../../shared/admin'
import { adminRequest, AdminError, adminErrorMessage } from '../services/admin'
import '../styles/admin.css'
import AdminNews from './AdminNews'
import AdminPassword from './AdminPassword'

const date = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value))
const reviewLabel = (value: ReviewStatus) => value === 'reviewed' ? '확인 완료' : '미확인'
const fileGroups: Record<string, string> = { application: '입사지원서', degree: '학위 증명', transcript: '성적 증명', papers: '논문 및 기타' }

export default function Admin() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState<'recruit'|'news'|'password'>('recruit')
  const newsDirty = useRef(false)
  const setNewsDirty = useCallback((dirty:boolean)=>{newsDirty.current=dirty},[])
  const generation = useRef(0)

  const expire = useCallback((cause?: unknown) => {
    newsDirty.current=false
    generation.current++
    setUser(null)
    setNotice('')
    setError(cause ? adminErrorMessage(cause) : '로그인이 만료되었습니다. 다시 로그인해 주세요.')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const current = generation.current
    adminRequest<AdminUser>('session', {}, controller.signal).then(session => {
      if (current === generation.current && !controller.signal.aborted) setUser(session)
    }).catch(cause => {
      if (!controller.signal.aborted && current === generation.current && !(cause instanceof AdminError && cause.status === 401)) setError(adminErrorMessage(cause))
    }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    const current = generation.current
    const timer = window.setTimeout(() => expire(), Math.max(0, user.expiresAt - Date.now()))
    let verifying = false
    const verify = () => {
      // A single tab return commonly emits both focus and visibilitychange.
      if (document.visibilityState !== 'visible' || verifying) return
      verifying = true
      adminRequest<AdminUser>('session', {}, controller.signal).catch(cause => {
        // Fail closed when returning to an unattended administrator tab.
        if (!controller.signal.aborted && current === generation.current) expire(cause)
      }).finally(() => { verifying = false })
    }
    window.addEventListener('focus', verify)
    document.addEventListener('visibilitychange', verify)
    return () => {
      controller.abort(); window.clearTimeout(timer)
      window.removeEventListener('focus', verify); document.removeEventListener('visibilitychange', verify)
    }
  }, [user, expire])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true); setError(''); setNotice('')
    const current = ++generation.current
    try {
      const session = await adminRequest<AdminUser>('login', { email: values.get('email'), password: values.get('password') })
      if (current === generation.current) { form.reset(); setSection('recruit'); setUser(session) }
    } catch (cause) { if (current === generation.current) setError(adminErrorMessage(cause)) }
    finally { setBusy(false) }
  }
  async function logout() {
    if(newsDirty.current && !window.confirm('저장하지 않은 소식 내용을 버리고 로그아웃할까요?'))return
    newsDirty.current=false
    generation.current++; setUser(null); setBusy(true); setError(''); setNotice('')
    try { await adminRequest('logout') }
    catch { setError('화면에서 로그아웃했지만 서버 연결을 확인하지 못했습니다. 연결 후 로그아웃을 다시 눌러 주세요.') }
    finally { setBusy(false) }
  }

  return <div className="admin-shell" lang="ko">
    <header className="admin-header">
      <Link to="/" className="admin-brand" onClick={e=>{if(newsDirty.current&&!window.confirm('저장하지 않은 내용을 버리고 홈페이지로 이동할까요?'))e.preventDefault()}}>MycoDx <span>관리자</span></Link>
      <div className="admin-account">{user && <span>{user.email}</span>}
        {(user || error.includes('로그아웃')) && <button className="admin-button admin-button--quiet" onClick={logout} disabled={busy}>로그아웃</button>}
        <Link to="/" onClick={e=>{if(newsDirty.current&&!window.confirm('저장하지 않은 내용을 버리고 홈페이지로 이동할까요?'))e.preventDefault()}}>홈페이지 ↗</Link>
      </div>
    </header>
    {checking ? <main className="admin-login"><p role="status">로그인 상태를 확인하고 있습니다.</p></main>
      : user ? <><nav className="admin-tabs" aria-label="관리 메뉴">
        {(['recruit','news','password'] as const).map(value=><button key={value} disabled={busy} className={section===value?'is-active':''} aria-current={section===value?'page':undefined} onClick={()=>{
          if(section!==value && newsDirty.current && !window.confirm('저장하지 않은 내용을 버리고 이동할까요?'))return
          if(section!==value){newsDirty.current=false;setSection(value)}
        }}>{value==='recruit'?'채용 관리':value==='news'?'소식 관리':'비밀번호 변경'}</button>)}
      </nav>{section==='recruit'?<Dashboard key={user.expiresAt} onExpired={expire}/>:section==='news'?<AdminNews key={user.expiresAt} onExpired={expire} onDirty={setNewsDirty}/>:<AdminPassword
        key={user.expiresAt} email={user.email} onExpired={expire} onBusy={setBusy} onChanged={()=>{
          generation.current++; setUser(null); setError(''); setNotice('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.')
        }}/>}</>
      : <main className="admin-login">
        <p className="admin-eyebrow">RECRUITMENT</p><h1>관리자 로그인</h1>
        <p className="admin-muted">승인된 Supabase 관리자 계정으로 로그인해 주세요.</p>
        {notice && <p className="admin-success" role="status">{notice}</p>}
        <form onSubmit={login} className="admin-login-form">
          <label>이메일<input name="email" type="email" autoComplete="username" required maxLength={254} disabled={busy} /></label>
          <label>비밀번호<input name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="admin-button admin-button--primary" disabled={busy}>{busy ? '처리 중…' : '로그인'}</button>
        </form>
        <p className="admin-note">이카운트 웹메일과 별도의 계정입니다. 접근 권한은 관리자에게 문의해 주세요.</p>
      </main>}
    <footer className="admin-footer">지원자 정보는 채용 검토 목적으로만 이용해 주세요. 공용 기기에서는 사용 후 로그아웃해 주세요.</footer>
  </div>
}

function Dashboard({ onExpired }: { onExpired: (error: unknown) => void }) {
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [area, setArea] = useState('')
  const [experience, setExperience] = useState('')
  const [options, setOptions] = useState({ areas: [] as string[], experiences: [] as string[] })
  const [cursors, setCursors] = useState<(ApplicationCursor | null)[]>([null])
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<AdminApplicationList | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const before = cursors.at(-1)

  const failed = useCallback((cause: unknown) => {
    if (cause instanceof AdminError && (cause.status === 401 || cause.code === 'ADMIN_FORBIDDEN')) onExpired(cause)
    return adminErrorMessage(cause)
  }, [onExpired])

  useEffect(() => {
    const controller = new AbortController()
    adminRequest<AdminApplicationList>('list', { status: filter || null, query, area, experience, before }, controller.signal).then(data => {
      if (!controller.signal.aborted) { setResult(data); setOptions(data.options); setError('') }
    }).catch(cause => {
      if (!controller.signal.aborted) { setResult(null); setError(failed(cause)) }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [before, filter, query, area, experience, revision, failed])

  function reload() { setLoading(true); setError(''); setRevision(value => value + 1) }
  function resetPage() {
    setCursors([null]); setSelected(null); setResult(null); setLoading(true); setRevision(v => v + 1)
  }
  return <main className="admin-main">
    <div className="admin-title-row"><div><p className="admin-eyebrow">RECRUITMENT</p><h1>지원자 관리</h1>
      <p className="admin-muted">접수가 완료된 지원서를 최신순으로 확인합니다.</p></div>
      <button className="admin-button" onClick={reload} disabled={loading}>목록 새로고침</button>
    </div>
    <div className="admin-workspace">
      <section className="admin-panel admin-list" aria-labelledby="applicants-title" aria-busy={loading}>
        <div className="admin-panel-heading"><h2 id="applicants-title">지원자 목록</h2>
          <div className="admin-filter"><label htmlFor="admin-status-filter">확인 상태</label><select id="admin-status-filter" value={filter} onChange={e => { setFilter(e.target.value); resetPage() }}>
            <option value="">전체</option><option value="unread">미확인</option><option value="reviewed">확인 완료</option>
          </select></div>
        </div>
        <form className="admin-search" onSubmit={e => { e.preventDefault(); setQuery(queryInput.trim()); resetPage() }}>
          <label htmlFor="admin-search-query">지원자 검색</label>
          <div className="admin-search-row"><input id="admin-search-query" type="search" value={queryInput} onChange={e => setQueryInput(e.target.value)} maxLength={100} placeholder="이름 · 이메일 · 연락처" /><button className="admin-button" type="submit">검색</button></div>
          <div className="admin-search-filters">
            <label>지원 분야<select value={area} onChange={e => { setArea(e.target.value); resetPage() }} aria-label="지원 분야 필터"><option value="">전체 분야</option>{[...new Set([...options.areas, ...(area ? [area] : [])])].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>경력 구분<select value={experience} onChange={e => { setExperience(e.target.value); resetPage() }} aria-label="경력 구분 필터"><option value="">전체 경력</option>{[...new Set([...options.experiences, ...(experience ? [experience] : [])])].map(value => <option key={value}>{value}</option>)}</select></label>
            <button type="button" className="admin-button admin-button--quiet" onClick={() => { setQuery(''); setQueryInput(''); setFilter(''); setArea(''); setExperience(''); resetPage() }}>초기화</button>
          </div>
          {query && <p className="admin-note">적용된 검색어: {query}</p>}
        </form>
        {error && <p className="admin-error admin-inset" role="alert">{error}</p>}
        {loading ? <p className="admin-empty" role="status">지원자 목록을 불러오는 중입니다.</p>
          : result?.items.length ? <div className="admin-table-scroll"><table className="admin-table">
            <thead><tr><th>지원자 / 지원 분야</th><th>접수일 · 한국 시간</th><th>확인 상태</th></tr></thead>
            <tbody>{result.items.map(a => <tr key={a.id} className={selected === a.id ? 'is-selected' : ''}>
              <td><button className="admin-applicant" onClick={() => setSelected(a.id)} aria-pressed={selected === a.id}>{a.name}<span>{a.area} · {a.experience}</span></button></td>
              <td>{date(a.submitted_at)}</td><td><span className={`admin-badge admin-badge--${a.review_status}`}>{reviewLabel(a.review_status)}</span></td>
            </tr>)}</tbody>
          </table></div> : !error && <p className="admin-empty">표시할 지원서가 없습니다.</p>}
        <div className="admin-pagination">
          <button className="admin-button" disabled={loading || cursors.length < 2} onClick={() => {
            setCursors(values => values.slice(0, -1)); setLoading(true); setSelected(null)
          }}>이전</button><span>{cursors.length} 페이지</span>
          <button className="admin-button" disabled={loading || !result?.nextCursor} onClick={() => {
            if (result?.nextCursor) { setCursors(values => [...values, result.nextCursor]); setLoading(true); setSelected(null) }
          }}>다음</button>
        </div>
      </section>
      {selected ? <ApplicationDetail key={selected} applicationId={selected} failed={failed} onChanged={reload} onClose={() => setSelected(null)} />
        : <section className="admin-panel admin-placeholder"><span aria-hidden="true">↗</span><h2>지원서를 선택해 주세요</h2><p>지원자 이름을 누르면 상세 정보와<br />제출한 첨부파일을 볼 수 있습니다.</p></section>}
    </div>
  </main>
}

function ApplicationDetail({ applicationId, failed, onChanged, onClose }: {
  applicationId: string; failed: (cause: unknown) => string; onChanged: () => void; onClose: () => void
}) {
  const [data, setData] = useState<AdminApplicationDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 1100px)').matches) heading.current?.scrollIntoView({ block: 'start' })
  }, [])
  useEffect(() => {
    const abort = new AbortController()
    controller.current = abort
    adminRequest<AdminApplicationDetail>('detail', { applicationId }, abort.signal).then(value => {
      if (!abort.signal.aborted) setData(value)
    }).catch(cause => { if (!abort.signal.aborted) { setData(null); setError(failed(cause)) } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [applicationId, failed, revision])

  async function review() {
    if (!data || !controller.current) return
    const signal = controller.current.signal
    setBusy(true); setError('')
    try {
      await adminRequest('review', { applicationId, status: data.application.review_status === 'unread' ? 'reviewed' : 'unread', version: data.application.version }, signal)
      if (!signal.aborted) { setLoading(true); setRevision(v => v + 1); onChanged() }
    } catch (cause) {
      if (!signal.aborted) {
        setError(failed(cause))
        // A concurrent change or lost response is resolved by re-reading; no blind retry.
        setLoading(true); setRevision(v => v + 1); onChanged()
      }
    } finally { if (!signal.aborted) setBusy(false) }
  }
  async function download(fileId: string) {
    if (!controller.current) return
    const signal = controller.current.signal
    setBusy(true); setError('')
    try {
      const result = await adminRequest<{ url: string }>('download', { fileId }, signal)
      if (!signal.aborted) {
        const link = document.createElement('a')
        link.href = result.url; link.rel = 'noreferrer noopener'; link.referrerPolicy = 'no-referrer'
        // The server signs an attachment download; no file preview or inline execution.
        document.body.appendChild(link); link.click(); link.remove()
      }
    } catch (cause) { if (!signal.aborted) setError(failed(cause)) }
    finally { if (!signal.aborted) setBusy(false) }
  }
  const a = data?.application
  return <section className="admin-panel admin-detail" aria-labelledby="detail-title" aria-busy={loading || busy}>
    <div className="admin-panel-heading"><h2 id="detail-title" ref={heading} tabIndex={-1}>지원서 상세</h2><button className="admin-button admin-button--quiet" onClick={onClose}>닫기</button></div>
    {error && <p className="admin-error admin-inset" role="alert">{error}</p>}
    {loading ? <p className="admin-empty" role="status">상세 정보를 불러오는 중입니다.</p> : a ? <div className="admin-detail-body">
      <div className="admin-detail-title"><div><h3>{a.name}</h3><p>{a.area}</p></div><span className={`admin-badge admin-badge--${a.review_status}`}>{reviewLabel(a.review_status)}</span></div>
      <button className="admin-button admin-button--primary admin-review" onClick={review} disabled={busy}>{busy ? '처리 중…' : a.review_status === 'unread' ? '확인 완료로 변경' : '미확인으로 변경'}</button>
      <dl className="admin-fields">
        {([['이메일', a.email], ['연락처', a.phone], ['최종 학력', a.education], ['경력 구분', a.experience],
          ['접수일', date(a.submitted_at)], ['확인일', a.reviewed_at ? date(a.reviewed_at) : '미확인'],
          ['보관 만료일', date(a.expires_at)], ['동의 시각', date(a.consented_at)], ['동의 버전', a.consent_version]]).map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <h4>주요 경력 및 지원 내용</h4><p className="admin-message">{a.message || '작성한 내용이 없습니다.'}</p>
      <h4>제출 파일 <span>{data.files.length}</span></h4>
      <ul className="admin-files">{data.files.map(file => <li key={file.id}><div><span>{fileGroups[file.group] || file.group}</span><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB</small></div>
        <button className="admin-button" onClick={() => download(file.id)} disabled={busy} aria-label={`${file.name} 다운로드`}>다운로드</button></li>)}</ul>
      <p className="admin-note">다운로드 링크는 최대 60초 동안 유효합니다. 다운로드한 파일은 담당자의 관리 책임 아래 보관·삭제해 주세요.</p>
    </div> : <div className="admin-inset"><button className="admin-button" onClick={() => { setLoading(true); setError(''); setRevision(v => v + 1) }}>다시 불러오기</button></div>}
  </section>
}
