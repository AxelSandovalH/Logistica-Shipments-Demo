// Layout propio para /pending — no hereda el DashboardShell
// ni el redirect de PENDING del layout padre
export default function PendingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
