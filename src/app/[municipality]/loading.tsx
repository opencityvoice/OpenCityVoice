import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-4 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[400px] shrink-0 flex-col border-r p-4 md:flex lg:w-[440px]">
          <Skeleton className="h-9 w-full" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 bg-muted/30 p-4">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
