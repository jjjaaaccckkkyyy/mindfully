import { useState, useEffect, useCallback } from "react";

interface UseSidebarOptions {
  defaultCollapsed?: boolean;
  disableOnMobile?: boolean;
  mobileBreakpoint?: number;
}

interface UseSidebarReturn {
  collapsed: boolean;
  hovered: boolean;
  isMobile: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
  setHovered: (value: boolean) => void;
}

export function useSidebar(options: UseSidebarOptions = {}): UseSidebarReturn {
  const {
    defaultCollapsed = false,
    disableOnMobile = true,
    mobileBreakpoint = 768,
  } = options;

  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sidebarCollapsed");
      if (stored !== null) {
        return stored === "true";
      }
      return defaultCollapsed;
    }
    return defaultCollapsed;
  });

  const [hovered, setHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < mobileBreakpoint;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < mobileBreakpoint;
      setIsMobile(mobile);
      if (mobile && disableOnMobile) {
        setCollapsedState(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileBreakpoint, disableOnMobile]);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => !prev);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
  }, []);

  return {
    collapsed,
    hovered,
    isMobile,
    toggle,
    setCollapsed,
    setHovered,
  };
}
