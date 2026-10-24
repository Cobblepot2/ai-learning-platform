import { NavBar } from "@/components/NavBar";
import { ColorBends } from "@/components/home/ColorBends";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-shell relative isolate min-h-dvh text-white">
      <div className="fixed inset-0 -z-10 bg-black">
        <ColorBends colors={["#0F172A", "#1E3A8A", "#3730A3", "#6D28D9"]} />
      </div>
      <NavBar />
      <main className="pt-16 lg:pt-28">{children}</main>
    </div>
  );
}
