"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ORDER_TABS = [
  { label: "Commandes", href: "/admin/commandes" },
  { label: "Brouillons", href: "/admin/commandes/brouillons" },
  { label: "Étiquettes d’expédition", href: "/admin/commandes/etiquettes" },
  { label: "Paniers abandonnés", href: "/admin/commandes/paniers-abandonnes" },
];

function isActiveTab(pathname: string, href: string) {
  if (href === "/admin/commandes") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminOrdersTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-100 overflow-x-auto">
      <nav className="flex min-w-max gap-1" aria-label="Navigation commandes">
        {ORDER_TABS.map((tab) => {
          const active = isActiveTab(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative px-3 sm:px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? "text-primary"
                  : "text-gray-500 hover:text-dark-800"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
              <span
                className={`absolute inset-x-3 sm:inset-x-4 -bottom-px h-0.5 rounded-full transition-opacity ${
                  active ? "bg-primary opacity-100" : "bg-transparent opacity-0"
                }`}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
