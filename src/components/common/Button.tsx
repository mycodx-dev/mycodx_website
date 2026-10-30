import type { ButtonHTMLAttributes, DetailedHTMLProps } from 'react'

type ButtonProps = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>

export default function Button(props: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${props.className ?? ''}`}>
      {props.children}
    </button>
  )
}
