import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variantStyles = {
      default: "border border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.05)] text-[hsl(187_100%_70%)] hover:border-[hsl(187_100%_50%/0.5)] hover:bg-[hsl(187_100%_50%/0.15)]",
      outline: "border border-[hsl(187_100%_50%/0.2)] bg-transparent text-[hsl(187_100%_70%)] hover:bg-[hsl(187_100%_50%/0.1)]",
      ghost: "bg-transparent text-[hsl(192_100%_60%)] hover:text-[hsl(187_100%_70%)] hover:bg-[hsl(187_100%_50%/0.05)]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded",
      md: "h-10 px-4 text-sm rounded-md",
      lg: "h-12 px-6 text-base rounded-lg",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
