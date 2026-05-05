import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { WelcomeTutorialModal } from "@/components/WelcomeTutorialModal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-card px-4">
            <SidebarTrigger />
            <NotificationBell />
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <WelcomeTutorialModal />
    </SidebarProvider>
  );
}
