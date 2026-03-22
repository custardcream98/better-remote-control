/**
 * 스토리북용 모의 프로바이더 모음
 * - MockSocketProvider: SocketContext 모킹
 * - MockRouterProvider: TanStack Router 모킹
 * - StoryProviders: 위 두 프로바이더를 결합
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

import { SocketContext } from "@/contexts/socket-context";

import type { SocketContextValue } from "@/contexts/socket-context";
import type { SessionInfo, ClientMessage } from "@/hooks/use-socket";
import type { ReactNode } from "react";

/* ─── 기본 모의 값 ─── */

export const mockSessions: SessionInfo[] = [
  { id: "sess-1", name: "dev-server", cwd: "/home/user/project" },
  { id: "sess-2", name: "build", cwd: "/home/user/project", exited: true },
  { id: "sess-3", name: "test-runner", cwd: "/home/user/project/tests" },
];

const defaultSocketValue: SocketContextValue = {
  sessions: mockSessions,
  send: (msg: ClientMessage) => console.log("[MockSocket] send:", msg),
  status: "connected",
  config: { defaultCwd: "/home/user/project", defaultCommand: "bash" },
  onceCreated: (cb) => {
    // 스토리에서 세션 생성 시뮬레이션: 1초 후 콜백
    setTimeout(() => cb("mock-new-session"), 1000);
  },
  addOutputListener: () => () => {},
  getSessionOutput: () => [],
};

/* ─── MockSocketProvider ─── */

interface MockSocketProviderProps {
  children: ReactNode;
  /** SocketContextValue를 부분적으로 오버라이드 */
  overrides?: Partial<SocketContextValue>;
}

export function MockSocketProvider({ children, overrides }: MockSocketProviderProps) {
  const value: SocketContextValue = { ...defaultSocketValue, ...overrides };
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

/* ─── MockRouterProvider ─── */

interface MockRouterProviderProps {
  /** 초기 URL 경로 */
  initialPath?: string;
  /** 렌더할 컴포넌트 (Outlet 대신 사용) */
  children: ReactNode;
}

export function MockRouterProvider({ initialPath = "/", children }: MockRouterProviderProps) {
  // 자식 컴포넌트를 렌더할 루트 라우트 생성
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });

  // 모든 경로를 캐치하는 인덱스 라우트
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{children}</>,
  });

  // /browse 라우트 (search params 지원)
  const browseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/browse",
    component: () => <>{children}</>,
    validateSearch: (search: Record<string, unknown>) => ({
      path: typeof search.path === "string" ? search.path : "",
    }),
  });

  // /terminal/$sessionId 라우트
  const terminalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/terminal/$sessionId",
    component: () => <>{children}</>,
  });

  const routeTree = rootRoute.addChildren([indexRoute, browseRoute, terminalRoute]);

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <RouterProvider router={router as any} />;
}

/* ─── StoryProviders (결합) ─── */

interface StoryProvidersProps {
  children: ReactNode;
  socketOverrides?: Partial<SocketContextValue>;
  initialPath?: string;
}

/**
 * SocketProvider + RouterProvider를 결합한 스토리북용 래퍼
 *
 * 주의: RouterProvider가 자체적으로 children을 렌더하므로,
 * 이 컴포넌트에서는 RouterProvider 내부에 children을 배치합니다.
 */
export function StoryProviders({
  children,
  socketOverrides,
  initialPath = "/",
}: StoryProvidersProps) {
  return (
    <MockSocketProvider overrides={socketOverrides}>
      <MockRouterProvider initialPath={initialPath}>{children}</MockRouterProvider>
    </MockSocketProvider>
  );
}
