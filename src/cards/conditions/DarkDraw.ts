import { IEffect, GameState, CardContext, EffectResult, Position, Attribute } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onActivate: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));
        const activePlayer = newState.players[state.activePlayerIndex];

        if (activePlayer.lp <= 200) {
            return {
                newState,
                log: "DARK DRAW: Not enough LP to activate."
            };
        }

        // Pay cost
        activePlayer.lp -= 200;

        // Count face-up DARK monsters on the field
        let darkCount = 0;
        newState.players.forEach((player: any) => {
            player.entityZones.forEach((zone: any) => {
                if (zone && zone.position !== Position.HIDDEN && zone.card.attribute === Attribute.DARK) {
                    darkCount++;
                }
            });
        });

        // Draw cards
        const drawnCards = activePlayer.deck.splice(0, darkCount);
        activePlayer.hand.push(...drawnCards);

        return {
            newState,
            log: `DARK DRAW: Paid 200 LP. Drew ${drawnCards.length} card(s).`
        };
    },
    canActivate: (state: GameState, context: CardContext): boolean => {
        return state.players[context.playerIndex].lp > 200;
    }
};

cardRegistry.register('condition_03', effect);
