interface SectionTitleProps {
  title: string
  subtitle?: string
}

export default function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{subtitle ?? 'Overview'}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
    </div>
  )
}
