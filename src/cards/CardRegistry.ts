import { IEffect, Card, CardType, ActionSubtype, CARD_RARITIES } from '../types';

export type CardDefinition = Omit<Card, 'instanceId' | 'ownerId' | 'tributedByAction' | 'fieldAtkReduction'>;

interface RegisteredCard {
    cardData: CardDefinition;
    effect: IEffect;
}

export type CardModule = RegisteredCard[];

export class CardRegistry {
    private cards: Map<string, RegisteredCard> = new Map();

    public register(cardData: CardDefinition, effect: IEffect): void {
        const id = cardData.id;
        if (this.cards.has(id)) {
            throw new Error(`Duplicate card ID: ${id}`);
        }
        if (!id.trim() || !cardData.name.trim() || !Object.values(CardType).includes(cardData.type)
            || !CARD_RARITIES.includes(cardData.rarity)
            || !Number.isInteger(cardData.level) || cardData.level < 0 || cardData.level > 10
            || !Number.isFinite(cardData.atk) || !Number.isFinite(cardData.def)
            || cardData.isAttached && cardData.isLingering
            || cardData.actionSubtype !== undefined && (cardData.type !== CardType.ACTION || !Object.values(ActionSubtype).includes(cardData.actionSubtype) || cardData.isAttached || cardData.isLingering)
            || cardData.type === CardType.PAWN && (cardData.isAttached || cardData.isLingering)
            || cardData.type !== CardType.PAWN && (cardData.level !== 0 || cardData.atk !== 0 || cardData.def !== 0)) {
            throw new Error(`Invalid card definition: ${id}`);
        }
        this.cards.set(id, { cardData: Object.freeze({ ...cardData }), effect });
    }

    public get size(): number { return this.cards.size; }

    public getEffect(id: string): IEffect | undefined {
        return this.cards.get(id)?.effect;
    }

    public getCard(id: string): CardDefinition | undefined {
        return this.cards.get(id)?.cardData;
    }

    public getAllCards(): CardDefinition[] {
        return Array.from(this.cards.values()).map(r => r.cardData);
    }
}

export const cardRegistry = new CardRegistry();
type Metadata = Pick<Card, 'type' | 'isAttached' | 'isLingering' | 'actionSubtype' | 'name' | 'effectText' | 'attribute' | 'pawnType' | 'pawnSubtype'>;
type CardSubtype = 'Normal' | 'Lingering' | 'Attach' | ActionSubtype;

export function cardSubtype(card: Pick<Metadata, 'type' | 'isAttached' | 'isLingering' | 'actionSubtype'>): CardSubtype | null {
    return card.type === CardType.PAWN ? null : card.actionSubtype ?? (card.isAttached ? 'Attach' : card.isLingering ? 'Lingering' : 'Normal');
}

export function cardTypeLabel(card: Pick<Metadata, 'type' | 'isAttached' | 'isLingering' | 'actionSubtype' | 'pawnSubtype'>): string {
    return card.type === CardType.PAWN ? `${card.pawnSubtype ? `${card.pawnSubtype}/` : ''}Pawn` : `${cardSubtype(card)} ${card.type === CardType.ACTION ? 'Action' : 'Condition'}`;
}

export function matchesCardCatalog(card: Metadata, query: string): boolean {
    return `${card.name} ${card.effectText} ${cardTypeLabel(card)} ${card.attribute ?? ''} ${card.pawnType ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
}

/** Includes nested set folders without manually maintaining imports. */
export function registerCardModules(modules: Record<string, { default: CardModule }>): void {
    for (const [path, module] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
        if (!Array.isArray(module.default) || !module.default.length) throw new Error(`Invalid card module: ${path}`);
        for (const { cardData, effect } of module.default) cardRegistry.register(cardData, effect);
    }
}
