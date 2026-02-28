import { IEffect, Card, CardType, Attribute, PawnType, Position } from '../../types';

export type CardDefinition = Omit<Card, 'instanceId' | 'ownerId'>;

interface RegisteredCard {
    cardData: CardDefinition;
    effect: IEffect;
}

class CardRegistry {
    private static instance: CardRegistry;
    private cards: Map<string, RegisteredCard> = new Map();

    private constructor() { }

    public static getInstance(): CardRegistry {
        if (!CardRegistry.instance) {
            CardRegistry.instance = new CardRegistry();
        }
        return CardRegistry.instance;
    }

    /**
     * Register a card's data and its effect logic.
     * @param cardData The card definition (stats, type, text, etc.)
     * @param effect The effect implementation
     */
    public register(cardData: CardDefinition, effect: IEffect): void {
        const id = cardData.id;
        if (this.cards.has(id)) {
            console.warn(`CardRegistry: Overwriting effect for card ${id}`);
        }
        this.cards.set(id, { cardData, effect });
        // console.log(`CardRegistry: Registered logic for ${id}`);
    }

    /**
     * Retrieve a card's effect logic.
     * @param id The unique card ID
     */
    public getEffect(id: string): IEffect | undefined {
        return this.cards.get(id)?.effect;
    }

    /**
     * Retrieve all registered cards' base data.
     * Useful for building decks from the entire available card pool.
     */
    public getAllCards(): CardDefinition[] {
        return Array.from(this.cards.values()).map(r => r.cardData);
    }
}

export const cardRegistry = CardRegistry.getInstance();
