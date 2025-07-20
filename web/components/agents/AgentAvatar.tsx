import React from 'react'

export interface AgentAvatarProps {
  agent: { metadata?: any; tokenId?: number }
  size?: number | 'small' | 'large'
}

export const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp']

export function resolveAvatarSrc(image: string | undefined, fallbackSeed: string | number) {
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${fallbackSeed}`

  let src: string | undefined
  if (typeof image === 'string') {
    if (image.startsWith('http://') || image.startsWith('https://')) {
      src = image
    } else if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,/)
      const mime = match?.[1]
      if (mime && ALLOWED_MIMES.includes(mime) && image.length < 100 * 1024) {
        src = image
      }
    }
  }
  if (!src) src = fallback
  return src
}

export default function AgentAvatar({ agent, size = 'large' }: AgentAvatarProps) {
  const numericSize = typeof size === 'number' ? size : size === 'small' ? 64 : 128
  const seed = agent.metadata?.name || agent.tokenId!
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`
  const src = resolveAvatarSrc(agent?.metadata?.image, seed)

  return (
    <img
      src={src}
      alt={agent.metadata?.name || `Agent #${agent.tokenId}`}
      width={numericSize}
      height={numericSize}
      loading="lazy"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).src = fallback
      }}
      className="rounded-full object-cover"
    />
  )
}
