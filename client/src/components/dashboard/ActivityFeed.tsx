import { motion } from "motion/react";
import { CheckCircle2, Clock, XCircle, PlayCircle } from "lucide-react";

interface Activity {
  id: string;
  agent: string;
  task: string;
  status: "completed" | "running" | "failed" | "pending";
  time: string;
}

const activities: Activity[] = [
  {
    id: "1",
    agent: "Research",
    task: "Search for AI trends 2026",
    status: "completed",
    time: "2m ago",
  },
  {
    id: "2",
    agent: "Builder",
    task: "Generate React component",
    status: "running",
    time: "now",
  },
  {
    id: "3",
    agent: "Analyzer",
    task: "Process dataset",
    status: "completed",
    time: "5m ago",
  },
  {
    id: "4",
    agent: "Research",
    task: "Fetch documentation",
    status: "failed",
    time: "10m ago",
  },
  {
    id: "5",
    agent: "Planner",
    task: "Create task queue",
    status: "pending",
    time: "12m ago",
  },
  {
    id: "6",
    agent: "Builder",
    task: "Review code changes",
    status: "completed",
    time: "15m ago",
  },
  {
    id: "7",
    agent: "Analyzer",
    task: "Generate insights",
    status: "completed",
    time: "20m ago",
  },
];

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: "text-[hsl(150_70%_60%)]",
    bg: "bg-[hsl(150_70%_60%/0.1)]",
    border: "border-[hsl(150_70%_60%/0.2)]",
  },
  running: {
    icon: PlayCircle,
    color: "text-[hsl(35_100%_60%)]",
    bg: "bg-[hsl(35_100%_60%/0.1)]",
    border: "border-[hsl(35_100%_60%/0.2)]",
  },
  failed: {
    icon: XCircle,
    color: "text-[hsl(0_100%_60%)]",
    bg: "bg-[hsl(0_100%_60%/0.1)]",
    border: "border-[hsl(0_100%_60%/0.2)]",
  },
  pending: {
    icon: Clock,
    color: "text-[hsl(192_100%_60%)]",
    bg: "bg-[hsl(192_100%_60%/0.1)]",
    border: "border-[hsl(192_100%_60%/0.2)]",
  },
};

export function ActivityFeed() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded border border-[hsl(187_100%_50%/0.15)] bg-[hsl(222_47%_10%)] p-3 md:p-6"
      style={{
        background:
          "linear-gradient(135deg, hsl(222 47% 12%) 0%, hsl(222 47% 8%) 100%)",
        boxShadow: "0 4px 24px hsl(0 0% 0% / 0.4)",
      }}
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, hsl(187 100% 50% / 0.1) 0%, transparent 50%)",
        }}
      />

      <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[hsl(187_100%_50%/0.5)] to-transparent" />

      <div className="relative z-10">
        <h3 className="font-display mb-4 md:mb-6 text-lg font-semibold tracking-widest uppercase text-foreground">
          Activity Log
        </h3>
        <div className="space-y-1 max-h-64 md:max-h-80 overflow-y-auto pr-1 md:pr-2">
          {activities.map((activity, index) => {
            const Icon = statusConfig[activity.status].icon;
            const config = statusConfig[activity.status];

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.05, duration: 0.3 }}
                className="group/item flex items-center gap-3 rounded border border-transparent p-2 transition-all duration-300 hover:border-[hsl(187_100%_50%/0.1)] hover:bg-[hsl(187_100%_50%/0.05)]"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${config.bg} border ${config.border}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono truncate text-xs uppercase tracking-wider text-foreground">
                    {activity.task}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {activity.agent}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                  {activity.time}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
