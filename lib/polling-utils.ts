import type { MutableRefObject } from "react"

/**
 * Cleanup polling intervals and timeouts by key
 * Replaces duplicated cleanup logic in persona-app.tsx
 */
export function cleanupPolling(
  pollingKey: string,
  pollIntervalsRef: MutableRefObject<Map<string, NodeJS.Timeout>>,
  timeoutsRef: MutableRefObject<Map<string, NodeJS.Timeout>>
): void {
  const intervalToClean = pollIntervalsRef.current.get(pollingKey)
  if (intervalToClean) {
    clearInterval(intervalToClean)
    pollIntervalsRef.current.delete(pollingKey)
  }
  const timeoutToClean = timeoutsRef.current.get(pollingKey)
  if (timeoutToClean) {
    clearTimeout(timeoutToClean)
    timeoutsRef.current.delete(pollingKey)
  }
}

/**
 * Create a photo asset object for generated photos
 * Replaces duplicated asset creation in persona-app.tsx
 */
export interface GeneratedAsset {
  id: string
  type: "PHOTO"
  url: string
  styleId: string
  createdAt: number
}

export function createPhotoAsset(
  url: string,
  index: number,
  jobId: string,
  baseIndex: number = 0
): GeneratedAsset {
  return {
    id: `${jobId}-${baseIndex + index}`,
    type: "PHOTO" as const,
    url,
    styleId: "pinglass",
    createdAt: Date.now(),
  }
}

/**
 * Create multiple photo assets from URLs
 */
export function createPhotoAssets(
  urls: string[],
  jobId: string,
  baseIndex: number = 0
): GeneratedAsset[] {
  return urls.map((url, i) => createPhotoAsset(url, i, jobId, baseIndex))
}
