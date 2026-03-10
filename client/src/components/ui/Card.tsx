import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      default: "border-[hsl(187_100%_50%/0.15)] bg-[hsl(222_47%_10%)]",
      interactive: "border-[hsl(187_100%_50%/0.15)] bg-[hsl(222_47%_10%)] hover:border-[hsl(187_100%_50%/0.4)] cursor-pointer",
    };

    return (
      <div
        ref={ref}
        className={`relative overflow-hidden rounded border transition-all duration-500 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardGlow = ({ className = "" }: { className?: string }) => (
  <div 
    className={`absolute inset-0 bg-gradient-to-br from-[hsl(187_100%_50%/0.1)] to-transparent opacity-0 transition-opacity duration-500 hover:opacity-100 ${className}`}
  />
);

export const CardBorder = ({ className = "" }: { className?: string }) => (
  <div 
    className={`absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[hsl(187_100%_50%/0.5)] to-transparent ${className}`}
  />
);

export const CardContent = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`relative z-10 p-5 ${className}`}>
    {children}
  </div>
);
