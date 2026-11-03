import CatalogueNav from "@/components/layout/catalogue-nav";

export default function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <CatalogueNav />
      {children}
    </div>
  );
}
