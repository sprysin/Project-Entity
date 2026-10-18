import { Attribute, CardType, PawnSubtype, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { matchesCardName, setPawnPosition } from '../../../game/cardHelpers';

const materials = ['Arc Angel - Cosine', 'Arc Angel - Sine'];

export default [{
    cardData: {
        id: 'P_Arc_Angel_Tangent',
        name: 'Arc Angel - Tangent',
        type: CardType.PAWN,
        pawnSubtype: PawnSubtype.MERGE,
        mergeMaterials: materials,
        attribute: Attribute.LIGHT,
        pawnType: PawnType.ANGEL,
        rarity: 'Legendary',
        level: 3,
        atk: 180,
        def: 180,
        effectText: 'ON SUMMON: You can switch the battle positions of all Pawns on the field (except this card), then this card gains 30 ATK for each card switched. If this card is destroyed, special summon 1 "Arc Angel - Cosine" and 1 "Arc Angel - Sine" from your deck.'
    },
    effect: {
        mandatoryReactions: ['destroyed'],
        onSummon: buildEffect([(state, context) => {
            let switched = 0;
            for (const player of state.players) for (const zone of player.pawnZones) {
                if (!zone || zone.card.instanceId === context.card.instanceId) continue;
                const position = zone.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK;
                setPawnPosition(zone, position);
                if (zone.position === position) switched++;
            }
            return Effect.ModifySelfStats(switched * 30, 0)(state, context);
        }]),
        onDestroyed: buildEffect([Effect.SpecialSummonDeckCards(materials.map(name => card => matchesCardName(card, name)))])
    }
}] satisfies CardModule;
