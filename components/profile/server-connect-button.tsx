import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ServerConnectButtonProps = {
  href: string | null;
  online: boolean;
  serverName: string;
  className?: string;
};

export function ServerConnectButton({
  href,
  online,
  serverName,
  className,
}: ServerConnectButtonProps) {
  const classNames = cn(buttonVariants(), "btn-glow justify-center", className);

  if (!online || !href) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          buttonVariants({ variant: "secondary" }),
          "pointer-events-none justify-center opacity-45",
          className,
        )}
      >
        Connect
      </span>
    );
  }

  return (
    <a href={href} className={classNames} aria-label={`Connect to ${serverName}`}>
      Connect
      <ArrowRight data-icon="inline-end" />
    </a>
  );
}
