/**
 * Mock provider collection for Storybook
 * - MockSocketProvider: SocketContext mock
 * - MockRouterProvider: TanStack Router mock
 * - StoryProviders: Combines the two providers above
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

/* ─── Default Mock Values ─── */

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
    // Simulate session creation in story: callback after 1 second
    setTimeout(() => cb("mock-new-session"), 1000);
  },
  addOutputListener: () => () => {},
  getSessionOutput: () => [],
};

/* ─── MockSocketProvider ─── */

interface MockSocketProviderProps {
  children: ReactNode;
  /** Partially override SocketContextValue */
  overrides?: Partial<SocketContextValue>;
}

export function MockSocketProvider({ children, overrides }: MockSocketProviderProps) {
  const value: SocketContextValue = { ...defaultSocketValue, ...overrides };
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

/* ─── MockRouterProvider ─── */

interface MockRouterProviderProps {
  /** Initial URL path */
  initialPath?: string;
  /** Component to render (used instead of Outlet) */
  children: ReactNode;
}

export function MockRouterProvider({ initialPath = "/", children }: MockRouterProviderProps) {
  // Create root route that renders child components
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });

  // Index route that catches all paths
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{children}</>,
  });

  // /browse route (with search params support)
  const browseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/browse",
    component: () => <>{children}</>,
    validateSearch: (search: Record<string, unknown>) => ({
      path: typeof search.path === "string" ? search.path : "",
    }),
  });

  // /terminal/$sessionId route
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

/* ─── StoryProviders (Combined) ─── */

interface StoryProvidersProps {
  children: ReactNode;
  socketOverrides?: Partial<SocketContextValue>;
  initialPath?: string;
}

/**
 * Storybook wrapper combining SocketProvider + RouterProvider
 *
 * Note: Since RouterProvider renders children on its own,
 * this component places children inside RouterProvider.
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
