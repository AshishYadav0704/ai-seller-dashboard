import { mediaUrl } from '../lib/api'
import type { ImageRef } from '../lib/types'
import { Icon } from './Icon'

interface Props {
  image: ImageRef | null
  alt: string
  size?: 'sm' | 'md' | 'fill'
  full?: boolean
}

const sizes = {
  sm: 'size-10 rounded-md',
  md: 'size-14 rounded-lg',
  fill: 'aspect-[4/5] w-full rounded-xl',
}

export function ProductThumb({ image, alt, size = 'sm', full = false }: Props) {
  const box = `${sizes[size]} shrink-0 overflow-hidden border border-line bg-surface-2`
  if (!image) {
    return (
      <div className={`${box} grid place-items-center text-ink-3`} aria-hidden="true">
        <Icon name="image" className={size === 'fill' ? 'size-8' : 'size-4'} />
      </div>
    )
  }
  return (
    <div className={box}>
      <img
        src={mediaUrl(full ? image.url : image.thumb_url)}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
    </div>
  )
}
