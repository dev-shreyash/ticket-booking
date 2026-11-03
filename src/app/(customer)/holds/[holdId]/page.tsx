import HoldSummary from "@/components/holds/hold-summary";

type PageProps = {
  params: Promise<{
    holdId: string;
  }>;
};

export default async function HoldSummaryPage({
  params,
}: PageProps) {
  const { holdId } = await params;

  return <HoldSummary holdId={holdId} />;
}