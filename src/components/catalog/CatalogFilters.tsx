import { useEffect, useId, useRef, useState } from 'react';
import { ActionSubtype, Attribute, Card, CardType, PawnSubtype, PawnType } from '../../types';
import { cardSubtype } from '../../cards/CardRegistry';
import { isReservePawn } from '../../game/cardHelpers';
import PageBrand from '../common/PageBrand';
import './CatalogFilters.css';

type FilterGroup = 'level' | 'pawnType' | 'attribute' | 'pawnSubtype' | 'action' | 'condition' | 'all';
type Filters = Record<FilterGroup, string[]>;
const emptyFilters = (): Filters => ({ level: [], pawnType: [], attribute: [], pawnSubtype: [], action: [], condition: [], all: [] });
const cardTypes = [{ type: CardType.PAWN, label: 'Pawn' }, { type: CardType.ACTION, label: 'Action' }, { type: CardType.CONDITION, label: 'Condition' }] as const;
const groups = [
    { key: 'pawnSubtype', label: 'Subtype', options: ['Standard', PawnSubtype.VASSAL, PawnSubtype.SWITCH] },
    { key: 'level', label: 'Level', options: Array.from({ length: 10 }, (_, level) => String(level + 1)) },
    { key: 'attribute', label: 'Attribute', options: Object.values(Attribute) },
    { key: 'pawnType', label: 'Type', options: Object.values(PawnType) },
] as const;
const subtypeGroups = {
    [CardType.ACTION]: { key: 'action', label: 'Subtype', options: ['Normal', 'Lingering', 'Attach', ...Object.values(ActionSubtype)] },
    [CardType.CONDITION]: { key: 'condition', label: 'Subtype', options: ['Normal', 'Lingering', 'Attach'] },
} as const;
const hasSelection = (filters: Filters, type: CardType) => filters.all.includes(type) || (type === CardType.PAWN
    ? groups.some(({ key }) => filters[key].length > 0) : filters[subtypeGroups[type].key].length > 0);

export function useCatalogFilters() {
    const [filters, setFilters] = useState<Filters>(emptyFilters);
    const [applied, setApplied] = useState(filters);
    const active = cardTypes.some(({ type }) => hasSelection(applied, type));
    return {
        filters, active,
        key: JSON.stringify(applied),
        begin: () => setFilters(applied),
        apply: () => setApplied(filters),
        toggle: (group: FilterGroup, value: string) => setFilters(previous => {
            const next = { ...previous, [group]: previous[group].includes(value) ? previous[group].filter(item => item !== value) : [...previous[group], value] };
            const type = group === 'all' ? value as CardType : group === 'action' ? CardType.ACTION : group === 'condition' ? CardType.CONDITION : CardType.PAWN;
            if (group === 'all') {
                if (type === CardType.PAWN) groups.forEach(({ key }) => { next[key] = []; });
                else next[subtypeGroups[type].key] = [];
            } else next.all = next.all.filter(item => item !== type);
            return next;
        }),
        clear: () => setFilters(emptyFilters()),
        matches: (card: Pick<Card, 'type' | 'level' | 'pawnType' | 'attribute' | 'pawnSubtype' | 'actionSubtype' | 'isAttached' | 'isLingering'>) =>
            !active || applied.all.includes(card.type) || (hasSelection(applied, card.type) && (card.type === CardType.PAWN
                ? groups.every(({ key }) => !applied[key].length || applied[key].includes(String(card[key]))
                    || key === 'pawnSubtype' && applied[key].includes('Standard') && !isReservePawn(card))
                : applied[subtypeGroups[card.type].key].includes(cardSubtype(card)!))),
    };
}

export default function CatalogFilters({ filters, toggle, active, clear, begin, apply }: ReturnType<typeof useCatalogFilters>) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState(CardType.PAWN);
    const tabId = useId();
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
            <header><div className="catalog-filters__heading"><PageBrand section="" /><h2>Filter cards</h2></div><button autoFocus data-sound="cancellation" className="catalog-filters__close" type="button" aria-label="Close filters" onClick={close}>Close</button></header>
            <div className="catalog-filters__tabs" role="tablist" aria-label="Card type tabs">
                {cardTypes.map(({ type, label }, index) => <button key={type} type="button" role="tab" id={`${tabId}-${type}`}
                    aria-controls={`${tabId}-panel`} aria-selected={tab === type} tabIndex={tab === type ? 0 : -1}
                    aria-label={`${label}${hasSelection(filters, type) ? ', filters selected' : ''}`}
                    onKeyDown={event => {
                        const next = event.key === 'ArrowRight' ? (index + 1) % cardTypes.length : event.key === 'ArrowLeft' ? (index + cardTypes.length - 1) % cardTypes.length : event.key === 'Home' ? 0 : event.key === 'End' ? cardTypes.length - 1 : -1;
                        if (next < 0) return;
                        event.preventDefault();
                        setTab(cardTypes[next].type);
                        document.getElementById(`${tabId}-${cardTypes[next].type}`)?.focus();
                    }}
                    onClick={() => setTab(type)}><span>{label}</span>{hasSelection(filters, type) && <span className="catalog-filters__selection" aria-hidden="true" />}</button>)}
            </div>
            <div className="catalog-filters__body" role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
            <div className="catalog-filters__options" role="group" aria-label="All cards of this type">
                <button type="button" aria-pressed={filters.all.includes(tab)} onClick={() => toggle('all', tab)}>All {cardTypes.find(({ type }) => type === tab)!.label} cards</button>
            </div>
            {(tab === CardType.PAWN ? groups : [subtypeGroups[tab]]).map(({ key, label, options }) =>
            <div className={`catalog-filters__options catalog-filters__options--${key}`} role="group" aria-label={`${label} filters`} key={key}>
                <span>{label}</span>
                {options.map(value => <button key={value} type="button" data-sound="toggle"
                    aria-label={`${label} ${value}`} aria-pressed={filters[key].includes(value)}
                    onClick={() => toggle(key, value)}>{key === 'attribute' ? value : value.charAt(0) + value.slice(1).toLowerCase()}</button>)}
            </div>)}
            </div>
            <footer><button className="catalog-filters__clear" type="button" onClick={clear}>Clear filters</button><button type="submit" className="catalog-filters__search"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Search</button></footer>
            </form>
        </dialog>}
    </div>;
}
