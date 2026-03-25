"use client";

import Link from "next/link";
import { isOfflineSupportedPath } from "@/lib/offline/config";

type OfflineRouteLinkProps = React.ComponentProps<typeof Link>;

export function OfflineRouteLink({ href, onClick, ...props }: OfflineRouteLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || typeof href !== "string") {
          return;
        }

        const url = new URL(href, window.location.origin);
        if (!navigator.onLine && isOfflineSupportedPath(url.pathname)) {
          event.preventDefault();
          window.location.assign(url.pathname + url.search + url.hash);
        }
      }}
    />
  );
}
