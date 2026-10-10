import Link from "next/link";

const ITEMS = [
  { href: "/", label: "היום", d: "M4 5h16M4 12h16M4 19h10" },
  { href: "/meals", label: "המאגר", d: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" },
  { href: "/settings", label: "יעדים", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
];

export default function Nav({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="ניווט ראשי">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} aria-current={current === item.href ? "page" : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={item.d} />
          </svg>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
