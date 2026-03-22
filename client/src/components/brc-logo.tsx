import { cn } from "@/lib/utils";

interface BrcLogoProps {
  className?: string;
}

/**
 * brc 인라인 로고 — 아이콘 마크 + 워드마크
 *
 * 아이콘: 둥근 사각형 안에 터미널 프롬프트 ›_
 * 텍스트: "brc" 모노스페이스 워드마크
 */
export function BrcLogo({ className }: BrcLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {/* 아이콘 마크 */}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[18px] w-[18px]"
        aria-hidden="true"
      >
        <rect width="20" height="20" rx="5" fill="#1a1a2e" />
        <rect
          x="0.5"
          y="0.5"
          width="19"
          height="19"
          rx="4.5"
          stroke="#e94560"
          strokeOpacity="0.25"
        />
        {/* > 쉐브론 */}
        <path
          d="M5.5 6.5L9.5 10L5.5 13.5"
          stroke="#e94560"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* _ 커서 */}
        <line
          x1="11"
          y1="13.5"
          x2="15"
          y2="13.5"
          stroke="#e94560"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>

      {/* 워드마크 */}
      <span className="font-mono text-[13px] font-bold leading-none tracking-tight">
        <span className="text-[var(--foreground)]">brc</span>
      </span>
    </span>
  );
}
