import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewsAdminList, NewsContent, NewsCursor, NewsPost } from '../../shared/news'
import { AdminError, adminErrorMessage, adminRequest } from '../services/admin'

const emptyNews = (): NewsContent => ({ id:'',date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}),category:'News',
  title:{ko:'',en:''},summary:{ko:'',en:''},body:{ko:'',en:''},image:'',imageAlt:{ko:'',en:''},url:'',photos:[] })
const stateLabel = (post: { published_version:number|null; version:number }) => post.published_version === null ? '비공개 초안' : post.published_version===post.version ? '게시 중' : '게시 중 · 수정 초안 있음'

export default function AdminNews({ onExpired, onDirty }: { onExpired:(cause:unknown)=>void; onDirty:(dirty:boolean)=>void }) {
  const [list,setList] = useState<NewsAdminList|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [revision,setRevision] = useState(0)
  const [cursors,setCursors] = useState<(NewsCursor|null)[]>([null])
  const [selection,setSelection] = useState<{id:string;fresh:boolean}|null>(null)
  const dirty = useRef(false)
  const before = cursors.at(-1)
  const failed = useCallback((cause:unknown) => {
    if(cause instanceof AdminError && (cause.status===401 || cause.code==='ADMIN_FORBIDDEN')) onExpired(cause)
    return adminErrorMessage(cause)
  },[onExpired])
  const changed = useCallback((value:boolean)=>{dirty.current=value;onDirty(value)},[onDirty])
  useEffect(()=>{
    const abort=new AbortController()
    adminRequest<NewsAdminList>('news:list',{before},abort.signal).then(value=>{
      if(!abort.signal.aborted){setList(value);setError('')}
    }).catch(cause=>{if(!abort.signal.aborted)setError(failed(cause))})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    return ()=>abort.abort()
  },[before,revision,failed])
  function select(id:string,fresh=false) {
    if(dirty.current && !window.confirm('저장하지 않은 내용을 버리고 이동할까요?'))return
    changed(false);setSelection({id,fresh})
  }
  function reload(){setLoading(true);setCursors([null]);setRevision(v=>v+1)}
  return <main className="admin-main">
    <div className="admin-title-row"><div><p className="admin-eyebrow">NEWS</p><h1>소식 관리</h1><p className="admin-muted">임시저장한 글은 게시 버튼을 눌러야 홈페이지에 반영됩니다.</p></div>
      <button className="admin-button admin-button--primary" disabled={loading || !list} onClick={()=>select(crypto.randomUUID(),true)}>새 소식 작성</button>
    </div>
    <div className="admin-news-workspace">
      <section className="admin-panel"><div className="admin-panel-heading"><h2>소식 목록</h2><button className="admin-button" onClick={reload} disabled={loading}>새로고침</button></div>
        {error && <p className="admin-error admin-inset" role="alert">{error}</p>}
        {loading ? <p className="admin-empty" role="status">소식을 불러오는 중입니다.</p> : <ul className="admin-news-list">{list?.items.map(post=><li key={post.id}><button onClick={()=>select(post.id)} aria-pressed={selection?.id===post.id}><strong>{post.title}</strong><span>{stateLabel(post)}</span><small>/news/{post.post_number ?? post.slug}</small></button></li>)}</ul>}
        {!loading && list?.items.length===0 && <p className="admin-empty">저장한 소식이 없습니다.</p>}
        <div className="admin-pagination"><button className="admin-button" disabled={loading || cursors.length<2} onClick={()=>{setCursors(v=>v.slice(0,-1));setLoading(true)}}>이전</button><span>{cursors.length} 페이지</span><button className="admin-button" disabled={loading || !list?.nextCursor} onClick={()=>{if(list?.nextCursor){setCursors(v=>[...v,list.nextCursor]);setLoading(true)}}}>다음</button></div>
      </section>
      {selection ? <NewsEditor key={selection.id} selection={selection} failed={failed} onSaved={reload} onDirty={changed}/>
        : <section className="admin-panel admin-placeholder"><h2>소식을 선택하거나 새로 작성해 주세요</h2><p>제목·본문·사진 주소를 편집하고 공개 여부를 관리합니다.</p></section>}
    </div>
  </main>
}

function NewsEditor({selection,failed,onSaved,onDirty}:{selection:{id:string;fresh:boolean};failed:(cause:unknown)=>string;onSaved:()=>void;onDirty:(dirty:boolean)=>void}) {
  const [post,setPost]=useState<NewsPost|null>(null)
  const [draft,setDraft]=useState<NewsContent>(emptyNews)
  const [baseline,setBaseline]=useState(()=>JSON.stringify(emptyNews()))
  const [loading,setLoading]=useState(!selection.fresh)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [preview,setPreview]=useState(false)
  const [reload,setReload]=useState(0)
  const controller=useRef<AbortController|null>(null)
  const dirty=JSON.stringify(draft)!==baseline
  useEffect(()=>{
    onDirty(dirty)
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',beforeUnload)
    return ()=>window.removeEventListener('beforeunload',beforeUnload)
  },[dirty,onDirty])
  useEffect(()=>{
    const abort=new AbortController();controller.current=abort
    if(!selection.fresh || reload>0) {
      adminRequest<NewsPost>('news:detail',{postId:selection.id},abort.signal).then(value=>{
        if(!abort.signal.aborted){setPost(value);setDraft(value.draft);setBaseline(JSON.stringify(value.draft))}
      }).catch(cause=>{if(!abort.signal.aborted)setError(failed(cause))})
        .finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    }
    return ()=>abort.abort()
  },[selection.id,selection.fresh,reload,failed])
  function change<K extends keyof NewsContent>(key:K,value:NewsContent[K]){setDraft(v=>({...v,[key]:value}));setNotice('')}
  async function persist(action:'news:save'|'news:publish',publish?:boolean) {
    if(!controller.current || busy)return
    if(action==='news:publish' && !window.confirm(publish?'저장된 초안을 홈페이지에 게시할까요?':'홈페이지에서 이 소식을 비공개로 전환할까요?'))return
    const signal=controller.current.signal
    setBusy(true);setError('');setNotice('')
    try {
      const value=await adminRequest<NewsPost>(action,{postId:selection.id,version:post?.version??0,...(action==='news:save'?{draft}:{publish})},signal)
      if(!signal.aborted){setPost(value);setDraft(value.draft);setBaseline(JSON.stringify(value.draft));onDirty(false);setNotice(action==='news:save'?'임시저장했습니다. 공개 내용은 바뀌지 않았습니다.':publish?'게시했습니다. 홈페이지에서 확인할 수 있습니다.':'비공개로 전환했습니다.');onSaved()}
    } catch(cause){if(!signal.aborted)setError(`${failed(cause)} 작성 내용은 유지됩니다. 결과가 불확실하면 최신 저장본을 확인해 주세요.`)}
    finally{if(!signal.aborted)setBusy(false)}
  }
  function localized(key:'title'|'summary'|'body'|'imageAlt',label:string,multiline=false,maxLength=1000) {
    return <div className="admin-news-language">{(['ko','en'] as const).map(language=><label key={language}>{label} · {language==='ko'?'한국어':'영어 (선택)'}
      {multiline?<textarea rows={key==='body'?10:3} maxLength={maxLength} value={draft[key]?.[language]??''} onChange={e=>change(key,{ko:'',en:'',...draft[key],[language]:e.target.value})}/>
        :<input required={key==='title'&&language==='ko'} maxLength={maxLength} value={draft[key]?.[language]??''} onChange={e=>change(key,{ko:'',en:'',...draft[key],[language]:e.target.value})}/>}
    </label>)}</div>
  }
  return <section className="admin-panel admin-news-editor"><div className="admin-panel-heading"><h2>{selection.fresh&&!post?'새 소식 작성':'소식 편집'}</h2><span className="admin-muted">{post?stateLabel(post):'아직 저장하지 않음'}</span></div>
    {loading?<p className="admin-empty" role="status">글을 불러오는 중입니다.</p>:<form onSubmit={e=>{e.preventDefault();void persist('news:save')}}>
      <fieldset disabled={busy}>
        {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p className="admin-success" role="status">{notice}</p>}
        <p className="admin-note">{post ? `게시물 번호: ${post.post_number ?? '—'} · 주소: /news/${post.post_number ?? post.slug}` : '게시물 번호와 주소는 첫 임시저장 시 자동으로 생성됩니다.'}</p>
        <div className="admin-news-language">
          <label>게시 날짜<input required type="date" value={draft.date} onChange={e=>change('date',e.target.value)}/></label>
          <label>분류<select value={draft.category} onChange={e=>change('category',e.target.value)}>{['News','Notice','Press','Exhibition'].map(c=><option key={c}>{c}</option>)}</select></label></div>
        {localized('title','제목',false,200)}{localized('summary','요약',true,1000)}{localized('body','본문',true,10000)}
        <p className="admin-note">본문은 일반 텍스트입니다. 빈 줄로 문단을 나눕니다. 영어를 비워두면 한국어가 표시됩니다.</p>
        <label>대표 이미지 주소<input value={draft.image??''} maxLength={1000} onChange={e=>change('image',e.target.value)} placeholder="https://… 또는 /uploads/news/…"/></label>
        {localized('imageAlt','대표 이미지 설명',false,300)}
        <label>관련 링크<input value={draft.url??''} maxLength={1000} onChange={e=>change('url',e.target.value)} placeholder="https://…"/></label>
        <div className="admin-panel-heading"><h3>추가 사진</h3><button type="button" className="admin-button" disabled={(draft.photos?.length??0)>=10} onClick={()=>change('photos',[...draft.photos??[],{image:'',alt:{ko:'',en:''},caption:{ko:'',en:''}}])}>사진 주소 추가</button></div>
        {draft.photos?.map((photo,index)=><div className="admin-news-photo" key={index}>
          <label>사진 {index+1} 주소<input required value={photo.image} maxLength={1000} onChange={e=>change('photos',draft.photos?.map((p,i)=>i===index?{...p,image:e.target.value}:p))}/></label>
          {(['ko','en'] as const).map(language=><div className="admin-news-language" key={language}>
            <label>사진 설명 · {language}<input value={photo.alt[language]} maxLength={300} onChange={e=>change('photos',draft.photos?.map((p,i)=>i===index?{...p,alt:{...p.alt,[language]:e.target.value}}:p))}/></label>
            <label>사진 캡션 · {language}<input value={photo.caption?.[language]??''} maxLength={500} onChange={e=>change('photos',draft.photos?.map((p,i)=>i===index?{...p,caption:{ko:'',en:'',...p.caption,[language]:e.target.value}}:p))}/></label>
          </div>)}<button type="button" className="admin-button" onClick={()=>change('photos',draft.photos?.filter((_,i)=>i!==index))}>이 사진 제외</button>
        </div>)}
        <p className="admin-note">사진은 기존 업로드 경로나 HTTPS 이미지 주소로 연결합니다. 이 화면의 파일 직접 업로드는 아직 제공하지 않습니다.</p>
        <div className="admin-news-actions">
          <button className="admin-button admin-button--primary" type="submit">{busy?'처리 중…':'임시저장'}</button>
          <button className="admin-button" type="button" disabled={!post||dirty} onClick={()=>persist('news:publish',true)}>게시</button>
          <button className="admin-button" type="button" disabled={!post?.published_version||dirty} onClick={()=>persist('news:publish',false)}>비공개 전환</button>
          <button className="admin-button" type="button" onClick={()=>setPreview(v=>!v)}>{preview?'미리보기 닫기':'본문 미리보기'}</button>
          <button className="admin-button admin-button--quiet" type="button" onClick={()=>{if(!dirty||window.confirm('작성 중인 내용을 버리고 최신 저장본을 불러올까요?')){setLoading(true);setError('');setNotice('');setReload(v=>v+1)}}}>최신 저장본 불러오기</button>
        </div>
        {dirty&&<p className="admin-note">저장하지 않은 변경사항이 있습니다. 게시하려면 먼저 임시저장해 주세요.</p>}
      </fieldset>
      {preview&&<div className="admin-news-preview"><p className="admin-eyebrow">미리보기 · 아직 게시되지 않은 내용일 수 있습니다</p><h2>{draft.title.ko||'제목 없음'}</h2><p>{draft.summary.ko}</p><div>{draft.body?.ko.split(/\n\s*\n/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div></div>}
    </form>}
  </section>
}
