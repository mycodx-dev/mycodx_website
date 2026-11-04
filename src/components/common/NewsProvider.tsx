import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import newsData from '../../content/news.json'
import type { NewsContent, PublicNewsResult } from '../../../shared/news'
import { NewsContext } from '../../services/newsContext'
function decode(value:string){try{return decodeURIComponent(value)}catch{return value}}
async function readNews(response:Response):Promise<PublicNewsResult>{
  if(!response.ok)throw new Error('News unavailable')
  const value=await response.json()
  if(!value || typeof value.enabled!=='boolean' || !Array.isArray(value.items) ||
    (value.nextCursor!==null && (typeof value.nextCursor?.date!=='string'||typeof value.nextCursor?.slug!=='string')))throw new Error('Invalid news response')
  return value
}

export default function NewsProvider({children}:{children:ReactNode}) {
  const {pathname}=useLocation()
  const active=pathname==='/news'||pathname.startsWith('/news/')
  const [state,setState]=useState<{key:string;items:NewsContent[];error:boolean;cursor:PublicNewsResult['nextCursor']}>({key:'',items:[],error:false,cursor:null})
  const [revision,setRevision]=useState(0)
  const [loadingMore,setLoadingMore]=useState(false)
  const controller=useRef<AbortController|null>(null)
  const loadingRef=useRef(false)
  useEffect(()=>{
    const abort=new AbortController();controller.current=abort;loadingRef.current=false
    if(active) {
      const params=pathname.startsWith('/news/')?`?slug=${encodeURIComponent(decode(pathname.slice(6)))}`:''
      fetch(`/api/news${params}`,{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])})
        .then(readNews)
        .then(result=>{
          if(!abort.signal.aborted){setLoadingMore(false);setState({key:pathname,items:result.enabled?result.items:(newsData as NewsContent[]).filter(n=>n.visible!==false).sort((a,b)=>b.date.localeCompare(a.date)),error:false,cursor:result.enabled?result.nextCursor:null})}
        }).catch(()=>{if(!abort.signal.aborted){setLoadingMore(false);setState({key:pathname,items:[],error:true,cursor:null})}})
    }
    return ()=>abort.abort()
  },[pathname,active,revision])
  async function more(){
    if(!state.cursor||loadingRef.current||!controller.current)return
    const signal=controller.current.signal, key=pathname
    loadingRef.current=true;setLoadingMore(true)
    try{
      const params=new URLSearchParams({beforeDate:state.cursor.date,beforeSlug:state.cursor.slug})
      const response=await fetch(`/api/news?${params}`,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])})
      const result=await readNews(response)
      if(!result.enabled)throw new Error('News mode changed; reload')
      if(!signal.aborted)setState(previous=>previous.key===key?{...previous,items:[...previous.items,...result.items.filter(item=>!previous.items.some(old=>old.id===item.id))],cursor:result.nextCursor,error:false}:previous)
    }catch{if(!signal.aborted)setState(previous=>({...previous,error:true}))}
    finally{if(!signal.aborted){loadingRef.current=false;setLoadingMore(false)}}
  }
  return <NewsContext.Provider value={{items:active&&state.key===pathname?state.items:[],loading:active&&state.key!==pathname,error:active&&state.key===pathname&&state.error,
    hasMore:state.key===pathname&&!!state.cursor,loadingMore,
    retry:()=>{setState(v=>({...v,key:''}));setRevision(v=>v+1)},more}}>{children}</NewsContext.Provider>
}
