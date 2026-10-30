interface ErrorMessageProps {
  error: string | null
  retry?: () => void
}

export default function ErrorMessage({ error, retry }: ErrorMessageProps) {
  if (!error) return null

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-900">Failed to load content</p>
      <p className="mt-1 text-sm text-red-700">{error}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  )
}
