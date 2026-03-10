import { useState } from "react";
import { Bell, Search, User, Command } from "lucide-react";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[hsl(187_100%_50%/0.1)] px-4 md:px-6 backdrop-blur-xl header ${className || ""}`}
    >
      <div className="flex flex-1 items-center gap-4">
        <div
          className={`relative flex-1 max-w-xs md:max-w-md transition-all duration-300 ${
            searchFocused ? "md:max-w-lg" : ""
          }`}
        >
          <Search
            className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-300 ${
              searchFocused
                ? "text-[hsl(187_100%_70%)]"
                : "text-muted-foreground"
            }`}
          />
          <input
            type="text"
            placeholder="Search agents..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="header-search-input h-10 w-full rounded pl-10 pr-16 text-sm font-mono text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground"
          />
          <div className="header-search-shortcut absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded px-2 py-0.5 text-xs font-mono text-muted-foreground md:flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="header-icon-btn group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300">
          <Bell className="h-5 w-5 text-muted-foreground transition-colors duration-300 group-hover:text-[hsl(187_100%_70%)]" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/50" />
        </button>

        <div className="header-user-btn flex items-center gap-2 rounded-lg p-1.5 pr-3 transition-all duration-300">
          <div className="header-user-avatar flex h-8 w-8 items-center justify-center rounded-md">
            <User className="h-4 w-4 text-[hsl(222_47%_6%)]" />
          </div>
          <span className="text-sm font-medium uppercase tracking-wider text-foreground">
            Demo User
          </span>
        </div>
      </div>
    </header>
  );
}
