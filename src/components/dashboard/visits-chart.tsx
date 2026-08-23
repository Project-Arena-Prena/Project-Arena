export function VisitsChart({ points }: { points: Array<{ t: string; visits: number }> }) {
  const max = Math.max(1, ...points.map((point) => point.visits));
  return (
    <div className="border hairline p-5">
      <div className="flex h-40 items-end gap-1">
        {points.map((point) => (
          <div key={point.t} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="num text-[9px] text-bone-faint">{point.visits}</span>
            <span
              className="w-full bg-arena/80"
              style={{ height: `${Math.max(4, (point.visits / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
