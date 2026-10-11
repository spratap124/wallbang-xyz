import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Reserved public moderation section.
 *
 * The global-bans ledger ships later. This section is intentionally pure
 * presentation: it renders no ban data, performs no queries, and must never
 * receive unreviewed reports, reporter identities, moderator notes, or any
 * status that is not explicitly published. When the ledger lands it should
 * consume a dedicated public moderation endpoint and render only records the
 * platform has published for the player in the current URL (no second
 * identity scheme, and no SteamID64 embedded in the DOM).
 */
export function ModerationRecords() {
  return (
    <Card id="moderation">
      <CardHeader>
        <CardTitle>Moderation Records</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border-border bg-muted/30 flex flex-col items-center rounded-lg border border-dashed px-4 py-8 text-center">
          <ShieldCheck className="text-muted-foreground size-6" aria-hidden />
          <p className="text-foreground mt-3 font-medium">No public moderation records</p>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            WallBang does not currently publish ban history here. When the public bans
            ledger is available, records for this player will appear in this section.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
