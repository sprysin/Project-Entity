import { IEffect, GameState, CardContext, EffectResult, CardType, Card } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onActivate: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));
        const qrPlayer = newState.players[state.activePlayerIndex];

        // Check for target first if not provided (though activation condition should handle availability)
        const qrOppIdx = (state.activePlayerIndex + 1) % 2;
        const qrOpp = newState.players[qrOppIdx];
        const hasEntity = qrOpp.entityZones.some((z: any) => z !== null);

        if (!hasEntity) {
            return { newState, log: "QUICK RECOVERY: Opponent controls no Entities." };
        }

        if (context.discardIndex === undefined) {
            return {
                newState,
                log: "Select a card to recover.",
                requireDiscardSelection: {
                    playerIndex: state.activePlayerIndex,
                    filter: (c: Card) => c.type === CardType.ENTITY && c.level <= 3,
                    title: "Select Level 3 or Lower Entity"
                }
            };
        }

        const recoveredEntity = qrPlayer.discard[context.discardIndex];
        if (recoveredEntity && recoveredEntity.type === CardType.ENTITY && recoveredEntity.level <= 3) {
            const newDiscard = [...qrPlayer.discard];
            newDiscard.splice(context.discardIndex, 1);

            newState.players[state.activePlayerIndex] = {
                ...qrPlayer,
                hand: [...qrPlayer.hand, recoveredEntity],
                discard: newDiscard,
                lp: qrPlayer.lp + 20
            };
            return {
                newState,
                log: `QUICK RECOVERY: Returned ${recoveredEntity.name} & +20 LP.`
            };
        } else {
            return { newState, log: "QUICK RECOVERY: Invalid selection." };
        }
    },
    canActivate: (state: GameState, context: CardContext): boolean => {
        const otherPlayerIndex = (context.playerIndex + 1) % 2;
        const oppHasEntity = state.players[otherPlayerIndex].entityZones.some(z => z !== null);
        const hasLowLevelInDiscard = state.players[context.playerIndex].discard.some(c => c.type === CardType.ENTITY && c.level <= 3);
        return oppHasEntity && hasLowLevelInDiscard;
    }
};

cardRegistry.register('action_02', effect);
