import { useEffect, useRef, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { toast } from '../stores/toasts'
import { Icon } from './Icon'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function handleClick() {
    if (await copyText(text)) {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
    } else {
      toast.error("Couldn't copy. Select the text and copy it manually.")
    }
  }

  return (
    <button type="button" onClick={handleClick} className="btn btn-ghost btn-sm" aria-live="polite">
      <Icon name={copied ? 'check' : 'copy'} className="size-3.5" />
      {copied ? 'Copied' : label}
    </button>
  )
}
