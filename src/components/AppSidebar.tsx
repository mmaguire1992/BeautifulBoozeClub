import {
  LayoutDashboard,
  Mail,
  FileText,
  Calendar,
  Archive,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-site.png";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Enquiries", url: "/enquiries", icon: Mail },
  { title: "Quotes", url: "/quotes", icon: FileText },
  { title: "Bookings", url: "/bookings", icon: Calendar },
  { title: "Archive", url: "/archive", icon: Archive },
  { title: "Google Calendar", url: "/google-calendar", icon: Calendar },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center justify-center">
            <img
              src={logo}
              alt="The Beautiful Booze Club"
              className="max-h-60 w-auto object-contain"
            />
          </Link>
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/80 hover:text-sidebar-foreground"
              onClick={() => setOpenMobile(false)}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-semibold md:text-base">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
