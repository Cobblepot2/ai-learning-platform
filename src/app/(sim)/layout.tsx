/** Full-screen simulations: no site navigation, the desktop fills the window. */
export default function SimulationLayout({ children }: { children: React.ReactNode }) {
  return <main className="h-dvh overflow-hidden">{children}</main>;
}
