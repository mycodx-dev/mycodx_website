interface MemberCardProps {
  name: string
  role: string
}

export default function MemberCard({ name, role }: MemberCardProps) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')

  return (
    <article className="member-card">
      <span className="member-card__initials" aria-hidden="true">{initials}</span>
      <div>
        <h3>{name}</h3>
        <p>{role}</p>
      </div>
    </article>
  )
}
