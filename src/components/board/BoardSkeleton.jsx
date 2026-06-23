function CardSkeleton() {
  return (
    <div className="bg-surface-2 rounded-xl border border-line p-4 space-y-3">
      <div className="h-3.5 bg-surface-3 rounded-md animate-pulse w-3/4" />
      <div className="h-3 bg-surface-3 rounded-md animate-pulse w-1/2" />
      <div className="flex items-center justify-between pt-1">
        <div className="h-3 w-10 bg-surface-3 rounded animate-pulse" />
        <div className="flex gap-1">
          <div className="w-5 h-5 rounded-full bg-surface-3 animate-pulse" />
          <div className="w-5 h-5 rounded-full bg-surface-3 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function ColumnSkeleton({ cards = 3 }) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 mb-1">
        <div className="h-4 w-24 bg-surface-3 rounded-md animate-pulse" />
        <div className="h-4 w-6 bg-surface-3 rounded animate-pulse" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-4 p-4 h-full">
        <ColumnSkeleton cards={4} />
        <ColumnSkeleton cards={2} />
        <ColumnSkeleton cards={3} />
        <ColumnSkeleton cards={1} />
      </div>
    </div>
  )
}
