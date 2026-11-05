import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { validatePublication } from '../server/publicationValidation.ts'
import { createPublicationsHandler } from '../server/publications.ts'
import { createAdminHandler } from '../server/admin.ts'
import { getAdminConfig } from '../server/adminConfig.ts'
import { createAdminCookie } from '../server/adminSession.ts'
import { createRecruitDatabase } from '../server/supabase.ts'
import { FormError } from '../server/validation.ts'
import { readPublications } from '../src/services/publications.ts'
const origin='https://example.test',actor=randomUUID(),postId=randomUUID()
const config=getAdminConfig({PUBLICATIONS_CMS_ENABLED:'true',SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',FORM_SIGNING_SECRET:'test-only-secret-longer-than-thirty-two-characters',FORM_ALLOWED_ORIGINS:origin,BLOB_READ_WRITE_TOKEN:'test'})
const content={year:2026,title:'Test publication',authors:'Author A',mycodxAuthors:'Author A',journal:'Test Journal',volume:'1',article:'20',doi:'10.1234/example',url:'/papers/example.pdf',description:{ko:'가상 논문',en:'Test',fr:'Essai',ja:'テスト'}}

test('publication validation preserves multilingual content and strips untrusted publication/auth fields',()=>{
  assert.deepEqual(validatePublication({...content,published:true,p_actor:randomUUID()}),content)
  assert.equal(validatePublication({...content,url:'https://doi.org/10.1234/example'}).url,'https://doi.org/10.1234/example')
  for(const value of [{year:NaN},{year:'2026'},{year:2201},{title:''},{authors:'a\0b'},{title:'x'.repeat(501)},{description:null},{description:{ko:'x'.repeat(2001)}},{doi:'https://doi.org/10.1234/x'},{doi:'10.1/x'},
    ...['javascript:alert(1)','data:text/html,test','//evil.test','/papers/../secret','/papers/%2e%2e/file.pdf','/api/admin','https://user:pass@example.test/paper'].map(url=>({url}))]) {
    assert.throws(()=>validatePublication({...content,...value}),FormError)
  }
})

test('public publications use explicit legacy mode; failures never return stale repository papers',async()=>{
  let calls=0
  const database={async rpc(){calls++;throw new Error('PRIVATE_DATABASE_DETAIL')}}
  const request=new Request(origin+'/api/publications')
  const legacy=await createPublicationsHandler(config,database,false)(request)
  assert.deepEqual(await legacy.json(),{enabled:false,items:[],nextCursor:null});assert.equal(calls,0)
  const failed=await createPublicationsHandler(config,database,true,()=>{})(request)
  assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'UNAVAILABLE'})
  await assert.rejects(readPublications(Response.json({error:'UNAVAILABLE'},{status:503})))
  await assert.rejects(readPublications(Response.json({enabled:true,items:[{title:'malformed'}],nextCursor:null})))
})

test('public publication pagination validates cursors and only calls the published RPC',async()=>{
  const rows=Array.from({length:21},()=>({...content,id:randomUUID()}));const calls=[]
  const handler=createPublicationsHandler(config,{async rpc(...args){calls.push(args);return rows}},true)
  const response=await handler(new Request(origin+'/api/publications'))
  const body=await response.json();assert.equal(body.items.length,20);assert.deepEqual(body.nextCursor,{year:2026,id:rows[19].id})
  assert.equal(response.headers.get('cache-control'),'no-store')
  await handler(new Request(origin+`/api/publications?beforeYear=2026&beforeId=${postId}`))
  assert.deepEqual(calls.at(-1),['publications_public_list',{p_before_year:2026,p_before_id:postId}])
  for(const suffix of ['?beforeYear=2026','?beforeYear=NaN&beforeId=x','?beforeYear=2500&beforeId='+postId])assert.equal((await handler(new Request(origin+'/api/publications'+suffix))).status,400)
  assert.equal((await handler(new Request(origin+'/api/publications',{method:'POST'}))).status,405)
})

function fixture(enabled=true) {
  let active=true;const calls=[]
  const database={async rpc(name,args){calls.push([name,args]);if(name==='recruit_is_admin')return active;if(!active)throw new FormError('ADMIN_FORBIDDEN',403)
    if(name==='publications_admin_list')return Array.from({length:21},()=>({id:randomUUID(),title:'Test',year:2026,updated_at:'2026-11-05T00:00:00.123456+00:00'}))
    return{id:postId,draft:args.p_draft,version:1}}}
  const handler=createAdminHandler({config:{...config,publicationsEnabled:enabled},gateway:{async getUser(){return{id:actor,email:'admin@example.test'}}},database,store:{},log:()=>{}})
  const cookie=createAdminCookie('header.payload.signature',3600,config).cookie.split(';')[0]
  return {calls,revoke(){active=false},request(body,headers={}){return handler(new Request(origin+'/api/admin',{method:'POST',headers:{origin,'X-Admin-Request':'1','Content-Type':'application/json',cookie,...headers},body:JSON.stringify(body)}))}}
}
test('all publication admin actions require authenticated approved actor and same origin',async()=>{
  for(const action of ['list','detail','save','publish']) {
    const f=fixture(),body={action:'publications:'+action,postId,version:0,draft:content,publish:true,p_actor:randomUUID()}
    assert.equal((await f.request(body,{cookie:''})).status,401)
    assert.equal((await f.request(body,{origin:'https://other.test'})).status,403)
    f.revoke();assert.equal((await f.request(body)).status,403)
    const disabled=fixture(false);assert.equal((await disabled.request(body)).status,503);assert.equal(disabled.calls.length,0)
  }
})
test('publication admin API uses verified actor, validates input, keeps cursor microseconds',async()=>{
  const f=fixture()
  const response=await f.request({action:'publications:list'}), list=await response.json()
  assert.equal(list.items.length,20);assert.equal(list.nextCursor.time,'2026-11-05T00:00:00.123456+00:00')
  await f.request({action:'publications:list',before:list.nextCursor});assert.equal(f.calls.at(-1)[1].p_before_time,list.nextCursor.time)
  await f.request({action:'publications:save',postId,version:0,draft:{...content,published:true},p_actor:randomUUID()})
  assert.deepEqual(f.calls.at(-1),['publications_save',{p_actor:actor,p_post_id:postId,p_version:0,p_draft:content}])
  for(const body of [{version:-1},{version:'0'},{postId:'invalid'},{draft:{...content,url:'javascript:alert(1)'}}])assert.equal((await f.request({action:'publications:save',postId,version:0,draft:content,...body})).status,400)
  assert.equal((await f.request({action:'publications:publish',postId,version:1,publish:'true'})).status,400)
  assert.equal((await f.request({action:'publications:publish',postId,version:1,publish:false})).status,200)
  assert.deepEqual(f.calls.at(-1),['publications_publish',{p_actor:actor,p_post_id:postId,p_version:1,p_publish:false}])
})
test('publication database adapter maps only known conflicts and conceals raw SQL data',async()=>{
  for(const [message,status] of [['PUBLICATION_NOT_FOUND',404],['PUBLICATION_DOI_EXISTS',409],['VERSION_CONFLICT',409]]) {
    const database=createRecruitDatabase(config,async()=>Response.json({message,details:'PRIVATE_DRAFT'},{status:400}))
    await assert.rejects(database.rpc('publications_save',{}),e=>e.code===message&&e.status===status&&!e.message.includes('PRIVATE_DRAFT'))
  }
})
