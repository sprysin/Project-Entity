import { IEffect } from '../../types';

class CardRegistry {
    private static instance: CardRegistry;
    private effects: Map<string, IEffect> = new Map();

    private constructor() { }

    public static getInstance(): CardRegistry {
        if (!CardRegistry.instance) {
            CardRegistry.instance = new CardRegistry();
        }
        return CardRegistry.instance;
    }

    /**
     * Register a card's effect logic.
     * @param id The unique card ID (e.g., 'pawn_01')
     * @param effect The effect implementation
     */
    public register(id: string, effect: IEffect): void {
        if (this.effects.has(id)) {
            console.warn(`CardRegistry: Overwriting effect for card ${id}`);
        }
        this.effects.set(id, effect);
        // console.log(`CardRegistry: Registered logic for ${id}`);
    }

    /**
     * Retrieve a card's effect logic.
     * @param id The unique card ID
     */
    public getEffect(id: string): IEffect | undefined {
        return this.effects.get(id);
    }
}

export const cardRegistry = CardRegistry.getInstance();
