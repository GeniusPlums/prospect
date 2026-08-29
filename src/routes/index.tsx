import { createFileRoute } from "@tanstack/react-router";
import { BriefHome } from "@/components/prospect/brief-home";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BriefHome />;
}
