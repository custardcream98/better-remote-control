import { cn } from "@/lib/utils";

interface BrcLogoProps {
  className?: string;
}

/**
 * brc inline logo — icon mark + wordmark
 *
 * Icon: terminal prompt >_ inside a rounded rectangle
 * Text: "brc" monospace wordmark
 */
export function BrcLogo({ className }: BrcLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {/* Icon mark */}
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
        {/* > chevron */}
        <path
          d="M5.5 6.5L9.5 10L5.5 13.5"
          stroke="#e94560"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* _ cursor */}
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

      {/* Wordmark */}
      <span className="font-mono text-[13px] font-bold leading-none tracking-tight">
        <span className="text-foreground">brc</span>
      </span>
    </span>
  );
}
