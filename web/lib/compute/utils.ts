export function calculateTokenSize(text: string): number {
  return Math.ceil(text.length / 4)
}
