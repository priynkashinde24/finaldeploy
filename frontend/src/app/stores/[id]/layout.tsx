// Server component layout for static export
export function generateStaticParams() {
  return [];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

