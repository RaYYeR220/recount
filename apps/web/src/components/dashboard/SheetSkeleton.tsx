import { Paper } from "@/components/ui";

/** The polls sheet while it loads: the same toolbar height and a page of empty rows. */
export function SheetSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Paper padded={false} className="overflow-hidden" aria-label="Loading your polls">
      <div className="flex items-center gap-3.5 border-b border-paper-3 px-5 py-4">
        <div className="h-11 flex-[1_1_280px] rounded-field bg-paper-2 sm:max-w-[420px]" />
        <div className="h-11 w-[180px] rounded-field bg-paper-2 max-[900px]:hidden" />
      </div>
      <div className="h-[37px] border-b border-paper-3 bg-paper-2" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-[55px] items-center gap-6 border-b border-paper-3 px-5 max-[900px]:h-[120px]">
          <div className="h-3.5 w-48 rounded-chip bg-paper-2" />
          <div className="h-3.5 w-20 rounded-chip bg-paper-2 max-[900px]:hidden" />
          <div className="h-3.5 w-24 rounded-chip bg-paper-2 max-[900px]:hidden" />
        </div>
      ))}
    </Paper>
  );
}
