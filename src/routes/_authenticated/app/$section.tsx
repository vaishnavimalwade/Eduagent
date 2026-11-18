import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import Workspace, { nav, sections } from "@/components/edu/Workspace";

export const Route = createFileRoute("/_authenticated/app/$section")({
  head: ({ params }) => {
    const label = nav.find((n) => n[0] === params.section)?.[1] ?? "Workspace";
    return {
      meta: [
        { title: `${label} · EduAgent` },
        { name: "description", content: `EduAgent ${label}: plan, schedule and focus on your academic work.` },
        { property: "og:title", content: `${label} · EduAgent` },
        { property: "og:description", content: `EduAgent ${label}: plan, schedule and focus on your academic work.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: SectionPage,
});

function SectionPage() {
  const { section } = Route.useParams();
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-[#f4f5f1]" />}>
      <Workspace initialSection={sections.includes(section) ? section : "dashboard"} />
    </ClientOnly>
  );
}
