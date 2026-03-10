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
          className="agent-card"
        >
          <div className="agent-card-glow" />

          <div className="agent-card-border-gradient" />

          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="agent-card-icon">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="agent-card-name text-foreground">
                    {agent.name}
                  </h3>
                  <p className="agent-card-role">
                    {agent.description}
                  </p>
                </div>
              </div>
            </div>

            <div className={`mt-4 agent-card-status ${agent.status}`}>
              <StatusIcon status={agent.status} />
              <span className="font-mono text-[10px] uppercase tracking-wider">
                {agent.status}
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
