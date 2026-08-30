import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/automations")({
  beforeLoad: () => {
    throw redirect({ to: "/settings" });
  },
});
