import { TeachShell } from "@/components/teaching/TeachShell";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeachShell>{children}</TeachShell>;
}
