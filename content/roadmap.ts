import type { RoadmapPhase } from "@/types/content";

export const roadmap: RoadmapPhase[] = [
  {
    id: "phase-1",
    phase: "Phase 1",
    title: "Public Retakes",
    status: "completed",
    items: [
      "[WallBang] Retake #1 | [Mumbai] is live — connect via Steam from wallbang.xyz",
      "CounterStrikeSharp + Metamod + Retakes + WallBang plugin stack online",
      "India-first (Mumbai) low-latency public retake server",
      "Website with live server list, Steam connect links, Discord, and waitlist",
    ],
  },
  {
    id: "phase-2",
    phase: "Phase 2",
    title: "VIP & Identity",
    status: "in-progress",
    items: [
      "VIP membership with cosmetic-focused rewards (no pay-to-win)",
      "Steam login and secure account linking (site auth live)",
      "Core player statistics pipeline from live retake servers",
      "Early inventory foundations for knives, weapons, and gloves",
      "Additional retake capacity as player demand grows",
    ],
  },
  {
    id: "phase-3",
    phase: "Phase 3",
    title: "Profiles & Rankings",
    status: "planned",
    items: [
      "Public player profiles",
      "Leaderboards across modes and seasons",
      "Season rankings with transparent reset cadence",
      "Match history and deeper performance breakdowns",
    ],
  },
  {
    id: "phase-4",
    phase: "Phase 4",
    title: "Competitive Platform",
    status: "planned",
    items: [
      "Expanded competitive matchmaking",
      "Tournament brackets and event tooling",
      "Admin dashboard for operations and moderation",
      "Cross-server progression at platform scale",
    ],
  },
];
