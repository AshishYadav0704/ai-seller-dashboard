import { useId, useState, type DragEvent, type ReactNode } from 'react'
import { ACCEPTED_TYPES } from '../lib/files'

interface Props {
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
  children: ReactNode
  className?: string
  label: string
}

/** A clickable, droppable area. Validation of what was dropped is left to the caller. */
export function Dropzone({ multiple = false, disabled = false, onFiles, children, className = '', label }: Props) {
  const inputId = useId()
  const [over, setOver] = useState(false)

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setOver(false)
    if (disabled) return
    const files = Array.from(event.dataTransfer.files)
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 border-dashed transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-fern ${
        over ? 'border-fern bg-mint/60' : 'border-line-strong hover:border-fern/60'
      } ${disabled ? 'pointer-events-none opacity-60' : ''} ${className}`}
    >
      <label htmlFor={inputId} className="absolute inset-0 cursor-pointer rounded-2xl">
        <span className="sr-only">{label}</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          // Reset so picking the same file again still fires a change event.
          event.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
      <div className="pointer-events-none relative">{children}</div>
    </div>
  )
}
