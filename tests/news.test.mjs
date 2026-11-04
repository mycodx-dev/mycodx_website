import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { validateNews } from '../server/newsValidation.ts'
import { createNewsHandler } from '../server/news.ts'
import { createAdminHandler } from '../server/admin.ts'
import { getAdminConfig } from '../server/adminConfig.ts'
import { createAdminCookie } from '../server/adminSession.ts'
import { createRecruitDatabase } from '../server/supabase.ts'

const origin='https://example.test',actor=randomUUID(),postId=randomUUID()
const config=getAdminConfig({NEWS_CMS_ENABLED:'true',SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',FORM_SIGNING_SECRET:'test-only-secret-longer-than-thirty-two-characters',FORM_ALLOWED_ORIGINS:origin,BLOB_READ_WRITE_TOKEN:'test'})
const content={id:'test-news',date:'2026-11-04',category:'News',title:{ko:'가상 소식',en:''},summary:{ko:'요약',en:''},body:{ko:'일반 텍스트\n\n두 번째 문단',en:''}}

test('news validates text/date/slug and preserves supported translations without accepting executable URLs',()=>{
  const result=validateNews({...content,title:{...content.title,ja:'見出し'},visible:false,secret:'PRIVATE',photos:[{image:'/uploads/news/test.jpg',alt:{ko:'사진',en:''}}]})
  assert.equal(result.title.ja,'見出し');assert.equal(result.visible,true);assert.equal(result.secret,undefined)
  for(const fields of [{id:'../x'},{id:'bad slug'},{date:'2026-02-30'},{title:{ko:'',en:'x'}},{category:'Unknown'},{url:'javascript:alert(1)'},{image:'//attacker.test/image'},{image:'data:image/svg+xml,<svg/>'},{url:'https://user:pass@example.test'},{body:{ko:'x'.repeat(10001),en:''}},{photos:Array(11).fill({})}]) assert.throws(()=>validateNews({...content,...fields}))
  // Stored text is rendered as React text, never HTML or a Markdown HTML extension.
  assert.equal(validateNews({...content,body:{ko:'<script>alert(1)</script>',en:''}}).body.ko,'<script>alert(1)</script>')
})

test('public news defaults to explicit legacy mode; enabled service failure does not resurrect repository content',async()=>{
  let calls=0
  const db={async rpc(){calls++;throw new Error('PRIVATE_ERROR')}}
  const disabled=await createNewsHandler(config,db,false)(new Request(origin+'/api/news'))
  assert.deepEqual(await disabled.json(),{enabled:false,items:[],nextCursor:null});assert.equal(calls,0)
  const logs=[]
  const failed=await createNewsHandler(config,db,true,message=>logs.push(message))(new Request(origin+'/api/news'))
  assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'UNAVAILABLE'})
  assert.ok(!JSON.stringify(logs).includes('PRIVATE_ERROR'))
})

test('public news uses only published RPC and validates cursor/slug, never accepts admin actions',async()=>{
  const calls=[]
  const db={async rpc(name,args){calls.push([name,args]);return Array.from({length:21},(_,i)=>({...content,id:`news-${i}`}))}}
  const handler=createNewsHandler(config,db,true)
  const result=await handler(new Request(origin+'/api/news?beforeDate=2026-11-04&beforeSlug=test-news'))
  const data=await result.json();assert.equal(data.items.length,20);assert.equal(data.nextCursor.slug,'news-19')
  assert.equal(calls[0][0],'news_public_list');assert.equal(calls[0][1].p_slug,null)
  assert.equal((await handler(new Request(origin+'/api/news?slug=../admin'))).status,400)
  assert.equal((await handler(new Request(origin+'/api/news?beforeSlug=test-news'))).status,400)
  assert.equal((await handler(new Request(origin+'/api/news',{method:'POST'}))).status,405)
  assert.match(result.headers.get('cache-control'),/no-store/)
})

test('news admin writes require verified actor and allowlist, with fixed RPCs and validated drafts',async()=>{
  const calls=[];let active=true
  const gateway={async getUser(){return{id:actor,email:'admin@example.test'}}}
  const database={async rpc(name,args){calls.push([name,args]);if(name==='recruit_is_admin')return active;return{id:postId,draft:args.p_draft,version:1}}}
  const handler=createAdminHandler({config,gateway,database,store:{},log:()=>{}})
  const cookie=createAdminCookie('header.payload.signature',3600,config).cookie.split(';')[0]
  const request=(body,withCookie=true)=>handler(new Request(origin+'/api/admin',{method:'POST',headers:{origin,'X-Admin-Request':'1','Content-Type':'application/json',cookie:withCookie?cookie:''},body:JSON.stringify(body)}))
  assert.equal((await request({action:'news:save',postId,version:0,draft:content},false)).status,401)
  active=false;assert.equal((await request({action:'news:save',postId,version:0,draft:content})).status,403)
  active=true
  assert.equal((await request({action:'news:save',postId,version:0,draft:content,p_actor:randomUUID()})).status,200)
  assert.equal(calls.at(-1)[0],'news_save');assert.equal(calls.at(-1)[1].p_actor,actor)
  assert.equal((await request({action:'news:publish',postId,version:1,publish:'true'})).status,400)
  assert.equal((await request({action:'news:publish',postId,version:1,publish:true})).status,200)
  assert.deepEqual(calls.at(-1),['news_publish',{p_actor:actor,p_post_id:postId,p_version:1,p_publish:true}])
})

test('news RPC conflicts return safe codes without exposing draft contents or SQL details',async()=>{
  for(const message of ['NEWS_NOT_FOUND','NEWS_SLUG_EXISTS','NEWS_SLUG_IMMUTABLE','VERSION_CONFLICT']) {
    const database=createRecruitDatabase(config,async()=>Response.json({message,details:'PRIVATE_DRAFT'},{status:400}))
    await assert.rejects(database.rpc('news_save',{}),error=>error.code===message&&!error.message.includes('PRIVATE_DRAFT'))
  }
})
