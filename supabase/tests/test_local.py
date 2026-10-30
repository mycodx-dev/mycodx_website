"""Integration checks against a disposable LOCAL PostgreSQL fixture only.

Usage: python3 supabase/tests/test_local.py /private/tmp/mycodx-recruit-pg.XXXXXX 55439
The bootstrap and migration must already have been applied to mycodx_recruit_test.
Never point this script at a real Supabase project. Uses Python stdlib and psql only.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

root = Path(__file__).resolve().parents[2]
socket = Path(sys.argv[1]).resolve()
if socket.parent != Path('/private/tmp') or not socket.name.startswith('mycodx-recruit-pg.'):
    raise SystemExit('Only a disposable /private/tmp/mycodx-recruit-pg.* Unix socket is allowed')
port = str(int(sys.argv[2]))
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
cmd = ['psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', str(socket),
       '-p', port, '-U', 'postgres', '-d', 'mycodx_recruit_test']


def run(sql, error=None):
    p = subprocess.run(cmd + ['-c', sql], env=env, text=True, capture_output=True, timeout=15)
    if error:
        assert p.returncode and error in p.stderr, (error, p.stdout, p.stderr)
        return None
    assert p.returncode == 0, p.stderr
    return p.stdout.strip()


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def rpc(name, args, error=None, role='service_role'):
    return run(f'SET ROLE {role}; SELECT public.{name}({args});', error)


def parsed(value):
    return json.loads(value) if value else None


def parallel(sql):
    procs = [subprocess.Popen(cmd + ['-c', sql], env=env, text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE) for _ in range(2)]
    results = []
    for p in procs:
        out, err = p.communicate(timeout=15)
        assert p.returncode == 0, err
        results.append(parsed(out.strip()))
    return results


fields = dict(name='가상 지원자', email='applicant@example.test', phone='010-0000-0000',
              area='기타 사업', education='기타', experience='신입', message='Local test only')
files = [dict(group=g, name='same.pdf', size=16) for g in ('application', 'degree', 'transcript')]
admin = '10000000-0000-4000-8000-000000000001'
other = '10000000-0000-4000-8000-000000000002'
checks = 0


def passed(label):
    global checks
    checks += 1
    print(f'PASS {checks}: {label}', flush=True)


def start_args(app_id, key, input_fields=None, input_files=None, consent=True):
    return ','.join([literal(app_id), literal(key), literal(json.dumps(input_fields or fields)),
                     literal(json.dumps(files if input_files is None else input_files)),
                     "'ko'", 'true' if consent else 'false', "'recruit-consent-v1'"])


def upload_and_verify(session):
    for f in session['files']:
        # Fixture metadata only. Actual Storage API and bytes are NOT simulated as network uploads.
        run("insert into storage.objects(bucket_id,name,metadata) values('recruit-files',"
            + literal(f['object_path']) + ",'{\"size\":16}')")
        rpc('recruit_verify_file', ','.join([literal(session['id']), literal(f['id']), literal('a' * 64)]))


assert run('select current_database()') == 'mycodx_recruit_test'
assert run("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
           "where n.nspname='public' and p.proname like 'recruit_%' and "
           "(has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') "
           "or not has_function_privilege('service_role',p.oid,'EXECUTE') or not p.prosecdef)") == '0'
assert run("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
           "where n.nspname='public' and c.relkind='r' and c.relname like 'recruit_%' and c.relrowsecurity") == '5'
for role in ('anon', 'authenticated', 'service_role'):
    run(f'SET ROLE {role}; SELECT * FROM public.recruit_applications', 'permission denied')
    run(f"SET ROLE {role}; UPDATE public.recruit_admins SET active=true", 'permission denied')
for role in ('anon', 'authenticated'):
    rpc('recruit_is_admin', literal(admin), 'permission denied', role)
    rpc('recruit_begin_application', start_args(uuid.uuid4(), '0' * 64), 'permission denied', role)
passed('RLS enabled; direct table access and browser RPC execution denied')

app = str(uuid.uuid4())
key = '1' * 64
args = start_args(app, key)
session = parsed(rpc('recruit_begin_application', args))
assert len(session['files']) == 3
assert len({f['object_path'] for f in session['files']}) == 3
assert all('same.pdf' not in f['object_path'] for f in session['files'])
repeat = parsed(rpc('recruit_begin_application', start_args(uuid.uuid4(), key)))
assert repeat['id'] == app and repeat['files'] == session['files']
assert repeat['created_at'] == session['created_at'] and repeat['staging_expires_at'] == session['staging_expires_at']
rpc('recruit_begin_application', start_args(uuid.uuid4(), key, {**fields, 'name': 'Changed'}), 'IDEMPOTENCY_CONFLICT')
rpc('recruit_begin_application', start_args(uuid.uuid4(), '2' * 64, consent=False), 'INVALID_FIELDS')
rpc('recruit_begin_application', start_args(uuid.uuid4(), '2' * 64, input_files=files[:2]), 'FILES_REQUIRED')
rpc('recruit_begin_application', start_args(uuid.uuid4(), '2' * 64,
    input_files=[{**f, 'size': 4194304} for f in files]), 'FILES_REQUIRED_OR_TOO_LARGE')
rpc('recruit_begin_application', start_args(uuid.uuid4(), '2' * 64,
    input_fields={**fields, 'email': 'a@example.test\r\nBcc:other@example.test'}), 'INVALID_FIELDS')
passed('Stable idempotency, payload conflict, consent, file count/size and header injection checks')

race_app = str(uuid.uuid4())
race_args = start_args(race_app, '3' * 64)
race = parallel(f'BEGIN; SET ROLE service_role; SELECT public.recruit_begin_application({race_args}); SELECT pg_sleep(0.15); COMMIT;')
assert race[0] == race[1]
assert run("select count(*) from public.recruit_applications where idempotency_key_hash=" + literal('3' * 64)) == '1'
passed('Concurrent begin requests create one application and one set of files')

rpc('recruit_finalize_application', f"'{app}','hr@example.test','smtp'", 'FILES_NOT_READY')
assert run(f"select count(*) from public.recruit_notifications where application_id='{app}'") == '0'
f = session['files'][0]
run("insert into storage.objects(bucket_id,name,metadata) values('recruit-files',"
    + literal(f['object_path']) + ",'{\"size\":17}')")
rpc('recruit_verify_file', f"'{app}','{f['id']}','{'a' * 64}'", 'STORAGE_FILE_MISMATCH')
run('delete from storage.objects where name=' + literal(f['object_path']))
upload_and_verify(session)
rpc('recruit_verify_file', f"'{app}','{f['id']}','{'a' * 64}'")
rpc('recruit_verify_file', f"'{app}','{f['id']}','{'b' * 64}'", 'VERIFIED_FILE_CHANGED')
run('update storage.objects set updated_at=updated_at+interval \'1 second\' where name=' + literal(f['object_path']))
rpc('recruit_finalize_application', f"'{app}','hr@example.test','smtp'", 'FILES_NOT_READY')
run('update storage.objects set updated_at=updated_at-interval \'1 second\' where name=' + literal(f['object_path']))
passed('Missing, wrong-size and changed Storage objects block finalization')

# Simulate failure specifically between application UPDATE and outbox INSERT.
run("create function recruit_private.test_fail_outbox() returns trigger language plpgsql as $$ begin raise exception 'TEST_OUTBOX_FAILURE'; end $$; "
    "create trigger test_outbox_failure before insert on public.recruit_notifications for each row execute function recruit_private.test_fail_outbox()")
rpc('recruit_finalize_application', f"'{app}','hr@example.test','smtp'", 'TEST_OUTBOX_FAILURE')
assert run(f"select stage from public.recruit_applications where id='{app}'") == 'staging'
assert run(f"select count(*) from public.recruit_notifications where application_id='{app}'") == '0'
run('drop trigger test_outbox_failure on public.recruit_notifications; drop function recruit_private.test_fail_outbox()')
finals = parallel(f"SET ROLE service_role; SELECT public.recruit_finalize_application('{app}','hr@example.test','smtp')")
assert finals == [{'stage': 'submitted'}] * 2
rpc('recruit_finalize_application', f"'{app}','different@example.test','resend'")
assert run(f"select count(*) from public.recruit_notifications where application_id='{app}'") == '1'
assert run(f"select recipient||'/'||provider from public.recruit_notifications where application_id='{app}'") == 'hr@example.test/smtp'
assert run(f"select expires_at = submitted_at + interval '1 year' from public.recruit_applications where id='{app}'") == 't'
passed('Atomic finalization/outbox rollback, concurrent finalization and immutable notification destination')

assert rpc('recruit_is_admin', literal(admin)) == 'f'
rpc('recruit_admin_list', literal(admin), 'ADMIN_REQUIRED')
run(f"insert into public.recruit_admins(user_id) values('{admin}')")
assert rpc('recruit_is_admin', literal(admin)) == 't'
rpc('recruit_admin_detail', f"'{other}','{app}'", 'ADMIN_REQUIRED')
detail = parsed(rpc('recruit_admin_detail', f"'{admin}','{app}'"))
assert 'payload_hash' not in detail['application'] and 'idempotency_key_hash' not in detail['application']
assert len(detail['files']) == 3 and 'object_path' not in detail['files'][0]
assert len(parsed(rpc('recruit_admin_list', literal(admin)))) == 1
assert parsed(rpc('recruit_set_review_status', f"'{admin}','{app}','reviewed',0")) == {'status': 'reviewed', 'version': 1}
rpc('recruit_set_review_status', f"'{admin}','{app}','unread',0", 'VERSION_CONFLICT')
rpc('recruit_set_review_status', f"'{admin}','{app}','unread',1")
assert run(f"select count(*) from public.recruit_audit_logs where application_id='{app}'") == '3'
run(f"update public.recruit_admins set active=false where user_id='{admin}'")
rpc('recruit_admin_list', literal(admin), 'ADMIN_REQUIRED')
run(f"update public.recruit_admins set active=true where user_id='{admin}'")
passed('Approved/disabled admins, safe projections, review CAS and transactional audit records')

download = parsed(rpc('recruit_prepare_download', f"'{admin}','{f['id']}'"))
assert download['expires_in'] == 60 and download['bucket'] == 'recruit-files'
for ttl in (0, 61):
    rpc('recruit_record_download', f"'{admin}','{f['id']}',{ttl}", 'INVALID_DOWNLOAD')
rpc('recruit_record_download', f"'{admin}','{f['id']}',60")
rpc('recruit_prepare_download', f"'{other}','{f['id']}'", 'ADMIN_REQUIRED')
run("insert into storage.objects(bucket_id,name,metadata) values('unrelated-bucket','untouched','{}')")
for role in ('anon', 'authenticated'):
    assert run(f"SET ROLE {role}; select count(*) from storage.objects where bucket_id='recruit-files'") == '0'
    assert run(f"SET ROLE {role}; select count(*) from storage.objects where bucket_id='unrelated-bucket'") == '1'
    run(f"SET ROLE {role}; insert into storage.objects(bucket_id,name) values('recruit-files','unauthorized')", 'row-level security')
    assert run(f"SET ROLE {role}; with d as (delete from storage.objects where bucket_id='recruit-files' returning *) select count(*) from d") == '0'
passed('Download authorization/TTL and restrictive Storage policy override a broad preexisting policy without affecting other buckets')

rpc('recruit_claim_notification', f"'{app}','resend'", 'PROVIDER_MISMATCH')
claims = parallel(f"SET ROLE service_role; SELECT public.recruit_claim_notification('{app}','smtp')")
assert sum(c is not None for c in claims) == 1
claim = next(c for c in claims if c)
rpc('recruit_finish_notification', f"'{app}','{uuid.uuid4()}','accepted','message-1'", 'INVALID_CLAIM')
rpc('recruit_finish_notification', f"'{app}','{claim['claim_token']}','accepted'", 'RECEIPT_REQUIRED')
rpc('recruit_finish_notification', f"'{app}','{claim['claim_token']}','failed',null,'NETWORK_UNCERTAIN'", 'USE_UNCERTAIN')
rpc('recruit_finish_notification', f"'{app}','{claim['claim_token']}','uncertain',null,'NETWORK_UNCERTAIN'")
assert rpc('recruit_claim_notification', f"'{app}','smtp'") == ''
rpc('recruit_finish_notification', f"'{app}','{claim['claim_token']}','accepted','message-1'")
rpc('recruit_finish_notification', f"'{app}','{claim['claim_token']}','accepted','message-1'")
assert run(f"select attempt_count from public.recruit_notifications where application_id='{app}'") == '1'
passed('One concurrent notification claim, receipt requirement, no ambiguous retry and late same-attempt receipt')

upload_and_verify(race[0])
rpc('recruit_finalize_application', f"'{race_app}','hr@example.test',null")
claimed = parsed(rpc('recruit_claim_notification', f"'{race_app}','resend'"))
run(f"update public.recruit_notifications set started_at=now()-interval '11 minutes' where application_id='{race_app}'")
assert rpc('recruit_claim_notification', f"'{race_app}','resend'") == ''
assert run(f"select status from public.recruit_notifications where application_id='{race_app}'") == 'uncertain'
passed('Expired worker claims become uncertain and are never automatically re-sent')

failed_app = str(uuid.uuid4())
failed_session = parsed(rpc('recruit_begin_application', start_args(failed_app, '4' * 64)))
upload_and_verify(failed_session)
rpc('recruit_finalize_application', f"'{failed_app}','hr@example.test','smtp'")
failed_claim = parsed(rpc('recruit_claim_notification', f"'{failed_app}','smtp'"))
rpc('recruit_finish_notification', f"'{failed_app}','{failed_claim['claim_token']}','failed',null,'CONFIGURATION'")
assert run(f"select status from public.recruit_notifications where application_id='{failed_app}'") == 'failed'
assert rpc('recruit_claim_notification', f"'{failed_app}','smtp'") == ''
passed('Definite pre-send failure is recorded separately and never silently retried')

run(f"update public.recruit_applications set submitted_at=now()-interval '2 years', expires_at=now()-interval '1 year' where id='{app}'")
rpc('recruit_admin_detail', f"'{admin}','{app}'", 'APPLICATION_NOT_AVAILABLE')
rpc('recruit_prepare_download', f"'{admin}','{f['id']}'", 'APPLICATION_NOT_AVAILABLE')
assert rpc('recruit_submission_status', literal(app)) == ''
assert all(a['id'] != app for a in parsed(rpc('recruit_admin_list', literal(admin))))
passed('Expired data is unavailable to all applicant/admin read and download paths')

before = run('select count(*) from public.recruit_applications')
p = subprocess.run(cmd + ['-f', str(root / 'supabase/migrations/202610300001_recruit.sql')], env=env,
                   text=True, capture_output=True, timeout=15)
assert p.returncode and 'Recruit objects already exist' in p.stderr
assert run('select count(*) from public.recruit_applications') == before
passed('Duplicate migration aborts without losing data or changing permissions')

p = subprocess.run(cmd + ['-f', str(root / 'supabase/verification/02_verify.sql')], env=env,
                   text=True, capture_output=True, timeout=15)
assert p.returncode == 0, p.stderr
passed('Read-only post-application verification SQL executes successfully')
print(f'{checks} integration groups passed; fixtures are LOCAL ONLY; no real files, emails or Supabase calls.')
