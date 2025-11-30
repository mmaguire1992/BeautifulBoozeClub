import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/auth";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border bg-background flex items-center px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="ml-4 font-semibold text-foreground">The Beautiful Booze Club</div>
            <div className="ml-auto flex items-center gap-3">
              {user && (
                <span className="text-sm text-muted-foreground">
                  {user.displayName || user.username}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout().catch(() => {
                    /* ignore */
                  });
                }}
              >
                Logout
              </Button>
            </div>
          </header>
          
          <main className="flex-1 p-6 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
