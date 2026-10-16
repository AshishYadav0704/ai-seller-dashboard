export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']

/** Returns a message if the file can't be uploaded, so the user hears about it before a round trip. */
export function checkFile(file: File, maxMb: number): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name} isn't a JPG, PNG or WebP image.`
  if (file.size > maxMb * 1024 * 1024) return `${file.name} is larger than ${maxMb} MB.`
  return null
}
