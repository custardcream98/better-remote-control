import { ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

interface BreadcrumbNavProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function BreadcrumbNav({ path, onNavigate }: BreadcrumbNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 마지막 세그먼트가 보이도록 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [path]);

  const segments = path.split("/").filter(Boolean);

  return (
    <div
      ref={scrollRef}
      className="scrollbar-none flex items-center gap-1 overflow-x-auto px-4 py-2 text-sm"
    >
      <button
        onClick={() => onNavigate("/")}
        className="shrink-0 rounded px-1.5 py-0.5 text-[var(--muted-foreground)] transition-colors active:text-[var(--foreground)]"
      >
        /
      </button>
      {segments.map((seg, i) => {
        const segPath = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={segPath} className="flex shrink-0 items-center gap-1">
            <ChevronRight size={12} className="text-[var(--muted-foreground)]" />
            <button
              onClick={() => onNavigate(segPath)}
              className={`rounded px-1.5 py-0.5 transition-colors active:text-[var(--foreground)] ${
                isLast ? "font-medium text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
              }`}
            >
              {seg}
            </button>
          </span>
        );
      })}
    </div>
  );
}
