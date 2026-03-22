/**
 * HomePage composite stories
 *
 * Since the actual route module (routes/index.tsx) depends on file-based route hooks
 * like Route.useSearch, we compose the page components here to render visually identical output.
 */
import { Plus, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SessionCard } from "../session-card";
import { StoryProviders, mockSessions } from "./mock-providers";

import type { SessionInfo } from "@/hooks/use-socket";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = {
  title: "Pages/HomePage",
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
};

export default meta;

type Story = StoryObj;

/* ─── Page Layout Reproduction ─── */

function HomePageLayout({
  sessions,
  onClose,
}: {
  sessions: SessionInfo[];
  onClose: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 512, margin: "0 auto", padding: 16 }}>
          {sessions.length === 0 ? (
            /* Empty state screen */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 80,
                paddingBottom: 80,
                textAlign: "center",
              }}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
                <Terminal size={28} className="text-[var(--muted-foreground)]" />
              </div>
              <p className="mb-1 text-sm font-medium text-[var(--foreground)]">
                {t("home.noSessions")}
              </p>
              <p className="mb-6 text-xs text-[var(--muted-foreground)]">
                {t("home.noSessionsDescription")}
              </p>
            </div>
          ) : (
            /* Session list */
            <div style={{ display: "grid", gap: 12 }}>
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} onClose={onClose} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom fixed button */}
      <div className="border-t border-[var(--border)] bg-[var(--background)] p-4">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80"
          onClick={() => console.log("new session")}
        >
          <Plus size={18} />
          {t("home.newSession")}
        </button>
      </div>
    </div>
  );
}

/* ─── Stories ─── */

/** Default state with sessions */
export const WithSessions: Story = {
  render: () => (
    <StoryProviders>
      <HomePageLayout sessions={mockSessions} onClose={(id) => console.log("close:", id)} />
    </StoryProviders>
  ),
};

/** No sessions (empty state screen) */
export const Empty: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ sessions: [] }}>
      <HomePageLayout sessions={[]} onClose={() => {}} />
    </StoryProviders>
  ),
};

/** Many sessions (scroll test) */
export const ManySessions: Story = {
  render: () => {
    const manySessions: SessionInfo[] = Array.from({ length: 12 }, (_, i) => ({
      id: `sess-${i + 1}`,
      name: `session-${i + 1}`,
      cwd: `/home/user/project-${i + 1}`,
      exited: i % 4 === 0,
    }));

    return (
      <StoryProviders>
        <HomePageLayout sessions={manySessions} onClose={(id) => console.log("close:", id)} />
      </StoryProviders>
    );
  },
};
