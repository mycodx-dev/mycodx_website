import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import ApplicationSuccessDialog from '../components/common/ApplicationSuccessDialog'
import { submitForm, SubmissionError } from '../services/formSubmission'
import type { SelectedFile, SubmissionProgress } from '../services/formSubmission'
import useFormAvailability from '../hooks/useFormAvailability'
import { MAX_FILES, MAX_TOTAL_FILE_SIZE } from '../../shared/forms'

const APPLICATION_FILE_TYPES = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function getTotalFileSize(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    .flatMap((input) => Array.from(input.files ?? []))
    .reduce((total, file) => total + file.size, 0)
}

export default function CareersApply() {
  const { t, i18n } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const submissionPending = useRef(false)
  const [startedAt] = useState(() => Date.now())
  const available = useFormAvailability('careers')

  const [messageLength, setMessageLength] = useState(0)
  const [fileError, setFileError] = useState('')
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [progress, setProgress] = useState<SubmissionProgress>('preparing')
  const [percentage, setPercentage] = useState(0)
  const [errorCode, setErrorCode] = useState('')
  const content = {
    back: t('careersApply.back'), title: t('careersApply.title'), lead: t('careersApply.lead'),
    successTitle: t('careersApply.successTitle'), successBody: t('careersApply.successBody'), formTitle: t('careersApply.formTitle'), required: t('careersApply.required'),
    area: t('careersApply.area'), areas: t('careersApply.areas', { returnObjects: true }) as string[],
    name: t('careersApply.name'), email: t('careersApply.email'), phone: t('careersApply.phone'), education: t('careersApply.education'), select: t('careersApply.select'), degrees: t('careersApply.degrees', { returnObjects: true }) as string[],
    experience: t('careersApply.experience'), experiences: t('careersApply.experiences', { returnObjects: true }) as string[], message: t('careersApply.message'), messagePlaceholder: t('careersApply.messagePlaceholder'), chars: t('careersApply.chars'),
    files: t('careersApply.files'), fileHelp: t('careersApply.fileHelp'), download: t('careersApply.download'), downloadMeta: t('careersApply.downloadMeta'), application: t('careersApply.application'), degree: t('careersApply.degree'), transcript: t('careersApply.transcript'), papers: t('careersApply.papers'),
    consent: t('careersApply.consent'), submit: t('careersApply.submit'), sending: t('careersApply.sending'), failed: t('careersApply.failed'), fileSizeError: t('careersApply.fileSizeError'),
  }

  const validateFileSize = (form: HTMLFormElement) => {
    const isTooLarge = getTotalFileSize(form) > MAX_TOTAL_FILE_SIZE
    setFileError(isTooLarge ? content.fileSizeError : '')
    return !isTooLarge
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.form) validateFileSize(event.currentTarget.form)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!available || submissionPending.current || !validateFileSize(form)) return
    const data = new FormData(form)
    const value = (name: string) => String(data.get(name) ?? '')
    const selected: SelectedFile[] = []
    const groups = { '자사 입사지원서': 'application', '학위 증명서': 'degree', '성적 증명서': 'transcript', '논문 및 기타 자료': 'papers' } as const
    for (const [field, group] of Object.entries(groups)) {
      for (const file of data.getAll(field)) if (file instanceof File && file.name) selected.push({ group, file })
    }
    if (selected.length > MAX_FILES) { setFileError(t('forms.errors.FILE_COUNT')); return }
    submissionPending.current = true
    setSubmissionStatus('sending')
    setErrorCode('')
    try {
      await submitForm({
        kind: 'careers', language: i18n.language.split('-')[0], startedAt,
        consent: data.has('개인정보 수집 및 인재풀 등록 동의'), website: value('_honey'),
        fields: { name: value('성명'), email: value('email'), phone: value('연락처'),
          area: value('지원 분야'), education: value('최종 학력'), experience: value('경력 구분'), message: value('주요 경력 및 지원 내용') },
      }, selected, (stage, percent) => { setProgress(stage); if (percent !== undefined) setPercentage(percent) })
      form.reset()
      setMessageLength(0)
      setFileError('')
      setSubmissionStatus('sent')
    } catch (error) {
      setErrorCode(error instanceof SubmissionError ? error.code : 'UNAVAILABLE')
      setSubmissionStatus('failed')
    } finally { submissionPending.current = false }
  }

  return (
    <div className="careers-apply-page">
      <header className="careers-apply-header">
        <Link to="/careers">← {content.back}</Link>
        <p>Application Guide</p>
        <h1>{content.title}</h1>
        <span>{content.lead}</span>
      </header>

      <section className="careers-application">
        <form ref={formRef} className="careers-form" onSubmit={handleSubmit} aria-busy={submissionStatus === 'sending'}>
          <fieldset className="form-controls" disabled={submissionStatus === 'sending'}>
          <div className="careers-form__heading">
            <span>Application form</span>
            <h2>{content.formTitle}</h2>
            <p>{content.required}</p>
          </div>
          <fieldset className="careers-form__areas"><legend>{content.area} <i>*</i></legend><div>{content.areas.map((title, index) => <label key={title}><input type="radio" name="지원 분야" value={title} defaultChecked={index === 0} required /><span>{title}</span></label>)}</div></fieldset>
          <div className="careers-form__grid">
            <label><span>{content.name} <i>*</i></span><input name="성명" type="text" autoComplete="name" maxLength={100} required /></label>
            <label><span>{content.email} <i>*</i></span><input name="email" type="email" autoComplete="email" placeholder="email@example.com" maxLength={254} required /></label>
            <label><span>{content.phone} <i>*</i></span><input name="연락처" type="tel" autoComplete="tel" placeholder="010-0000-0000" maxLength={40} required /></label>
            <label><span>{content.education} <i>*</i></span><select name="최종 학력" defaultValue="" required><option value="" disabled>{content.select}</option>{content.degrees.map((degree) => <option key={degree}>{degree}</option>)}</select></label>
            <label className="careers-form__wide"><span>{content.experience} <i>*</i></span><select name="경력 구분" defaultValue="" required><option value="" disabled>{content.select}</option>{content.experiences.map((experience) => <option key={experience}>{experience}</option>)}</select></label>
          </div>
          <label className="careers-form__message">
            <span>{content.message}</span>
            <textarea
              name="주요 경력 및 지원 내용"
              rows={6}
              maxLength={1000}
              placeholder={content.messagePlaceholder}
              onChange={(event) => setMessageLength(event.currentTarget.value.length)}
            />
            <small><span>{messageLength.toLocaleString()}</span> / 1,000 {content.chars}</small>
          </label>
          <div className="careers-form__files">
            <div className="careers-form__files-heading">
              <div><h3>{content.files} <i>*</i></h3><p>{content.fileHelp}</p></div>
              <a
                className="careers-download"
                href="/forms/MycoDx_상시채용지원서_동의서포함.docx"
                download="MycoDx_상시채용지원서_동의서포함.docx"
              >
                <span>{content.download}</span>
                <small>{content.downloadMeta}</small>
              </a>
            </div>
            <label><span>{content.application} <i>*</i></span><input name="자사 입사지원서" type="file" accept={APPLICATION_FILE_TYPES} onChange={handleFileChange} required /></label>
            <label><span>{content.degree} <i>*</i></span><input name="학위 증명서" type="file" accept=".pdf,.zip,application/pdf,application/zip" onChange={handleFileChange} multiple required /></label>
            <label><span>{content.transcript} <i>*</i></span><input name="성적 증명서" type="file" accept=".pdf,.zip,application/pdf,application/zip" onChange={handleFileChange} multiple required /></label>
            <label><span>{content.papers}</span><input name="논문 및 기타 자료" type="file" accept=".pdf,.zip,application/pdf,application/zip" onChange={handleFileChange} multiple /></label>
            {fileError && <p className="careers-form__file-error" role="alert">{fileError}</p>}
          </div>
          <label className="careers-form__consent"><input type="checkbox" name="개인정보 수집 및 인재풀 등록 동의" value="동의함" required /><span>{content.consent} <i>*</i></span></label>
          <input type="text" name="_honey" className="careers-form__honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <p className="form-storage-notice">{t('forms.storageNotice')}</p>
          </fieldset>
          <div className="careers-form__footer">
            {available !== true && <p role="status">{t(available === null ? 'forms.checkingAvailability' : 'forms.unavailable')} <a href="mailto:jakim@mycodx.com">jakim@mycodx.com</a></p>}
            {submissionStatus === 'failed' && <p className="is-error" role="alert">{t(`forms.errors.${errorCode}`, { defaultValue: content.failed })} <a href="mailto:jakim@mycodx.com">jakim@mycodx.com</a></p>}
            {submissionStatus === 'sending' && <p role="status">{t(`forms.progress.${progress}`, { percentage })}</p>}
            <button type="submit" disabled={!available || Boolean(fileError) || submissionStatus === 'sending'}>
              {submissionStatus === 'sending' ? content.sending : errorCode === 'RECRUIT_UNCERTAIN' ? t('forms.checkStatus') : content.submit}
            </button>
          </div>
        </form>
      </section>
      {submissionStatus === 'sent' && (
        <ApplicationSuccessDialog
          title={content.successTitle}
          description={t('forms.recruitAccepted')}
          confirmLabel={t('careersApply.successConfirm')}
          onClose={() => setSubmissionStatus('idle')}
        />
      )}
    </div>
  )
}
