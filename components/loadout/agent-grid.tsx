"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SkinImage } from "@/components/loadout/skin-image";
import { AGENTS } from "@/lib/loadout/mock-data";
import { cn } from "@/lib/utils";
import type { AgentFaction, EquippedAgent } from "@/types/loadout";

type AgentGridProps = {
  faction: AgentFaction;
  equipped: EquippedAgent | null;
  filter: string;
  onEquip: (agentId: string, name: string, faction: AgentFaction) => void;
};

export function AgentGrid({
  faction,
  equipped,
  filter,
  onEquip,
}: AgentGridProps) {
  const query = filter.trim().toLowerCase();

  const agents = AGENTS.filter((a) => {
    if (a.faction !== faction) return false;
    if (!query) return true;
    return a.name.toLowerCase().includes(query);
  });

  const equippedId = equipped?.agentId;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {faction === "CT" ? "CT Agents" : "T Agents"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {agents.length} item{agents.length === 1 ? "" : "s"}
        </p>
      </div>

      {agents.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No agents match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  <p className="font-heading text-sm font-semibold">{agent.name}</p>
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
