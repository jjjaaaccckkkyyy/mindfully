import { motion } from "motion/react";
import {
  Bot,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

type AgentStatus = "running" | "idle" | "error" | "starting";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  tasksCompleted: number;
  avgDuration: string;
}

const agents: Agent[] = [
  {
    id: "1",
    name: "Research",
    description: "Web search and data collection",
    status: "running",
    tasksCompleted: 156,
    avgDuration: "2.3s",
  },
  {
    id: "2",
    name: "Builder",
    description: "Code generation and review",
    status: "idle",
    tasksCompleted: 89,
    avgDuration: "5.1s",
  },
  {
    id: "3",
    name: "Analyzer",
    description: "Data analysis and insights",
    status: "running",
    tasksCompleted: 234,
    avgDuration: "1.8s",
  },
  {
    id: "4",
    name: "Planner",
    description: "Task orchestration",
    status: "idle",
    tasksCompleted: 67,
    avgDuration: "0.5s",
  },
];

const statusConfig: Record<
  AgentStatus,
  { color: string; glow: string; label: string; border: string }
> = {
  running: {
    color: "text-[hsl(150_70%_60%)]",
    glow: "shadow-[hsl(150_70%_50%/0.3)]",
    label: "Running",
    border: "border-[hsl(150_70%_50%/0.3)]",
  },
  idle: {
    color: "text-[hsl(192_100%_60%)]",
    glow: "shadow-[hsl(192_100%_50%/0.2)]",
    label: "Idle",
    border: "border-[hsl(192_100%_50%/0.2)]",
  },
  error: {
    color: "text-[hsl(0_100%_60%)]",
    glow: "shadow-[hsl(0_100%_50%/0.3)]",
    label: "Error",
    border: "border-[hsl(0_100%_50%/0.3)]",
  },
  starting: {
    color: "text-[hsl(35_100%_60%)]",
    glow: "shadow-[hsl(35_100%_50%/0.3)]",
    label: "Starting",
    border: "border-[hsl(35_100%_50%/0.3)]",
  },
};

function StatusIcon({ status }: { status: AgentStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "idle":
      return <CheckCircle2 className="h-4 w-4" />;
    case "error":
      return <AlertCircle className="h-4 w-4" />;
    case "starting":
      return <Zap className="h-4 w-4" />;
  }
}

export function AgentCards() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
      {agents.map((agent, index) => (
        <motion.div
          key={agent.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
          className="group relative overflow-hidden rounded border border-[hsl(187_100%_50%/0.15)] bg-[hsl(222_47%_10%)] p-5 transition-all duration-500 hover:border-[hsl(187_100%_50%/0.4)]"
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
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.1)]">
                  <Bot className="h-5 w-5 text-[hsl(187_100%_70%)]" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold tracking-widest uppercase text-foreground">
                    {agent.name}
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {agent.description}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`mt-4 flex items-center gap-2 rounded border px-3 py-1.5 ${statusConfig[agent.status].border}`}
              style={{
                background:
                  "linear-gradient(135deg, hsl(222 47% 14% / 0.8) 0%, hsl(222 47% 12% / 0.6) 100%)",
                boxShadow: `0 0 10px ${statusConfig[agent.status].glow}`,
              }}
            >
              <span className={statusConfig[agent.status].color}>
                <StatusIcon status={agent.status} />
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-wider ${statusConfig[agent.status].color}`}
              >
                {statusConfig[agent.status].label}
              </span>
              {agent.status === "running" && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(150_70%_60%)] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(150_70%_60%)]" />
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[hsl(187_100%_50%/0.1)] pt-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                <span className="font-mono text-xs">
                  {agent.tasksCompleted}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono text-xs">{agent.avgDuration}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
