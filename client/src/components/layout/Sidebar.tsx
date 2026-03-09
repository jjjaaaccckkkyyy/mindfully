import { useState } from "react";
import {
  LayoutDashboard,
  Bot,
  Settings,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Bot, label: "Agents", href: "/agents" },
  { icon: Activity, label: "Activity", href: "/activity" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({
  collapsed,
  onToggle,
  isMobile,
  onCloseMobile,
  onHoverChange,
}: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverDisabled, setHoverDisabled] = useState(false);

  const isCollapsed = isMobile ? false : collapsed;
  const shouldShowExpanded = hoverDisabled ? !collapsed : (isCollapsed ? isHovered : false);

  const handleMouseEnter = () => {
    if (isCollapsed && !hoverDisabled) {
      setIsHovered(true);
      onHoverChange?.(true);
    }
  };

  const handleMouseLeave = () => {
    if (!hoverDisabled) {
      setIsHovered(false);
      onHoverChange?.(false);
    }
  };

  const handleToggle = () => {
    if (collapsed) {
      setHoverDisabled(true);
    } else {
      setHoverDisabled(false);
    }
    setIsHovered(false);
    onHoverChange?.(false);
    onToggle();
  };

  return (
    <aside
      className={`relative h-screen border-r border-[hsl(187_100%_50%/0.1)] bg-[hsl(222_47%_8%)] transition-all duration-300 ${
        isCollapsed && !shouldShowExpanded ? "w-16" : "w-64"
      } ${isMobile ? "w-64" : ""}`}
      style={{
        background:
          "linear-gradient(180deg, hsl(222 47% 10%) 0%, hsl(222 47% 6%) 100%)",
        boxShadow: "4px 0 24px hsl(0 0% 0% / 0.3)",
      }}
    >
      <div className="flex h-14 items-center justify-between border-b border-[hsl(187_100%_50%/0.1)] px-3 md:h-16 md:px-4">
        {isMobile && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded border border-[hsl(187_100%_50%/0.2)] bg-[hsl(187_100%_50%/0.05)]"
          >
            <X className="h-4 w-4 text-[hsl(187_100%_70%)]" />
          </button>
        )}

        {!isMobile && (
          <>
            {isCollapsed && !shouldShowExpanded ? (
              <span className="mx-auto font-display text-xl font-semibold tracking-widest text-gradient-cyber">
                M
              </span>
            ) : (
              <span className="font-display text-lg md:text-xl font-semibold tracking-widest text-gradient-cyber truncate">
                Mindful
              </span>
            )}
          </>
        )}

        {isMobile && (
          <span className="font-display text-lg md:text-xl font-semibold tracking-widest text-gradient-cyber truncate">
            Mindful
          </span>
        )}
      </div>

      <nav
        className="space-y-1 p-2 md:p-3"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {navItems.map((item, index) => (
          <a
            key={item.href}
            href={item.href}
            onClick={isMobile ? onCloseMobile : undefined}
            className={`group relative flex items-center gap-3 rounded px-3 py-2.5 text-xs font-medium uppercase tracking-wider transition-all duration-300 ${
              item.href === "/"
                ? "bg-[hsl(187_100%_50%/0.1)] text-[hsl(187_100%_70%)]"
                : "text-muted-foreground hover:text-foreground hover:bg-[hsl(187_100%_50%/0.05)]"
            }`}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            {item.href === "/" && (
              <div
                className="absolute inset-0 rounded border border-[hsl(187_100%_50%/0.2)]"
                style={{
                  boxShadow: "inset 0 0 10px hsl(187 100% 50% / 0.1)",
                }}
              />
            )}
            <item.icon
              className={`h-4 w-4 shrink-0 transition-all duration-300 ${
                item.href === "/"
                  ? "text-[hsl(187_100%_70%)]"
                  : "group-hover:text-[hsl(187_100%_70%)]"
              }`}
            />
            {(!isCollapsed || shouldShowExpanded) && (
              <span className="relative z-10 truncate">{item.label}</span>
            )}
          </a>
        ))}
      </nav>

      {!isMobile && (
        <button
          onClick={handleToggle}
          className={`absolute bottom-4 flex h-8 w-8 items-center justify-center rounded border border-[hsl(187_100%_50%/0.2)] bg-[hsl(187_100%_50%/0.05)] text-muted-foreground transition-all duration-300 hover:border-[hsl(187_100%_50%/0.5)] hover:bg-[hsl(187_100%_50%/0.15)] hover:text-[hsl(187_100%_70%)] ${
            isCollapsed && !shouldShowExpanded ? "right-4" : "right-3"
          }`}
        >
          {isCollapsed && !shouldShowExpanded ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      )}
    </aside>
  );
}
