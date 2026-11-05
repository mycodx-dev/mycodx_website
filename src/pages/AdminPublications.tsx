import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicationAdminList, PublicationContent, PublicationCursor, PublicationPost } from '../../shared/publications'
import { AdminError, adminErrorMessage, adminRequest } from '../services/admin'

const emptyPublication = (): PublicationContent => ({year:new Date().getFullYear(),title:'',authors:'',mycodxAuthors:'',journal:'',volume:'',article:'',doi:'',url:'',description:{ko:'',en:'',fr:'',ja:''}})
const stateLabel = (post: { published_version:number|null; version:number }) => post.published_version === null ? '비공개 초안' : post.published_version===post.version ? '게시 중' : '게시 중 · 수정 초안 있음'

export default function AdminPublications({ onExpired, onDirty, onBusy }: { onExpired:(cause:unknown)=>void; onDirty:(dirty:boolean)=>void; onBusy:(busy:boolean)=>void }) {
  const [list,setList] = useState<PublicationAdminList|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [revision,setRevision] = useState(0)
  const [cursors,setCursors] = useState<(PublicationCursor|null)[]>([null])
  const [selection,setSelection] = useState<{id:string;fresh:boolean}|null>(null)
  const [saving,setSaving] = useState(false)
  const savingChanged=useCallback((value:boolean)=>{setSaving(value);onBusy(value)},[onBusy])
  const dirty = useRef(false)
  const before = cursors.at(-1)
  const failed = useCallback((cause:unknown) => {
    if(cause instanceof AdminError && (cause.status===401 || cause.code==='ADMIN_FORBIDDEN')) onExpired(cause)
    return adminErrorMessage(cause)
  },[onExpired])
  const changed = useCallback((value:boolean)=>{dirty.current=value;onDirty(value)},[onDirty])
  useEffect(()=>{
    const abort=new AbortController()
    adminRequest<PublicationAdminList>('publications:list',{before},abort.signal).then(value=>{
      if(!abort.signal.aborted){setList(value);setError('')}
    }).catch(cause=>{if(!abort.signal.aborted)setError(failed(cause))})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    return ()=>abort.abort()
  },[before,revision,failed])
  function select(id:string,fresh=false) {
    if(saving)return
    if(dirty.current && !window.confirm('저장하지 않은 내용을 버리고 이동할까요?'))return
    changed(false);setSelection({id,fresh})
  }
  function reload(){setLoading(true);setCursors([null]);setRevision(v=>v+1)}
  return <main className="admin-main">
    <div className="admin-title-row"><div><p className="admin-eyebrow">PUBLICATIONS</p><h1>논문 관리</h1><p className="admin-muted">임시저장한 논문은 게시 버튼을 눌러야 홈페이지에 반영됩니다.</p></div>
      <button className="admin-button admin-button--primary" disabled={loading || saving || !list} onClick={()=>select(crypto.randomUUID(),true)}>논문 추가</button>
    </div>
    <div className="admin-news-workspace">
      <section className="admin-panel"><div className="admin-panel-heading"><h2>논문 목록</h2><button className="admin-button" onClick={reload} disabled={loading || saving}>새로고침</button></div>
        {error && <p className="admin-error admin-inset" role="alert">{error}</p>}
        {loading ? <p className="admin-empty" role="status">논문을 불러오는 중입니다.</p> : <ul className="admin-news-list">{list?.items.map(post=><li key={post.id}><button disabled={saving} onClick={()=>select(post.id)} aria-pressed={selection?.id===post.id}><strong>{post.title}</strong><span>{stateLabel(post)}</span><small>{post.year}년</small></button></li>)}</ul>}
        {!loading && list?.items.length===0 && <p className="admin-empty">저장한 논문이 없습니다.</p>}
        <div className="admin-pagination"><button className="admin-button" disabled={loading || cursors.length<2} onClick={()=>{setCursors(v=>v.slice(0,-1));setLoading(true)}}>이전</button><span>{cursors.length} 페이지</span><button className="admin-button" disabled={loading || !list?.nextCursor} onClick={()=>{if(list?.nextCursor){setCursors(v=>[...v,list.nextCursor]);setLoading(true)}}}>다음</button></div>
      </section>
      {selection ? <PublicationEditor key={selection.id} selection={selection} failed={failed} onSaved={reload} onDirty={changed} onBusy={savingChanged}/>
        : <section className="admin-panel admin-placeholder"><h2>논문을 선택하거나 새로 작성해 주세요</h2><p>제목·저자·학술지·논문 링크를 편집하고 공개 여부를 관리합니다.</p></section>}
    </div>
  </main>
}

function PublicationEditor({selection,failed,onSaved,onDirty,onBusy}:{selection:{id:string;fresh:boolean};failed:(cause:unknown)=>string;onSaved:()=>void;onDirty:(dirty:boolean)=>void;onBusy:(busy:boolean)=>void}) {
  const [post,setPost]=useState<PublicationPost|null>(null)
  const [draft,setDraft]=useState<PublicationContent>(emptyPublication)
  const [baseline,setBaseline]=useState(()=>JSON.stringify(emptyPublication()))
  const [loading,setLoading]=useState(!selection.fresh)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [reload,setReload]=useState(0)
  const controller=useRef<AbortController|null>(null)
  const inFlight=useRef(false)
  const dirty=JSON.stringify(draft)!==baseline
  useEffect(()=>{
    onDirty(dirty)
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(dirty||inFlight.current){event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',beforeUnload)
    return ()=>window.removeEventListener('beforeunload',beforeUnload)
  },[dirty,onDirty])
  useEffect(()=>()=>onBusy(false),[onBusy])
  useEffect(()=>{
    const abort=new AbortController();controller.current=abort
    if(!selection.fresh || reload>0) {
      adminRequest<PublicationPost>('publications:detail',{postId:selection.id},abort.signal).then(value=>{
        if(!abort.signal.aborted){setPost(value);setDraft(value.draft);setBaseline(JSON.stringify(value.draft))}
      }).catch(cause=>{if(!abort.signal.aborted)setError(failed(cause))})
        .finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    }
    return ()=>abort.abort()
  },[selection.id,selection.fresh,reload,failed])
  function change<K extends keyof PublicationContent>(key:K,value:PublicationContent[K]){setDraft(v=>({...v,[key]:value}));setNotice('')}
  function refresh(){
    if(dirty&&!window.confirm('작성 중인 내용을 버리고 최신 저장본을 불러올까요?'))return
    setLoading(true);setError('');setNotice('');setReload(v=>v+1)
  }
  async function persist(action:'publications:save'|'publications:publish',publish?:boolean) {
    if(!controller.current || inFlight.current)return
    if(action==='publications:publish' && !window.confirm(publish?'저장된 논문 정보를 홈페이지에 게시할까요?':'홈페이지에서 이 논문을 비공개로 전환할까요?'))return
    const signal=controller.current.signal
    inFlight.current=true;setBusy(true);onBusy(true);setError('');setNotice('')
    try {
      const value=await adminRequest<PublicationPost>(action,{postId:selection.id,version:post?.version??0,...(action==='publications:save'?{draft}:{publish})},signal)
      if(!signal.aborted){setPost(value);setDraft(value.draft);setBaseline(JSON.stringify(value.draft));onDirty(false);setNotice(action==='publications:save'?'임시저장했습니다. 게시를 눌러야 홈페이지에 반영됩니다.':publish?'게시했습니다. 홈페이지 논문 목록에서 확인할 수 있습니다.':'비공개로 전환했습니다.');onSaved()}
    } catch(cause){if(!signal.aborted)setError(`${failed(cause)} 입력 내용은 유지됩니다. 결과가 불확실하면 최신 저장본을 확인해 주세요.`)}
    finally{inFlight.current=false;if(!signal.aborted){setBusy(false);onBusy(false)}}
  }
  const fields=[['title','논문 제목',500,true],['authors','전체 저자',2000,true],['mycodxAuthors','MycoDx 참여 저자',1000,false],['journal','학술지',300,true],['volume','권 (Volume)',100,false],['article','논문 번호 / 페이지',100,false],['doi','DOI (선택)',250,false],['url','논문 링크',1000,true]] as const
  return <section className="admin-panel admin-news-editor">
    <div className="admin-panel-heading"><h2>{selection.fresh&&!post?'논문 추가':'논문 편집'}</h2><span className="admin-muted">{post?stateLabel(post):'아직 저장하지 않음'}</span></div>
    {loading?<p className="admin-empty" role="status">논문을 불러오는 중입니다.</p>:!selection.fresh&&!post?<div className="admin-inset"><p className="admin-error" role="alert">{error}</p><button className="admin-button" onClick={refresh}>다시 불러오기</button></div>:<form onSubmit={e=>{e.preventDefault();void persist('publications:save')}}>
      <fieldset disabled={busy}>
        {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p className="admin-success" role="status">{notice}</p>}
        <label>발행 연도<input type="number" required min={1900} max={2200} step={1} value={draft.year||''} onChange={e=>change('year',Number(e.target.value))}/></label>
        {fields.map(([key,label,maxLength,required])=><label key={key}>{label}{required?' *':''}<input required={required} maxLength={maxLength} value={draft[key]} onChange={e=>change(key,e.target.value)} placeholder={key==='url'?'https://… 또는 /papers/파일명.pdf':key==='doi'?'10.1234/example':undefined}/></label>)}
        <p className="admin-note">논문 링크는 학술지·DOI의 HTTPS 주소 또는 기존 PDF 경로를 입력합니다. 파일 직접 업로드는 제공하지 않습니다. DOI 입력란에는 주소가 아닌 10.으로 시작하는 식별자를 입력합니다.</p>
        <div className="admin-news-language">{([['ko','한국어'],['en','영어'],['fr','프랑스어'],['ja','일본어']] as const).map(([language,label])=><label key={language}>논문 설명 · {label}<textarea rows={4} maxLength={2000} value={draft.description[language]??''} onChange={e=>change('description',{...draft.description,[language]:e.target.value})}/></label>)}</div>
        <p className="admin-note">번역이 없으면 영어, 한국어 순으로 표시합니다. 설명은 일반 텍스트로 표시됩니다.</p>
        <div className="admin-news-actions">
          <button className="admin-button admin-button--primary" type="submit">{busy?'처리 중…':'임시저장'}</button>
          <button className="admin-button" type="button" disabled={!post||dirty} onClick={()=>persist('publications:publish',true)}>게시</button>
          <button className="admin-button" type="button" disabled={post?.published_version==null||dirty} onClick={()=>persist('publications:publish',false)}>비공개 전환</button>
          <button className="admin-button admin-button--quiet" type="button" disabled={!post&&!error} onClick={refresh}>최신 저장본 불러오기</button>
        </div>
        {dirty&&<p className="admin-note">저장하지 않은 변경사항이 있습니다. 게시하려면 먼저 임시저장해 주세요.</p>}
      </fieldset>
    </form>}
  </section>
}
