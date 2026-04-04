/**
 * Skeleton loading components.
 *
 * Use these as placeholders while content is loading to improve
 * perceived performance and reduce layout shift.
 */

/**
 * Base skeleton shimmer block.
 * @param {{ className?: string }} props
 */
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/10 ${className}`}
      aria-hidden="true"
    />
  )
}

/**
 * Skeleton for a card-like block with a title and two lines of text.
 */
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`card flex flex-col gap-4 ${className}`} aria-hidden="true">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

/**
 * Skeleton for an upload/transfer progress area.
 */
export function TransferSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    </div>
  )
}

export default Skeleton
