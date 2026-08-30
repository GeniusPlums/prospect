import { createFileRoute } from "@tanstack/react-router";
import { BriefHome } from "@/components/prospect/brief-home";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { sample?: string } => ({
    sample: typeof search.sample === "string" ? search.sample : undefined,
  }),
  component: Home,
});

function Home() {
  return <BriefHome />;
}
