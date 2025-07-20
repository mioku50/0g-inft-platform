const localMetadata = new Map<string, any>();

export function cacheMetadata(hash: string, data: any) {
  localMetadata.set(hash, data);
}

export function getCachedMetadata(hash: string) {
  return localMetadata.get(hash);
}
