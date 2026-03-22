import { createRootRoute, Outlet } from "@tanstack/react-router";

import { ConfigBar } from "@/components/config-bar";
import { SocketProvider } from "@/contexts/socket-context";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <SocketProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <ConfigBar />
        <Outlet />
      </div>
    </SocketProvider>
  );
}
