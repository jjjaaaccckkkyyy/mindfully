export const colors = {
  primary: {
    DEFAULT: "hsl(187 100% 50%)",
    10: "hsl(187 100% 50% / 0.1)",
    15: "hsl(187 100% 50% / 0.15)",
    20: "hsl(187 100% 50% / 0.2)",
    30: "hsl(187 100% 50% / 0.3)",
    40: "hsl(187 100% 50% / 0.4)",
    50: "hsl(187 100% 50% / 0.5)",
    70: "hsl(187 100% 70%)",
  },
  success: {
    DEFAULT: "hsl(150 70% 60%)",
    75: "hsl(150 70% 60% / 0.75)",
  },
  warning: {
    DEFAULT: "hsl(45 100% 60%)",
    75: "hsl(45 100% 60% / 0.75)",
  },
  danger: {
    DEFAULT: "hsl(0 70% 60%)",
    75: "hsl(0 70% 60% / 0.75)",
  },
  background: {
    DEFAULT: "hsl(222 47% 6%)",
    card: "hsl(222 47% 10%)",
    elevated: "hsl(222 47% 12%)",
  },
  border: {
    DEFAULT: "hsl(187 100% 50% / 0.1)",
    hover: "hsl(187 100% 50% / 0.4)",
  },
} as const;

export const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(" ");

export const styles = {
  card: {
    base: "relative overflow-hidden rounded border transition-all duration-500",
    cyber: `border-[hsl(187_100%_50%/0.15)] bg-[hsl(222_47%_10%)] hover:border-[hsl(187_100%_50%/0.4)]`,
  },
  button: {
    base: "flex items-center justify-center rounded border transition-all duration-300",
    cyber: `border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.05)] hover:border-[hsl(187_100%_50%/0.6)] hover:bg-[hsl(187_100%_50%/0.15)]`,
  },
  text: {
    gradient: "text-gradient-cyber",
    mono: "font-mono text-xs uppercase tracking-wider",
  },
} as const;
