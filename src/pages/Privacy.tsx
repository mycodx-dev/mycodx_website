import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

const privacyContent = {
  ko: {
    kicker: 'Privacy',
    title: '개인정보 수집·이용 안내',
    intro: '주식회사 마이코디엑스는 홈페이지 문의에 답변하기 위해 필요한 최소한의 개인정보를 처리합니다.',
    close: '닫기',
    sections: [
      ['수집 항목', '필수: 성명, 이메일, 문의 유형, 문의 내용 · 선택: 소속'],
      ['이용 목적', '문의 내용 확인, 담당자 배정, 답변 및 후속 연락'],
      ['보유 및 이용 기간', '문의 처리 목적이 달성되면 지체 없이 파기합니다. 단, 관련 법령에 보관 의무가 있는 경우에는 해당 기간 동안 보관합니다.'],
      ['처리 및 전송', '문의 내용은 Vercel에서 처리하고 이카운트 웹메일 또는 Resend를 통해 업무용 메일함으로 전달합니다. Vercel의 임시 처리 기록은 비공개 저장소에 7일간 보관한 후 다음 정리 작업에서 삭제합니다. 발송 서비스와 담당자 메일함의 기록은 별도로 관리합니다. 민감정보는 문의 내용에 입력하지 마세요.'],
      ['동의 거부 권리', '개인정보 수집·이용에 동의하지 않을 수 있으나, 필수 항목에 동의하지 않으면 홈페이지 문의 기능을 이용할 수 없습니다.'],
      ['문의처', '개인정보 관련 문의: info@mycodx.com'],
    ],
  },
  en: {
    kicker: 'Privacy',
    title: 'Privacy notice for website inquiries',
    intro: 'MycoDx Co., Ltd. processes only the personal information needed to respond to website inquiries.',
    close: 'Close',
    sections: [
      ['Information collected', 'Required: name, email, inquiry type, and message · Optional: organization'],
      ['Purpose of use', 'Reviewing inquiries, assigning the appropriate contact, responding, and following up'],
      ['Retention', 'Information is deleted without delay once the inquiry has been handled, unless applicable law requires retention for a specified period.'],
      ['Processing and transfer', 'Inquiries are processed on Vercel and sent through ECOUNT Webmail or Resend to our business mailbox. Temporary Vercel records are stored privately for seven days, then removed by the next cleanup. Records held by the sending service and recipient mailbox are managed separately. Please do not include sensitive personal information in your message.'],
      ['Right to decline', 'You may decline consent, but the website inquiry form cannot be used without consent to the required processing.'],
      ['Contact', 'Privacy inquiries: info@mycodx.com'],
    ],
  },
  fr: {
    kicker: 'Confidentialité',
    title: 'Avis de confidentialité pour les demandes en ligne',
    intro: 'MycoDx Co., Ltd. traite uniquement les données personnelles nécessaires pour répondre aux demandes envoyées depuis le site.',
    close: 'Fermer',
    sections: [
      ['Données collectées', "Obligatoires : nom, e-mail, type de demande et message · Facultative : organisation"],
      ["Finalité", "Examen de la demande, attribution au bon interlocuteur, réponse et suivi"],
      ['Conservation', "Les données sont supprimées sans délai après le traitement de la demande, sauf lorsqu'une durée de conservation est imposée par la loi."],
      ['Traitement et transmission', "Les demandes sont traitées par Vercel et envoyées via ECOUNT Webmail ou Resend à notre messagerie professionnelle. Les données temporaires de Vercel sont conservées dans un espace privé pendant sept jours, puis supprimées au prochain nettoyage. Les données du service d’envoi et de la boîte destinataire sont gérées séparément. Veuillez ne pas inclure de données personnelles sensibles."],
      ['Droit de refus', "Vous pouvez refuser votre consentement, mais le formulaire ne peut pas être utilisé sans consentement au traitement requis."],
      ['Contact', 'Questions relatives aux données personnelles : info@mycodx.com'],
    ],
  },
  ja: {
    kicker: 'Privacy',
    title: 'お問い合わせに関する個人情報の取扱い',
    intro: '株式会社MycoDxは、ウェブサイトからのお問い合わせに回答するために必要な最小限の個人情報を取り扱います。',
    close: '閉じる',
    sections: [
      ['収集項目', '必須：氏名、メールアドレス、お問い合わせ種別、お問い合わせ内容 · 任意：所属'],
      ['利用目的', 'お問い合わせ内容の確認、担当者の割り当て、回答および必要なご連絡'],
      ['保有期間', 'お問い合わせ対応の目的を達成した後、遅滞なく削除します。ただし、法令により保管が必要な場合は所定の期間保管します。'],
      ['処理および送信', 'お問い合わせ内容はVercelで処理し、ECOUNTウェブメールまたはResendを通じて業務用メールボックスに送信します。Vercelの一時記録は非公開で7日間保管した後、次の削除処理で削除します。送信サービスと受信メールボックスの記録は別途管理します。機微な個人情報は入力しないでください。'],
      ['同意を拒否する権利', '同意を拒否できますが、必須の取扱いに同意しない場合はお問い合わせフォームを利用できません。'],
      ['お問い合わせ先', '個人情報に関するお問い合わせ：info@mycodx.com'],
    ],
  },
} as const

export default function Privacy() {
  const { i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const language = i18n.resolvedLanguage?.split('-')[0] ?? i18n.language.split('-')[0]
  const content = privacyContent[language as keyof typeof privacyContent] ?? privacyContent.ko
  const openedFromContact = Boolean((location.state as { fromContact?: boolean } | null)?.fromContact)

  const closePrivacy = () => {
    if (openedFromContact) {
      navigate(-1)
      return
    }

    navigate('/#contact')
  }

  return (
    <div className="editorial-page legal-page">
      <header className="editorial-page__header">
        <p>{content.kicker}</p>
        <h1>{content.title}</h1>
        <span>{content.intro}</span>
      </header>

      <div className="legal-page__content">
        {content.sections.map(([title, description]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
          </section>
        ))}
        <button type="button" className="legal-page__close" onClick={closePrivacy}>
          <span aria-hidden="true">←</span>
          {content.close}
        </button>
      </div>
    </div>
  )
}
