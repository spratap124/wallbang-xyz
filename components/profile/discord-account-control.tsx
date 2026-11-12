"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Link2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { DiscordIcon } from "@/components/shared/brand-icons";
import { cn } from "@/lib/utils";

type DiscordAccountControlProps = {
  linked: boolean;
  configured: boolean;
  returnTo: string;
  className?: string;
};

export function DiscordAccountControl({
  linked,
  configured,
  returnTo,
  className,
}: DiscordAccountControlProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!linked && !configured) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Discord linking is temporarily unavailable.
      </p>
    );
  }

  async function unlinkAccount() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/discord/unlink", {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "Could not unlink Discord. Please try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not unlink Discord. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("bg-background/40 mt-3", className)}
        disabled={!linked && !configured}
        onClick={() => setOpen(true)}
      >
        {linked ? (
          <>
            <DiscordIcon className="size-4" />
            Discord linked
          </>
        ) : (
          <>
            <Link2 data-icon="inline-start" />
            Link Discord account
          </>
        )}
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {linked ? (
            <>
              <Dialog.Title className="text-lg font-semibold">
                Discord is linked
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your Discord account is connected to this WallBang profile.
                This lets Discord recognize your WallBang player profile and,
                when role syncing is available, show your VIP status and Top 10
                leaderboard role on the WallBang server.
              </Dialog.Description>
              <p className="mt-4 text-sm text-muted-foreground">
                You can unlink it here and connect it again later.
              </p>
              {error ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Dialog.Close
                  render={
                    <Button type="button" variant="outline" disabled={pending} />
                  }
                >
                  Close
                </Dialog.Close>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={unlinkAccount}
                >
                  <Unlink data-icon="inline-start" />
                  {pending ? "Unlinking…" : "Unlink Discord"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="text-lg font-semibold">
                Link your Discord account
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Connect the Discord account you use in the WallBang community
                with the Steam account on this profile.
              </Dialog.Description>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  WallBang can match your game profile to your Discord member.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  When role syncing is available, show your VIP status or Top
                  10 leaderboard role on the WallBang Discord server.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  You can unlink your account at any time.
                </li>
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Discord will ask you to authorize WallBang. The link is saved to
                your account and cannot be linked to a different WallBang
                account while connected.
              </p>
              {error ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex justify-end gap-2">
                <Dialog.Close
                  render={<Button type="button" variant="outline" />}
                >
                  Cancel
                </Dialog.Close>
                <a
                  href={`/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`}
                  className={cn(buttonVariants())}
                >
                  <DiscordIcon className="size-4" />
                  Continue with Discord
                </a>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
