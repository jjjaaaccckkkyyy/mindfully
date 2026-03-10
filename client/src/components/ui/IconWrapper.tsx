import { HTMLAttributes, forwardRef } from "react";

interface IconWrapperProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const IconWrapper = forwardRef<HTMLDivElement, IconWrapperProps>(
  ({ className = "", size = "md", children, ...props }, ref) => {
    const sizeStyles = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };

    return (
      <div
        ref={ref}
        className={`inline-flex items-center justify-center rounded border border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.1)] ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

IconWrapper.displayName = "IconWrapper";
