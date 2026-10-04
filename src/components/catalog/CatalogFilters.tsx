import { useEffect, useRef, useState } from 'react';
import { Attribute, Card, CardType, PawnType } from '../../types';
import './CatalogFilters.css';

type FilterGroup = 'level' | 'pawnType' | 'attribute';
type Filters = Record<FilterGroup, string[]>;
const groups = [
    { key: 'level', label: 'Level', options: Array.from({ length: 10 }, (_, level) => String(level + 1)) },
    { key: 'attribute', label: 'Attribute', options: Object.values(Attribute) },
    { key: 'pawnType', label: 'Type', options: Object.values(PawnType) },
] as const;

export function useCatalogFilters() {
    const [filters, setFilters] = useState<Filters>({ level: [], pawnType: [], attribute: [] });
    const [applied, setApplied] = useState(filters);
    const active = groups.some(({ key }) => applied[key].length > 0);
    return {
        filters, active,
        key: JSON.stringify(applied),
        begin: () => setFilters(applied),
        apply: () => setApplied(filters),
        toggle: (group: FilterGroup, value: string) => setFilters(previous => ({
            ...previous,
            [group]: previous[group].includes(value) ? previous[group].filter(item => item !== value) : [...previous[group], value],
        })),
        clear: () => setFilters({ level: [], pawnType: [], attribute: [] }),
        matches: (card: Pick<Card, 'type' | 'level' | 'pawnType' | 'attribute'>) => groups.every(({ key }) =>
            !applied[key].length || card.type === CardType.PAWN && applied[key].includes(String(card[key]))),
    };
}

export default function CatalogFilters({ filters, toggle, active, clear, begin, apply }: ReturnType<typeof useCatalogFilters>) {
    const [open, setOpen] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (open) dialog.current?.showModal();
    }, [open]);
    const close = () => { dialog.current?.close(); setOpen(false); };
    return <div className="catalog-filters" aria-label="Card filters">
        <button type="button" data-sound="toggle" aria-haspopup="dialog" aria-expanded={open}
            className={active ? 'is-active' : ''} onClick={() => { begin(); setOpen(true); }}
        >Filters{active ? ' • Active' : ''}</button>
        {open && <dialog ref={dialog} className="catalog-filters__menu" aria-label="Filter cards"
            onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}
            onClick={event => { if (event.target === event.currentTarget) close(); }}>
            <form onSubmit={event => { event.preventDefault(); apply(); close(); }}>
            <header><h2>Filter cards</h2><button autoFocus className="catalog-filters__close" type="button" aria-label="Close filters" onClick={close}><i className="fa-solid fa-xmark" aria-hidden="true" /></button></header>
            {groups.map(({ key, label, options }) =>
            <div className={`catalog-filters__options catalog-filters__options--${key}`} role="group" aria-label={`${label} filters`} key={key}>
                <span>{label}</span>
                {options.map(value => <button key={value} type="button" data-sound="toggle"
                    aria-label={`${label} ${value}`} aria-pressed={filters[key].includes(value)}
                    onClick={() => toggle(key, value)}>{key === 'attribute' ? value : value.charAt(0) + value.slice(1).toLowerCase()}</button>)}
            </div>)}
            <footer><button className="catalog-filters__clear" type="button" onClick={clear}>Clear filters</button><button type="submit" className="catalog-filters__search"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Search</button></footer>
            </form>
        </dialog>}
    </div>;
}
