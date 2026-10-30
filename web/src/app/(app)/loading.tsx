/** Skeleton shared by every signed-in screen while its data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
      <div className="h-[60px] animate-pulse rounded-lg bg-surface-2" />
      <div className="h-44 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-36 animate-pulse rounded-md bg-surface-2" />
      <div className="h-36 animate-pulse rounded-md bg-surface-2" />
    </div>
  );
}
