import React from 'react'

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/jpg',
  'image/svg+xml'
]

export interface AgentAvatarProps {
  agent: { metadata?: any; tokenId?: number }
  size?: number | 'small' | 'large'
}

export default function AgentAvatar({ agent, size = 'large' }: AgentAvatarProps) {
  const numericSize = typeof size === 'number' ? size : size === 'small' ? 64 : 128
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.metadata?.name || agent.tokenId}`
  const image = agent?.metadata?.image

  let src: string | undefined
  if (typeof image === 'string') {
    if (image.startsWith('http://') || image.startsWith('https://')) {
      src = image
    } else if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);/)
      const mime = match ? match[1] : ''
      if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
        src = fallback
      } else if (image.length > 100 * 1024) {
        src = fallback
      } else {
        src = image
      }
    }
  }
  if (!src) src = fallback

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
