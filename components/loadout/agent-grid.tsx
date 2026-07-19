"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkinImage } from "@/components/loadout/skin-image";
import { AGENTS } from "@/lib/loadout/mock-data";
import { cn } from "@/lib/utils";
import type { AgentFaction, EquippedAgent } from "@/types/loadout";

type AgentGridProps = {
  agentCT: EquippedAgent | null;
  agentT: EquippedAgent | null;
  filter: string;
  onEquip: (agentId: string, name: string, faction: AgentFaction) => void;
};

export function AgentGrid({
  agentCT,
  agentT,
  filter,
  onEquip,
}: AgentGridProps) {
  const [faction, setFaction] = useState<AgentFaction>("CT");
  const query = filter.trim().toLowerCase();

  const agents = AGENTS.filter((a) => {
    if (a.faction !== faction) return false;
    if (!query) return true;
    return a.name.toLowerCase().includes(query);
  });

  const equippedId = faction === "CT" ? agentCT?.agentId : agentT?.agentId;

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg bg-secondary p-1">
        {(["CT", "T"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFaction(tab)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              faction === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === "CT" ? "Counter-Terrorist" : "Terrorist"}
          </button>
        ))}
      </div>

      {agents.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No agents match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const isEquipped = equippedId === agent.id;
            return (
              <div
                key={agent.id}
                className={cn(
                  "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-all",
                  isEquipped && "ring-primary/50",
                )}
              >
                <SkinImage
                  name={agent.name}
                  rarity={faction === "CT" ? "Mil-Spec" : "Restricted"}
                  image={agent.image}
                  size="lg"
                  className="rounded-none"
                  alt={agent.name}
                />
                <div className="space-y-3 p-3">
                  <div>
                    <p className="font-heading text-sm font-semibold">{agent.name}</p>
                    <Badge variant="secondary" className="mt-1.5">
                      {faction}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={isEquipped ? "secondary" : "default"}
                    className="w-full"
                    onClick={() => onEquip(agent.id, agent.name, faction)}
                    disabled={isEquipped}
                  >
                    {isEquipped ? (
                      <>
                        <Check data-icon="inline-start" />
                        Equipped
                      </>
                    ) : (
                      "Equip"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
