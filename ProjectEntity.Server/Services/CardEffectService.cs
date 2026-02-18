using ProjectEntity.Server.Models;

namespace ProjectEntity.Server.Services;

public class CardEffectService
{
    public bool CheckActivationConditions(GameState state, Card card, int playerIndex)
    {
        int otherPlayerIndex = (playerIndex + 1) % 2;
        var player = state.Players[playerIndex];
        var opponent = state.Players[otherPlayerIndex];

        switch (card.Id)
        {
            case "action_02": // Quick recovery
                bool oppHasEntity = opponent.EntityZones.Any(z => z != null);
                bool hasLowLevelInDiscard = player.Discard.Any(c => c.Type == CardType.Entity && c.Level <= 3);
                return oppHasEntity && hasLowLevelInDiscard;

            case "entity_04": // Void Caster
                return player.Discard.Any(c => c.Id == "action_01");

            case "entity_02": // High King
                return state.Players.Any(p => p.EntityZones.Any(z => z != null && z.Position != Position.Hidden));

            case "entity_05": // Charged Dragon
                return player.Hand.Count > 0;

            case "condition_01": // Reinforcement
                return state.Players.Any(p => p.EntityZones.Any(z => z != null && z.Position != Position.Hidden));

            case "condition_02": // Void Call
                return state.Players.Any(p => p.ActionZones.Any(z => z != null && z.Position == Position.Hidden));

            default:
                return true;
        }
    }

    public EffectResult ApplyCardEffect(GameState state, Card card, Target? target = null, int? discardIndex = null, int? handIndex = null)
    {
        // Note: activePlayerIndex might not be the one activating (e.g. trap card), 
        // but current logic uses state.ActivePlayerIndex. 
        // We should double check if 'card' owner is needed, but sticking to port for now.
        // Actually, 'applyCardEffect' TS used state.activePlayerIndex heavily.

        var result = new EffectResult { NewState = state };
        var activePIdx = state.ActivePlayerIndex;
        var player = state.Players[activePIdx];

        switch (card.Id)
        {
            case "entity_01": // Solstice Sentinel
                player.Lp += 100;
                result.Log = "SOLSTICE SENTINEL: +100 LP.";
                break;

            case "entity_02": // High King
                if (target == null)
                {
                    result.RequireTarget = "entity";
                    result.Log = "High King: Target an Entity.";
                    return result;
                }
                var tP = state.Players[target.PlayerIndex];
                var tE = tP.EntityZones[target.Index];
                if (tE != null && tE.Position != Position.Hidden)
                {
                    tE.Card.Atk = Math.Max(0, tE.Card.Atk - 20);
                    result.Log = $"High King: {tE.Card.Name} loses 20 ATK.";
                }
                else
                {
                    result.RequireTarget = "entity";
                    result.Log = "High King: Invalid target.";
                }
                break;

            case "entity_03": // Force Fire Sparker
                var sparkerOppIdx = (activePIdx + 1) % 2;
                var sparkerOpp = state.Players[sparkerOppIdx];
                int setCardCount = sparkerOpp.ActionZones.Count(z => z != null && z.Position == Position.Hidden);
                int damage = setCardCount * 10;
                if (damage > 0)
                {
                    sparkerOpp.Lp -= damage;
                    result.Log = $"FORCE FIRE SPARKER: {damage} damage dealt ({setCardCount} set cards).";
                }
                else
                {
                    result.Log = "FORCE FIRE SPARKER: No set cards found. 0 Damage.";
                }
                break;

            case "entity_04": // Void Caster
                var vcIndex = player.Discard.FindIndex(c => c.Id == "action_01");
                if (vcIndex != -1)
                {
                    var recovered = player.Discard[vcIndex];
                    player.Discard.RemoveAt(vcIndex);
                    player.Hand.Add(recovered);
                    result.Log = "VOID CASTER: Retrieved 'Void Blast' from Discard.";
                }
                else
                {
                    result.Log = "VOID CASTER: 'Void Blast' not found in Discard.";
                }
                break;

            case "entity_05": // Charged Dragon
                if (handIndex == null)
                {
                    result.RequireHandSelection = new SelectionRequirement
                    {
                        PlayerIndex = activePIdx,
                        Title = "Discard Cost: Select 1 Card"
                    };
                    result.Log = "Select a card to discard.";
                    return result;
                }

                // Logic assumes player.Hand[handIndex] exists
                if (handIndex < player.Hand.Count)
                {
                    var discarded = player.Hand[handIndex.Value];
                    player.Hand.RemoveAt(handIndex.Value);
                    player.Discard.Add(discarded);

                    var dragonZone = player.EntityZones.FirstOrDefault(z => z != null && z.Card.InstanceId == card.InstanceId);
                    if (dragonZone != null)
                    {
                        dragonZone.Card.Atk += 10;
                        state.PendingEffects.Add(new PendingEffect
                        {
                            Type = "RESET_ATK",
                            TargetInstanceId = dragonZone.Card.InstanceId,
                            Value = 250, // Hardcoded Base ATK for Dragon
                            DueTurn = state.TurnNumber
                        });
                        result.Log = $"CHARGED DRAGON: Discarded {discarded.Name}. ATK increased to {dragonZone.Card.Atk} (Resets During End Phase).";
                    }
                    else
                    {
                        result.Log = "CHARGED DRAGON: Discarded for cost, but Entity not found on field.";
                    }
                }
                break;

            case "action_01": // Void Blast
                var vbOppIdx = (activePIdx + 1) % 2;
                state.Players[vbOppIdx].Lp -= 50;
                result.Log = "VOID BLAST: 50 damage dealt.";
                break;

            case "action_02": // Quick Recovery
                var qrOppIdx = (activePIdx + 1) % 2;
                var qrOpp = state.Players[qrOppIdx];
                if (qrOpp.EntityZones.Any(z => z != null))
                {
                    if (discardIndex == null)
                    {
                        result.RequireDiscardSelection = new SelectionRequirement
                        {
                            PlayerIndex = activePIdx,
                            FilterCode = "ENTITY_LOW_LEVEL", // Custom code for filter
                            Title = "Select Level 3 or Lower Entity"
                        };
                        result.Log = "Select a card to recover.";
                        return result;
                    }

                    if (discardIndex < player.Discard.Count)
                    {
                        var recovered = player.Discard[discardIndex.Value];
                        if (recovered.Type == CardType.Entity && recovered.Level <= 3)
                        {
                            player.Discard.RemoveAt(discardIndex.Value);
                            player.Hand.Add(recovered);
                            player.Lp += 20;
                            result.Log = $"QUICK RECOVERY: Returned {recovered.Name} & +20 LP.";
                        }
                        else
                        {
                            result.Log = "QUICK RECOVERY: Invalid selection.";
                        }
                    }
                }
                else
                {
                    result.Log = "QUICK RECOVERY: Opponent controls no Entities.";
                }
                break;

            case "condition_01": // Reinforcement
                if (target == null)
                {
                    result.RequireTarget = "entity";
                    result.Log = "REINFORCEMENT: Target an Entity.";
                    return result;
                }
                var reP = state.Players[target.PlayerIndex];
                var reE = reP.EntityZones[target.Index];
                if (reE != null && reE.Position != Position.Hidden)
                {
                    reE.Card.Atk += 20;
                    result.Log = $"REINFORCEMENT: {reE.Card.Name} gains 20 ATK.";
                }
                else
                {
                    result.RequireTarget = "entity";
                    result.Log = "REINFORCEMENT: Invalid target.";
                }
                break;

            case "condition_02": // Void Call
                if (target == null)
                {
                    result.RequireTarget = "action";
                    result.Log = "VOID CALL: Target a set Action/Condition.";
                    return result;
                }
                var vcP = state.Players[target.PlayerIndex];
                var vcC = vcP.ActionZones[target.Index];
                if (vcC != null && vcC.Position == Position.Hidden)
                {
                    vcP.Void.Add(vcC.Card);
                    vcP.ActionZones[target.Index] = null;
                    result.Log = "VOID CALL: Card banished to Void.";
                }
                else
                {
                    result.RequireTarget = "action";
                    result.Log = "VOID CALL: Invalid target (Must be Set Action/Condition Card).";
                }
                break;

            default:
                result.Log = $"{card.Name}: Effect resolved.";
                break;
        }

        return result;
    }
}


