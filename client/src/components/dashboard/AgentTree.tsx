import { useState } from "react";
import { motion } from "motion/react";
import Tree from "react-d3-tree";

interface TreeNode {
  name: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
}

const agentTree: TreeNode = {
  name: "Orchestrator",
  attributes: {
    status: "running",
  },
  children: [
    {
      name: "Research",
      attributes: {
        status: "running",
      },
      children: [
        { name: "Web Search", attributes: { status: "idle" } },
        { name: "Doc Fetch", attributes: { status: "idle" } },
      ],
    },
    {
      name: "Builder",
      attributes: {
        status: "idle",
      },
      children: [
        { name: "Code Gen", attributes: { status: "idle" } },
        { name: "Review", attributes: { status: "idle" } },
      ],
    },
    {
      name: "Analyzer",
      attributes: {
        status: "running",
      },
      children: [
        { name: "Process", attributes: { status: "running" } },
        { name: "Insights", attributes: { status: "idle" } },
      ],
    },
  ],
};

export function AgentTree() {
  const [translate] = useState({ x: 50, y: 80 });

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
          Hierarchy
        </h3>
        <div
          className="h-48 md:h-72 overflow-hidden rounded"
          style={{
            background:
              "linear-gradient(135deg, hsl(222 47% 14% / 0.5) 0%, hsl(222 47% 10% / 0.3) 100%)",
          }}
        >
          <Tree
            data={agentTree}
            orientation="horizontal"
            pathFunc="step"
            translate={translate}
            nodeSize={{ x: 110, y: 55 }}
            renderCustomNodeElement={(rd3tProps) => {
              const { nodeDatum } = rd3tProps;
              const isRunning = nodeDatum.attributes?.status === "running";

              return (
                <g>
                  <circle
                    r="14"
                    fill={
                      isRunning
                        ? "url(#gradientRunningCyber)"
                        : "url(#gradientIdleCyber)"
                    }
                    stroke={isRunning ? "#f59e0b" : "#6b7280"}
                    strokeWidth="1"
                  />
                  <defs>
                    <linearGradient
                      id="gradientRunningCyber"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                    <linearGradient
                      id="gradientIdleCyber"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#4b5563" />
                      <stop offset="100%" stopColor="#1f2937" />
                    </linearGradient>
                  </defs>
                  <text
                    dy="24"
                    textAnchor="middle"
                    fill="hsl(192 100% 80%)"
                    fontSize="9"
                    fontFamily="Space Mono, monospace"
                  >
                    {nodeDatum.name}
                  </text>
                  {nodeDatum.attributes?.status && (
                    <text
                      dy="36"
                      textAnchor="middle"
                      fill={isRunning ? "#f59e0b" : "#6b7280"}
                      fontSize="7"
                      fontFamily="Space Mono, monospace"
                    >
                      [{nodeDatum.attributes.status}]
                    </text>
                  )}
                </g>
              );
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
