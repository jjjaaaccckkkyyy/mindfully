import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    return stored === "true";
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const getSidebarWidth = () => {
    if (isMobile) return 0;
    if (sidebarCollapsed) {
      return sidebarHovered ? 256 : 64;
    }
    return 256;
  };

  return (
    <div className="layout-page">
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="layout-mobile-menu-btn"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      {isMobile && mobileMenuOpen && (
        <div
          className="layout-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={`layout-sidebar-container ${
          isMobile
            ? mobileMenuOpen
              ? "open"
              : "closed"
            : ""
        }`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={isMobile}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onHoverChange={setSidebarHovered}
        />
      </div>

      <div
        className="layout-main"
        style={{
          marginLeft: `${getSidebarWidth()}px`,
        }}
      >
        {isMobile && (
          <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[hsl(187_100%_50%/0.1)] px-4 backdrop-blur-xl layout-header-mobile">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="mr-3 flex h-9 w-9 items-center justify-center rounded border border-[hsl(187_100%_50%/0.2)] bg-[hsl(187_100%_50%/0.05)]"
            >
              <Menu className="h-5 w-5 text-[hsl(187_100%_70%)]" />
            </button>
            <span className="font-display text-lg font-semibold tracking-widest text-gradient-cyber">
              Mindful
            </span>
          </header>
        )}

        {!isMobile && <Header />}

        <main className="flex-1 p-4 md:p-6 lg:p-8 layout-main">
          {children}
        </main>
      </div>
    </div>
  );
}
