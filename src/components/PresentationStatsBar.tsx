import { useState } from 'react';
import {
  ChevronUp,
  Layers,
  Clock,
  HardDrive,
  Type,
  Image as ImageIcon,
  Square,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { PresentationStats, SizeVerdictLevel } from '@/lib/presentationStats';

interface PresentationStatsBarProps {
  stats: PresentationStats;
}

const VERDICT_STYLES: Record<SizeVerdictLevel, { color: string; Icon: typeof CheckCircle2 }> = {
  great: { color: 'text-green-600 dark:text-green-500', Icon: CheckCircle2 },
  ok: { color: 'text-emerald-600 dark:text-emerald-500', Icon: CheckCircle2 },
  caution: { color: 'text-amber-600 dark:text-amber-500', Icon: AlertTriangle },
  risky: { color: 'text-red-600 dark:text-red-500', Icon: XCircle },
};

export function PresentationStatsBar({ stats }: PresentationStatsBarProps) {
  const [open, setOpen] = useState(false);
  const { color, Icon } = VERDICT_STYLES[stats.verdict.level];

  return (
    <div className="border-t bg-card flex-shrink-0">
      <div className="px-4 h-9 flex items-center justify-between text-xs">
        {/* Quick inline stats */}
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            {stats.slideCount} slides
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {stats.durationLabel}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5" />
            {stats.sizeLabel}
          </span>
        </div>

        {/* Verdict + expand */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-muted rounded px-2 py-1 -mr-2 transition-colors">
              <span className={cn('flex items-center gap-1 font-medium', color)}>
                <Icon className="w-3.5 h-3.5" />
                {stats.verdict.title}
              </span>
              <ChevronUp className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-80 p-0">
            <div className="p-4 space-y-4">
              {/* Size verdict */}
              <div className="space-y-1.5">
                <div className={cn('flex items-center gap-2 font-semibold', color)}>
                  <Icon className="w-4 h-4" />
                  {stats.verdict.title}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {stats.verdict.detail}
                </p>
              </div>

              {/* Size meter */}
              <SizeMeter byteSize={stats.byteSize} />

              <div className="h-px bg-border" />

              {/* Detailed stats grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Stat label="Estimated size" value={stats.sizeLabel} icon={HardDrive} />
                <Stat label="Duration" value={stats.durationLabel} icon={Clock} />
                <Stat label="Slides" value={String(stats.slideCount)} icon={Layers} />
                <Stat label="Elements" value={String(stats.elementCount)} icon={Square} />
                <Stat label="Text boxes" value={String(stats.textCount)} icon={Type} />
                <Stat label="Images" value={String(stats.imageCount)} icon={ImageIcon} />
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Size counts only text and layout. Images ({stats.mediaCount} hosted)
                  are stored on Blossom and referenced by URL, so they don&rsquo;t
                  add to the event size.
                </span>
              </div>

              {/* Embedded media: hosts + file list */}
              {stats.mediaCount > 0 && (
                <div className="space-y-2">
                  <div className="h-px bg-border" />
                  <div>
                    <p className="text-xs font-medium mb-1">
                      Media servers ({stats.mediaHosts.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {stats.mediaHosts.map((host) => (
                        <span key={host} className="inline-flex items-center gap-1 text-[11px] font-mono bg-muted rounded px-1.5 py-0.5">
                          <HardDrive className="w-3 h-3" />
                          {host}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">
                      Embedded files ({stats.mediaUrls.length})
                    </p>
                    <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                      {stats.mediaUrls.map((url) => {
                        let label = url;
                        try {
                          const u = new URL(url);
                          label = `${u.host}${u.pathname}`;
                        } catch { /* keep raw */ }
                        return (
                          <li key={url} className="text-[11px] text-muted-foreground truncate" title={url}>
                            {label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Layers }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium ml-auto">{value}</span>
    </div>
  );
}

/** Visual meter showing where the size falls against relay thresholds */
function SizeMeter({ byteSize }: { byteSize: number }) {
  // Scale: 0 .. 256KB across the bar, clamped
  const max = 256 * 1024;
  const pct = Math.min(100, (byteSize / max) * 100);

  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full overflow-hidden bg-muted">
        {/* Zone backgrounds */}
        <div className="absolute inset-0 flex">
          <div className="bg-green-500/30" style={{ width: '25%' }} />
          <div className="bg-emerald-500/30" style={{ width: '25%' }} />
          <div className="bg-amber-500/30" style={{ width: '25%' }} />
          <div className="bg-red-500/30" style={{ width: '25%' }} />
        </div>
        {/* Current position marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full"
          style={{ left: `calc(${pct}% - 2px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>64KB</span>
        <span>128KB</span>
        <span>256KB+</span>
      </div>
    </div>
  );
}
