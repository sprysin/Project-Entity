import { useState } from 'react';
import './CatalogPagination.css';

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
    return <nav aria-label="Card catalog pages" className="catalog-pagination">
        <button type="button" data-sound="select-small" aria-label="Previous page" title="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><i className="fa-solid fa-arrow-left" aria-hidden="true" /></button>
        <button type="button" data-sound="select-small" aria-label="Next page" title="Next page" disabled={page === pages - 1} onClick={() => onPage(page + 1)}><i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
        <span role="status" className="catalog-pagination__status">
            <span className="sr-only">Page {page + 1} of {pages} · {total} cards</span>
            <span aria-hidden="true"><strong>{String(page + 1).padStart(2, '0')}</strong> / {String(pages).padStart(2, '0')}</span>
            <small aria-hidden="true">{total} cards</small>
        </span>
    </nav>;
}
