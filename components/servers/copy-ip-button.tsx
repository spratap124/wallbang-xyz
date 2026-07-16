"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { GameServer } from "@/config/servers";
import { cn } from "@/lib/utils";

export function CopyIpButton({
  server,
  className,
}: {
  server: GameServer;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const address = `${server.host}:${server.port}`;

  async function copyIp() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={copyIp}
      aria-label={copied ? "IP copied" : `Copy IP ${address}`}
      title={copied ? "Copied" : "Copy IP"}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
