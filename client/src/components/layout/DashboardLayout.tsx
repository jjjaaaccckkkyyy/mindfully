import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Calculate actual sidebar width for main content margin
  const getSidebarWidth = () => {
    if (isMobile) return 0;
    if (sidebarCollapsed) {
      return sidebarHovered ? 256 : 64; // w-64 or w-16
    }
    return 256; // w-64
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "hsl(222 47% 6%)",
      }}
    >
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[hsl(187_100%_50%/0.3)] bg-[hsl(222_47%_12%)] shadow-[0_0_20px_hsl(187_100%_50%/0.3)]"
        >
          <Menu className="h-6 w-6 text-[hsl(187_100%_70%)]" />
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - always fixed, transforms on mobile */}
      <div
        className={`fixed left-0 top-0 z-50 h-screen transition-transform duration-300 ${
          isMobile
            ? mobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full"
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

      {/* Main content - always has left margin */}
      <div
        className="min-h-screen transition-all duration-300"
        style={{
          marginLeft: `${getSidebarWidth()}px`,
        }}
      >
        {/* Mobile header */}
        {isMobile && (
          <header
            className="sticky top-0 z-30 flex h-14 items-center border-b border-[hsl(187_100%_50%/0.1)] px-4 backdrop-blur-xl"
            style={{
              background:
                "linear-gradient(180deg, hsl(222 47% 10% / 0.95) 0%, hsl(222 47% 8% / 0.9) 100%)",
              boxShadow: "0 4px 20px hsl(0 0% 0% / 0.2)",
            }}
          >
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

        {/* Desktop header */}
        {!isMobile && <Header />}

        {/* Main content area */}
        <main
          className="flex-1 p-4 md:p-6 lg:p-8"
          style={{
            background: "hsl(222 47% 6%)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
