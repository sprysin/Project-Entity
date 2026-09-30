import { useState } from 'react';

export const CATALOG_PAGE_SIZE = 60;

/** Search changes reset navigation; shrinking results clamp the current page. */
export function useCatalogPage<T>(items: readonly T[], query: string) {
    const [navigation, setNavigation] = useState({ query, page: 0 });
    const pages = Math.max(1, Math.ceil(items.length / CATALOG_PAGE_SIZE));
    const page = navigation.query === query ? Math.min(navigation.page, pages - 1) : 0;
    return {
        entries: items.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE),
        page, pages, total: items.length,
        onPage: (next: number) => setNavigation({ query, page: Math.max(0, Math.min(next, pages - 1)) }),
    };
}

export default function CatalogPagination({ page, pages, total, onPage }: {
    page: number; pages: number; total: number; onPage: (page: number) => void;
}) {
    if (pages <= 1) return null;
    return <nav aria-label="Card catalog pages" className="flex items-center justify-between gap-3 p-3 text-xs text-slate-200">
        <button data-sound="select-small" className="border border-slate-600 rounded px-3 py-2 disabled:opacity-40" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
        <span role="status">Page {page + 1} of {pages} · {total} cards</span>
        <button data-sound="select-small" className="border border-slate-600 rounded px-3 py-2 disabled:opacity-40" disabled={page === pages - 1} onClick={() => onPage(page + 1)}>Next</button>
    </nav>;
}
