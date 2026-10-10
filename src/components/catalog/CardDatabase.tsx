import React, { useState } from 'react';
import CatalogFilters, { useCatalogFilters } from './CatalogFilters';
import CatalogPagination, { useCatalogPage } from './CatalogPagination';
import BackToHubButton from '../common/BackToHubButton';
import PageBrand from '../common/PageBrand';
import { matchesCardCatalog, cardSubtype } from '../../cards/CardRegistry';
import { sortedCards } from '../../decks';
import { CardDetail } from '../cards/CardDetail';
import { CardType, Card } from '../../types';
import { ActionCardIcon } from '../icons/ActionCardIcon';
import './CardDatabase.css';

interface CardDatabaseProps {
    onBack: () => void;
}

const rarityCodes: Record<Card['rarity'], string> = {
    Common: 'C', Uncommon: 'U', Rare: 'R', Epic: 'E',
    Legendary: 'Le', Mythic: 'My', Relic: 'Re',
};

const catalogTypes = [
    { type: CardType.PAWN, label: 'Pawns', icon: <i className="fa-solid fa-chess-pawn" aria-hidden="true" />, tone: 'pawn' },
    { type: CardType.ACTION, label: 'Actions', icon: <ActionCardIcon />, tone: 'action' },
    { type: CardType.CONDITION, label: 'Conditions', icon: <i className="fa-solid fa-hourglass-half" aria-hidden="true" />, tone: 'condition' },
] as const;

const CardDatabase: React.FC<CardDatabaseProps> = ({ onBack }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const filters = useCatalogFilters();
    const filteredCards = sortedCards().filter(card => matchesCardCatalog(card, searchQuery) && filters.matches(card));
    const pagination = useCatalogPage(filteredCards, searchQuery + filters.key);

    return <div className="card-database entity-page">
        <header className="entity-topbar database-topbar">
            <PageBrand section="CARD DATABASE / INDEX" />
            <BackToHubButton onClick={onBack} />
        </header>

        <div className="database-body">
            <main className="database-main">
                <div className="database-intro">
                    <div>
                        <h1>CARD <em>DATABASE</em></h1>
                    </div>
                    <span className="database-total">{String(filteredCards.length).padStart(2, '0')}<small>{searchQuery || filters.active ? 'MATCHING CARDS' : 'CARDS IN GAME'}</small></span>
                </div>

                <div className="database-tools">
                    <label className="database-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                        <input type="search" aria-label="Search cards" placeholder="Search cards by name or text" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
                    </label>

                </div>

                <CatalogFilters {...filters} />
                <div className="database-pagination"><CatalogPagination {...pagination} /></div>
                <div className="database-sections">
                    {catalogTypes.map(({ type, label, icon, tone }) => {
                        const entries = pagination.entries.filter(card => card.type === type);
                        if (!entries.length) return null;
                        return <section key={type} className={`database-section database-section--${tone}`} aria-label={label}>
                            <h2><span className="database-section__icon">{icon}</span>{label}<small>{String(entries.length).padStart(2, '0')} - Number of Cards</small></h2>
                            <div className="database-card-grid">{entries.map(card => <button
                                key={card.id}
                                type="button"
                                data-sound="select-small"
                                className="database-card"
                                aria-label={`View ${card.name}`}
                                aria-pressed={selectedCard?.id === card.id}
                                onClick={() => setSelectedCard(card)}
                            ><CardDetail card={card} /></button>)}</div>
                        </section>;
                    })}
                    {!filteredCards.length && <div className="database-empty" role="status"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /><strong>No cards found</strong><span>Try a different search or filter.</span></div>}
                </div>
            </main>

            <aside className="database-inspector" aria-label="Card details">
                <div className="database-inspector__heading"><span>CARD INSPECTOR</span><i className="fa-solid fa-diamond" aria-hidden="true" /></div>
                {selectedCard ? <>
                    <div className="database-inspector__card"><CardDetail card={selectedCard} /></div>
                    <div className="database-card-data">
                        <h2><i className="fa-solid fa-database" aria-hidden="true" /> Card data</h2>
                        <dl>
                            <div><dt>Rarity</dt><dd>({rarityCodes[selectedCard.rarity]}) {selectedCard.rarity}</dd></div>
                            <div><dt>Class</dt><dd>{selectedCard.type}</dd></div>
                            {selectedCard.type !== CardType.PAWN && <div><dt>Subtype</dt><dd>{cardSubtype(selectedCard)}</dd></div>}
                            {selectedCard.type === CardType.PAWN && <>
                                <div><dt>Level</dt><dd>{selectedCard.level}</dd></div>
                                <div><dt>Attribute</dt><dd>{selectedCard.attribute || 'N/A'}</dd></div>
                                <div><dt>Type</dt><dd>{selectedCard.pawnType || 'N/A'}</dd></div>
                                {selectedCard.pawnSubtype && <div><dt>Subtype</dt><dd>{selectedCard.pawnSubtype}</dd></div>}
                            </>}
                        </dl>
                    </div>
                </> : <div className="database-inspector__empty"><span><i className="fa-solid fa-crosshairs" aria-hidden="true" /></span></div>}
            </aside>
        </div>
    </div>;
};

export default CardDatabase;
