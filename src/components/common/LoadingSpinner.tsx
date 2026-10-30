export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-surface-border border-t-brand-600" />
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  )
}
