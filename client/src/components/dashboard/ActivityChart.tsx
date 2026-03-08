import { motion } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { time: "00:00", tasks: 12, agents: 3 },
  { time: "04:00", tasks: 8, agents: 2 },
  { time: "08:00", tasks: 45, agents: 8 },
  { time: "12:00", tasks: 89, agents: 12 },
  { time: "16:00", tasks: 67, agents: 10 },
  { time: "20:00", tasks: 34, agents: 6 },
  { time: "24:00", tasks: 18, agents: 4 },
];

export function ActivityChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
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
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold tracking-widest uppercase text-foreground">
            Activity
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[hsl(35_100%_60%)] to-[hsl(35_100%_50%)] shadow-lg shadow-[hsl(35_100%_50%/0.4)]" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Tasks
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[hsl(150_70%_60%)] to-[hsl(150_70%_50%)] shadow-lg shadow-[hsl(150_70%_50%/0.4)]" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Agents
              </span>
            </div>
          </div>
        </div>

        <div className="h-48 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient
                  id="colorTasksCyber"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="colorAgentsCyber"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(187 100% 50% / 0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                className="text-xs"
                tick={{ fill: "hsl(192 100% 60%)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(187 100% 50% / 0.2)" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(192 100% 60%)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background:
                    "linear-gradient(135deg, hsl(222 47% 14%) 0%, hsl(222 47% 10%) 100%)",
                  border: "1px solid hsl(187 100% 50% / 0.3)",
                  borderRadius: "4px",
                  boxShadow: "0 0 20px hsl(187 100% 50% / 0.2)",
                }}
                labelStyle={{
                  color: "hsl(192 100% 80%)",
                  fontWeight: 600,
                  fontFamily: "Space Mono",
                }}
                itemStyle={{
                  color: "hsl(192 100% 70%)",
                  fontFamily: "Space Mono",
                }}
              />
              <Area
                type="monotone"
                dataKey="tasks"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTasksCyber)"
                name="Tasks"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#f59e0b",
                  stroke: "hsl(222 47% 10%)",
                  strokeWidth: 2,
                }}
              />
              <Area
                type="monotone"
                dataKey="agents"
                stroke="#34d399"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAgentsCyber)"
                name="Active Agents"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#34d399",
                  stroke: "hsl(222 47% 10%)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
