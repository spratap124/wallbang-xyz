"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

type ActivityMetric = "players" | "sessions" | "playtime" | "concurrent";
type ActivityRow = {
  date: string;
  uniquePlayers: number | null;
  returningPlayers: number | null;
  sessions: number | null;
  playtimeHours: number | null;
  avgConcurrent: number | null;
};

export function ActivityBars({
  rows,
  metric,
  dataKey,
  label,
}: {
  rows: ActivityRow[];
  metric: ActivityMetric;
  dataKey: keyof ActivityRow;
  label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={rows}
        margin={{ top: 8, right: metric === "players" ? 0 : 8, bottom: 0, left: -18 }}
      >
        <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dateLabel}
          interval="preserveStartEnd"
          minTickGap={18}
          tick={{ fill: "#9aa3ad", fontSize: 11 }}
          axisLine={{ stroke: "rgba(148,163,184,.2)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          allowDecimals={metric === "playtime" || metric === "concurrent"}
          tickFormatter={(value: number) =>
            metric === "playtime" ? `${value}h` : String(value)
          }
          tick={{ fill: "#8290a0", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
          domain={[0, "auto"]}
        />
        {metric === "players" ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            allowDecimals
            tickFormatter={(value: number) => Number(value).toFixed(1)}
            tick={{ fill: "#8290a0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={34}
            domain={[0, "auto"]}
          />
        ) : null}
        <Tooltip
          labelFormatter={(value) => `${dateLabel(String(value))} · IST`}
          formatter={(value, name) => [
            metric === "playtime" && value != null
              ? `${Number(value).toFixed(1)} hours`
              : (value ?? "No retained data"),
            name,
          ]}
          contentStyle={{
            background: "#12151a",
            border: "1px solid #2a313c",
            borderRadius: 8,
            fontSize: 10,
          }}
          labelStyle={{ color: "#f3f5f7" }}
        />
        {metric === "players" ? (
          <>
            <Bar
              yAxisId="left"
              dataKey="uniquePlayers"
              name="Unique players"
              fill="#e8242a"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="left"
              dataKey="returningPlayers"
              name="Returning players (subset)"
              fill="#28a8d8"
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              dataKey="avgConcurrent"
              name="Avg concurrent"
              type="monotone"
              stroke="#f3f5f7"
              strokeWidth={1.5}
              dot={{ r: 2, fill: "#f3f5f7" }}
              activeDot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </>
        ) : (
          <Bar
            yAxisId="left"
            dataKey={dataKey}
            name={label}
            fill={metric === "concurrent" ? "#28a8d8" : "#e8242a"}
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ConcurrencyBars({
  rows,
}: {
  rows: Array<{ date: string; peak: number | null; average: number | null }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dateLabel}
          interval="preserveStartEnd"
          minTickGap={16}
          tick={{ fill: "#9aa3ad", fontSize: 11 }}
          axisLine={{ stroke: "rgba(148,163,184,.2)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals
          tick={{ fill: "#8290a0", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={30}
          domain={[0, "auto"]}
        />
        <Tooltip
          labelFormatter={(value) => `${dateLabel(String(value))} · IST`}
          formatter={(value, name) => [value ?? "No retained data", name]}
          contentStyle={{
            background: "#12151a",
            border: "1px solid #2a313c",
            borderRadius: 8,
            fontSize: 10,
          }}
          labelStyle={{ color: "#f3f5f7" }}
        />
        <Bar
          dataKey="peak"
          name="Peak concurrent"
          fill="#e8242a"
          radius={[3, 3, 0, 0]}
          maxBarSize={16}
          isAnimationActive={false}
        />
        <Bar
          dataKey="average"
          name="Time-weighted average"
          fill="#28a8d8"
          radius={[3, 3, 0, 0]}
          maxBarSize={16}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlayerMixDonut({
  rows,
  uniquePlayers,
}: {
  rows: Array<{ name: string; value: number; color: string }>;
  uniquePlayers: number;
}) {
  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="64%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {rows.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value} player(s)`, name]}
            contentStyle={{
              background: "#12151a",
              border: "1px solid #2a313c",
              borderRadius: 8,
              fontSize: 10,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-semibold tabular-nums">{uniquePlayers}</span>
        <span className="text-muted-foreground text-[11px]">Unique Players</span>
      </div>
    </>
  );
}

export function DurationBars({
  rows,
}: {
  rows: Array<{ key: string; label: string; count: number; percent: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 10, right: 4, bottom: 2, left: -24 }}>
        <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#9aa3ad", fontSize: 10 }}
          interval={0}
          axisLine={{ stroke: "rgba(148,163,184,.2)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, "auto"]}
          tickFormatter={(value: number) => `${Math.round(value)}%`}
          tick={{ fill: "#8290a0", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as { count: number; percent: number };
            return (
              <div className="border-border bg-popover text-popover-foreground rounded-md border px-2.5 py-2 text-[12px] shadow-lg">
                <p className="font-medium">{String(label)}</p>
                <p className="text-muted-foreground mt-0.5">
                  {row.count} sessions · {row.percent.toFixed(1)}%
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="percent"
          name="Session share"
          fill="#e8242a"
          radius={[3, 3, 0, 0]}
          maxBarSize={30}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
