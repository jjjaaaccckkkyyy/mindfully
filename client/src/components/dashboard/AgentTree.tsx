import { motion } from "motion/react";

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: "running" | "idle";
  x: number;
  y: number;
  connections: string[];
}

const nodes: AgentNode[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    role: "Planner",
    status: "running",
    x: 400,
    y: 200,
    connections: ["research", "builder", "analyzer"],
  },
  {
    id: "research",
    name: "Research",
    role: "Search & Fetch",
    status: "running",
    x: 200,
    y: 80,
    connections: ["web-search", "doc-fetch"],
  },
  {
    id: "builder",
    name: "Builder",
    role: "Code Gen",
    status: "idle",
    x: 400,
    y: 80,
    connections: ["code-gen", "code-review"],
  },
  {
    id: "analyzer",
    name: "Analyzer",
    role: "Data Process",
    status: "running",
    x: 600,
    y: 80,
    connections: ["process", "insights"],
  },
  {
    id: "web-search",
    name: "Web Search",
    role: "Tool",
    status: "idle",
    x: 100,
    y: 20,
    connections: [],
  },
  {
    id: "doc-fetch",
    name: "Doc Fetch",
    role: "Tool",
    status: "idle",
    x: 200,
    y: 20,
    connections: [],
  },
  {
    id: "code-gen",
    name: "Code Gen",
    role: "Tool",
    status: "idle",
    x: 350,
    y: 20,
    connections: [],
  },
  {
    id: "code-review",
    name: "Review",
    role: "Tool",
    status: "idle",
    x: 450,
    y: 20,
    connections: [],
  },
  {
    id: "process",
    name: "Process",
    role: "Tool",
    status: "running",
    x: 550,
    y: 20,
    connections: [],
  },
  {
    id: "insights",
    name: "Insights",
    role: "Tool",
    status: "idle",
    x: 650,
    y: 20,
    connections: [],
  },
];

export function AgentTree() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
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
          Agent Hierarchy
        </h3>
        <div className="h-48 md:h-72 overflow-hidden rounded relative">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 250"
            className="overflow-visible"
          >
            {/* Connection lines */}
            {nodes.map((node) =>
              node.connections.map((targetId) => {
                const target = nodes.find((n) => n.id === targetId);
                if (!target) return null;

                return (
                  <motion.line
                    key={`${node.id}-${targetId}`}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    x1={node.x}
                    y1={node.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="hsl(187 100% 50% / 0.3)"
                    strokeWidth="2"
                    className="transition-all duration-300 hover:stroke-[hsl(187_100%_50%/0.6)]"
                  />
                );
              }),
            )}

            {/* Nodes */}
            {nodes.map((node, index) => {
              const isTool = node.role === "Tool";
              const isRunning = node.status === "running";

              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.05, duration: 0.3 }}
                  className="cursor-pointer"
                >
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isTool ? 18 : 24}
                    fill={
                      isRunning ? "url(#runningGradient)" : "url(#idleGradient)"
                    }
                    stroke={
                      isRunning
                        ? "hsl(187 100% 70%)"
                        : "hsl(187 100% 50% / 0.3)"
                    }
                    strokeWidth="2"
                    className="transition-all duration-300 hover:stroke-[hsl(187_100%_70%)]"
                    style={{
                      filter: isRunning
                        ? "drop-shadow(0 0 10px hsl(187 100% 50% / 0.5))"
                        : "none",
                    }}
                  />

                  {/* Running indicator pulse */}
                  {isRunning && (
                    <>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isTool ? 18 : 24}
                        fill="none"
                        stroke="hsl(187 100% 70%)"
                        strokeWidth="2"
                        opacity="0.6"
                      >
                        <animate
                          attributeName="r"
                          from={isTool ? 18 : 24}
                          to={isTool ? 30 : 36}
                          dur="2s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          from="0.6"
                          to="0"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </>
                  )}

                  {/* Node label */}
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill="hsl(192 100% 90%)"
                    fontSize={isTool ? "9" : "11"}
                    fontFamily="Space Mono, monospace"
                    fontWeight="600"
                  >
                    {node.name}
                  </text>

                  {/* Role label */}
                  <text
                    x={node.x}
                    y={node.y + (isTool ? 32 : 40)}
                    textAnchor="middle"
                    fill={isRunning ? "hsl(187 100% 70%)" : "hsl(192 100% 60%)"}
                    fontSize="8"
                    fontFamily="Space Mono, monospace"
                  >
                    [{node.role}]
                  </text>
                </motion.g>
              );
            })}

            {/* Gradients */}
            <defs>
              <radialGradient id="runningGradient">
                <stop offset="0%" stopColor="hsl(187 100% 60%)" />
                <stop offset="100%" stopColor="hsl(187 100% 40%)" />
              </radialGradient>
              <radialGradient id="idleGradient">
                <stop offset="0%" stopColor="hsl(222 47% 20%)" />
                <stop offset="100%" stopColor="hsl(222 47% 15%)" />
              </radialGradient>
            </defs>
          </svg>

          {/* Grid overlay for cyberpunk effect */}
          <div
            className="absolute inset-0 pointer-events-none opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(hsl(187 100% 50%) 1px, transparent 1px),
                linear-gradient(90deg, hsl(187 100% 50%) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
