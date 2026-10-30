import type { ReactNode } from 'react'

const MYCOBACTERIUM_TUBERCULOSIS = 'Mycobacterium tuberculosis'

export function formatScientificNames(text: string): ReactNode {
  if (!text.includes(MYCOBACTERIUM_TUBERCULOSIS)) {
    return text
  }

  const parts = text.split(MYCOBACTERIUM_TUBERCULOSIS)

  return parts.flatMap((part, index) => {
    const nodes: ReactNode[] = []

    if (part) {
      nodes.push(part)
    }

    if (index < parts.length - 1) {
      nodes.push(
        <i className="scientific-name" key={`${MYCOBACTERIUM_TUBERCULOSIS}-${index}`}>
          {MYCOBACTERIUM_TUBERCULOSIS}
        </i>,
      )
    }

    return nodes
  })
}
