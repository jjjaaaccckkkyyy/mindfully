import { HTMLAttributes, forwardRef } from "react";
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Zap, 
  Circle 
} from "lucide-react";

type StatusType = "running" | "idle" | "error" | "starting" | "stopped";

interface StatusBadgeProps extends HTMLAttributes<HTMLDivElement> {
  status: StatusType;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const statusConfig: Record<StatusType, { 
  color: string; 
  bg: string; 
  border: string; 
  glow: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  running: {
    color: "text-[hsl(150_70%_60%)]",
    bg: "bg-[hsl(150_70%_60%/0.1)]",
    border: "border-[hsl(150_70%_60%/0.3)]",
    glow: "shadow-[0_0_10px_hsl(150_70%_60%/0.3)]",
    label: "Running",
    Icon: Loader2,
  },
  idle: {
    color: "text-[hsl(187_100%_70%)]",
    bg: "bg-[hsl(187_100%_50%/0.1)]",
    border: "border-[hsl(187_100%_50%/0.3)]",
    glow: "shadow-[0_0_10px_hsl(187_100%_50%/0.2)]",
    label: "Idle",
    Icon: Circle,
  },
  error: {
    color: "text-[hsl(0_70%_60%)]",
    bg: "bg-[hsl(0_70%_60%/0.1)]",
    border: "border-[hsl(0_70%_60%/0.3)]",
    glow: "shadow-[0_0_10px_hsl(0_70%_60%/0.3)]",
    label: "Error",
    Icon: AlertCircle,
  },
  starting: {
    color: "text-[hsl(45_100%_60%)]",
    bg: "bg-[hsl(45_100%_60%/0.1)]",
    border: "border-[hsl(45_100%_60%/0.3)]",
    glow: "shadow-[0_0_10px_hsl(45_100%_60%/0.3)]",
    label: "Starting",
    Icon: Zap,
  },
  stopped: {
    color: "text-[hsl(192_100%_60%)]",
    bg: "bg-[hsl(192_100%_50%/0.1)]",
    border: "border-[hsl(192_100%_50%/0.2)]",
    glow: "",
    label: "Stopped",
    Icon: CheckCircle2,
  },
};

export const StatusBadge = forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ 
    className = "", 
    status, 
    showIcon = true, 
    showLabel = true,
    size = "md",
    ...props 
  }, ref) => {
    const config = statusConfig[status];
    const sizeStyles = {
      sm: "px-2 py-1 text-[8px]",
      md: "px-3 py-1.5 text-[10px]",
    };
    const iconSizes = {
      sm: "h-3 w-3",
      md: "h-4 w-4",
    };

    const StatusIcon = config.Icon;

    return (
      <div
        ref={ref}
        className={`inline-flex items-center gap-1.5 rounded border ${config.border} ${config.bg} ${config.glow} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {showIcon && (
          <StatusIcon className={`${config.color} ${status === "running" ? "animate-spin" : ""} ${iconSizes[size]}`} />
        )}
        {showLabel && (
          <span className={`font-mono uppercase tracking-wider ${config.color}`}>
            {config.label}
          </span>
        )}
        {status === "running" && (
          <span className={`relative flex h-2 w-2 ${size === "sm" ? "h-1.5 w-1.5" : ""}`}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(150_70%_60%)] opacity-75" />
            <span className={`relative inline-flex rounded-full bg-[hsl(150_70%_60%)] ${size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
          </span>
        )}
      </div>
    );
  }
);

StatusBadge.displayName = "StatusBadge";

export { statusConfig };
