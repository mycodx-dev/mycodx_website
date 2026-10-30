import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import MemberCard from '../components/members/MemberCard'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import { useDataStore } from '../store/dataStore'

export default function Members() {
  const { t, i18n } = useTranslation()
  const members = useDataStore((state) => state.members)
  const membersLoading = useDataStore((state) => state.membersLoading)
  const membersError = useDataStore((state) => state.membersError)
  const fetchMembers = useDataStore((state) => state.fetchMembers)

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const representative = members[0]
  const researchers = members.slice(1)
  const isEnglish = i18n.language.startsWith('en')
  const getMemberCardProps = (member: (typeof members)[number]) => ({
    name: isEnglish ? member.nameEn ?? member.name : member.name,
    role: isEnglish ? member.roleEn ?? member.role : member.role,
  })

  return (
    <div className="editorial-page people-page">
      <header className="editorial-page__header">
        <p>{t('people.kicker')}</p>
        <h1>{t('people.title')}</h1>
        <span>{t('people.description')}</span>
      </header>

      {membersLoading && <LoadingSpinner />}
      {membersError && <ErrorMessage error={membersError} retry={fetchMembers} />}
      {!membersLoading && !membersError && (
        <div className="people-sections">
          {representative && (
            <section id="pi" className="people-section">
              <div className="editorial-section-heading">
                <span>01</span>
                <h2>{t('people.representative')}</h2>
              </div>
              <div className="people-grid people-grid--representative">
                <MemberCard {...getMemberCardProps(representative)} />
              </div>
            </section>
          )}

          <section id="current-members" className="people-section">
            <div className="editorial-section-heading">
              <span>02</span>
              <h2>{t('people.researchers')}</h2>
            </div>
            <div className="people-grid">
              {researchers.map((member) => (
                <MemberCard key={member.id} {...getMemberCardProps(member)} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
