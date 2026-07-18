import { LiveServers } from "@/components/servers/live-servers";

export function ServersSection({
  showHeading = true,
}: {
  showHeading?: boolean;
}) {
  return <LiveServers showHeading={showHeading} />;
}
