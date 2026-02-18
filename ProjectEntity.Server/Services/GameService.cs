using ProjectEntity.Server.Data;
using ProjectEntity.Server.Models;

namespace ProjectEntity.Server.Services;

public class GameService
{
    private GameState _gameState = new();
    private readonly CardEffectService _cardEffectService;

    public GameService(CardEffectService cardEffectService)
    {
        _cardEffectService = cardEffectService;
        InitializeGame();
    }

    public GameState GetState() => _gameState;

    public void InitializeGame()
    {
        var p1Deck = CardDatabase.CreateDeck("player1");
        var p2Deck = CardDatabase.CreateDeck("player2");

        _gameState = new GameState
        {
            Players = new[]
            {
                new Player
                {
                    Id = "player1", Name = "Player 1", Lp = 800,
                    Deck = p1Deck.Skip(5).ToList(),
                    Hand = p1Deck.Take(5).ToList()
                },
                new Player
                {
                    Id = "player2", Name = "Player 2", Lp = 800,
                    Deck = p2Deck.Skip(5).ToList(),
                    Hand = p2Deck.Take(5).ToList()
                }
            },
            ActivePlayerIndex = 0,
            CurrentPhase = Phase.Draw,
            TurnNumber = 1,
            Log = new List<string> { "Duel initialized." }
        };
    }

    public EffectResult NextPhase()
    {
        if (_gameState.Winner != null) return new EffectResult { NewState = _gameState };

        var currentPhase = _gameState.CurrentPhase;
        var nextPhase = currentPhase;

        if (_gameState.TurnNumber == 1 && currentPhase == Phase.Main1)
        {
            nextPhase = Phase.End;
        }
        else
        {
            switch (currentPhase)
            {
                case Phase.Draw: nextPhase = Phase.Standby; break;
                case Phase.Standby: nextPhase = Phase.Main1; break;
                case Phase.Main1: nextPhase = Phase.Battle; break;
                case Phase.Battle: nextPhase = Phase.Main2; break;
                case Phase.Main2: nextPhase = Phase.End; break;
                case Phase.End:
                    nextPhase = Phase.Draw;
                    _gameState.ActivePlayerIndex = (_gameState.ActivePlayerIndex + 1) % 2;
                    _gameState.TurnNumber++;
                    break;
            }
        }

        // Phase Transition Logic
        if (nextPhase == Phase.Draw)
        {
            // Reset Flags
            var p = _gameState.Players[_gameState.ActivePlayerIndex];
            p.NormalSummonUsed = false;
            p.HiddenSummonUsed = false;
            foreach (var z in p.EntityZones) if (z != null) { z.HasAttacked = false; z.HasChangedPosition = false; }

            // Draw Card (Simulating "Draw to 5" roughly, but standard draw is +1 usually? 
            // README says "Draw to 5". GameView code says:
            // "shouldStop = (p.hand.length >= targetHandSize && drawCount >= minDraw) || p.deck.length === 0;"
            // It draws until 5 cards in hand, at least 1.
            int drawCount = 0;
            while ((p.Hand.Count < 5 && p.Deck.Count > 0) || (drawCount < 1 && p.Deck.Count > 0))
            {
                var card = p.Deck[0];
                p.Deck.RemoveAt(0);
                p.Hand.Add(card);
                drawCount++;
            }
            _gameState.Log.Insert(0, $"Player {_gameState.ActivePlayerIndex + 1} Phase: DRAW (+{drawCount} cards).");
        }
        else if (nextPhase == Phase.End)
        {
            // End Phase Effects (Reset ATK)
            var effectsToResolve = _gameState.PendingEffects.Where(e => e.DueTurn == _gameState.TurnNumber && e.Type == "RESET_ATK").ToList();
            var remaining = _gameState.PendingEffects.Where(e => !(e.DueTurn == _gameState.TurnNumber && e.Type == "RESET_ATK")).ToList();

            foreach (var effect in effectsToResolve)
            {
                foreach (var p in _gameState.Players)
                {
                    foreach (var z in p.EntityZones)
                    {
                        if (z != null && z.Card.InstanceId == effect.TargetInstanceId)
                        {
                            z.Card.Atk = effect.Value;
                        }
                    }
                }
            }
            _gameState.PendingEffects = remaining;
            _gameState.Log.Insert(0, $"Player {_gameState.ActivePlayerIndex + 1} Phase: END.");
        }
        else
        {
            _gameState.Log.Insert(0, $"Phase Change: {nextPhase}");
        }

        _gameState.CurrentPhase = nextPhase;
        return new EffectResult { NewState = _gameState };
    }

    public EffectResult Summon(string instanceId, string mode, List<int>? tributeIndices = null)
    {
        // mode: "normal", "hidden", "tribute" (handled implicitly if card level is high)
        // Frontend logic passed "tribute" explicitly.

        var pIdx = _gameState.ActivePlayerIndex;
        var p = _gameState.Players[pIdx];
        var card = p.Hand.FirstOrDefault(c => c.InstanceId == instanceId);

        if (card == null) return ErrorResult("Card not in hand.");
        if (_gameState.CurrentPhase != Phase.Main1 && _gameState.CurrentPhase != Phase.Main2) return ErrorResult("Invalid Phase.");

        // Tribute Logic
        if (card.Level >= 5)
        {
            int required = card.Level <= 7 ? 1 : 2;
            if (tributeIndices == null || tributeIndices.Count != required)
                return ErrorResult($"Level {card.Level} requires {required} tributes.");

            // Process Tributes
            foreach (var idx in tributeIndices)
            {
                var tribute = p.EntityZones[idx];
                if (tribute != null)
                {
                    p.Discard.Add(tribute.Card);
                    p.EntityZones[idx] = null;
                }
            }
        }
        else
        {
            // Normal/Set Limits
            if (mode == "normal" && p.NormalSummonUsed) return ErrorResult("Normal Summon limit reached.");
            if (mode == "hidden" && p.HiddenSummonUsed) return ErrorResult("Hidden Set limit reached.");
        }

        int slot = Array.IndexOf(p.EntityZones, null);
        if (slot == -1) return ErrorResult("No Entity Zone available.");

        // Summon
        p.Hand.Remove(card);
        p.EntityZones[slot] = new PlacedCard
        {
            Card = card,
            Position = mode == "hidden" ? Position.Hidden : Position.Attack,
            HasAttacked = false,
            HasChangedPosition = false,
            SummonedTurn = _gameState.TurnNumber,
            IsSetTurn = mode == "hidden"
        };

        if (card.Level <= 4)
        {
            if (mode == "normal") p.NormalSummonUsed = true;
            if (mode == "hidden") p.HiddenSummonUsed = true;
        }

        if (mode != "hidden")
        {
            // Trigger On Summon Effects
            // Note: High King requires target. Void Caster optional.
            // For simple automated effects (Solstice Sentinel), resolve immediately.
            // For complex ones, we might need to return a "Requirement".
            // We reuse CardEffectService.
            return _cardEffectService.ApplyCardEffect(_gameState, card);
        }

        return new EffectResult { NewState = _gameState, Log = $"Summoned {card.Name}." };
    }

    public EffectResult ActivateCard(string instanceId, string location, int index, Target? target = null, int? discardIndex = null, int? handIndex = null)
    {
        // location: "hand", "field"
        var pIdx = _gameState.ActivePlayerIndex;
        var p = _gameState.Players[pIdx];
        Card? card = null;

        if (location == "hand")
        {
            card = p.Hand.FirstOrDefault(c => c.InstanceId == instanceId);
            if (card == null) return ErrorResult("Card not in hand.");

            // Move to field/discard first?
            // GameView logic:
            // Action: if activate -> discard & resolve. if set -> actionZone.
            // Entity (Effect): Hand effects? Charged Dragon is ON FIELD.
            // So Hand activation is mostly Actions.

            if (card.Type == CardType.Action)
            {
                if (!_cardEffectService.CheckActivationConditions(_gameState, card, pIdx)) return ErrorResult("Conditions not met.");

                p.Hand.Remove(card);
                p.Discard.Add(card);
                return _cardEffectService.ApplyCardEffect(_gameState, card, target, discardIndex, handIndex);
            }
            else if (card.Type == CardType.Condition) // Only Set allowed usually? Logic says set is separate.
            {
                // activate condition from hand? Usually via Set.
                return ErrorResult("Conditions must be Set first.");
            }
        }
        else if (location == "field") // Spell/Trap/Entity effect on field
        {
            // We need to find the card at 'index' to verify instanceId text?
            // Or just use index.
            // We'll assume field activation is for "Entity Index X" or "Action Index X".
            // Let's assume 'instanceId' is passed for validation, but we use index.
            // Actually 'ActivateOnField' in Typescript used (type, index).
            // Since 'card' is needed for ApplyCardEffect, we fetch it.
        }

        // This method signature is getting complex.
        // Let's simplify: ActivateActionFromHand and ActivateOnField.
        return ErrorResult("Use specific methods.");
    }

    public EffectResult SetCard(string instanceId)
    {
        var pIdx = _gameState.ActivePlayerIndex;
        var p = _gameState.Players[pIdx];
        var card = p.Hand.FirstOrDefault(c => c.InstanceId == instanceId);
        if (card == null) return ErrorResult("Card not found.");

        if (card.Type == CardType.Entity)
        {
            // handled by Summon("hidden")
            return Summon(instanceId, "hidden");
        }

        int slot = Array.IndexOf(p.ActionZones, null);
        if (slot == -1) return ErrorResult("No Action Zone available.");

        p.Hand.Remove(card);
        p.ActionZones[slot] = new PlacedCard
        {
            Card = card,
            Position = Position.Hidden,
            HasAttacked = false,
            HasChangedPosition = false,
            SummonedTurn = _gameState.TurnNumber,
            IsSetTurn = true
        };
        return new EffectResult { NewState = _gameState, Log = $"Set {card.Name}." };
    }

    public EffectResult ActivateOnField(int index, string type, Target? target = null, int? discardIndex = null, int? handIndex = null)
    {
        var pIdx = _gameState.ActivePlayerIndex;
        var p = _gameState.Players[pIdx];
        var zone = type == "entity" ? p.EntityZones : p.ActionZones;
        var placed = zone[index];
        if (placed == null) return ErrorResult("No card in slot.");

        if (placed.Card.Type == CardType.Condition && _gameState.TurnNumber <= placed.SummonedTurn)
            return ErrorResult("Cannot activate Condition on set turn.");

        if (!_cardEffectService.CheckActivationConditions(_gameState, placed.Card, pIdx))
            return ErrorResult("Condition not met.");

        // FLIP
        if (placed.Position == Position.Hidden)
        {
            placed.Position = Position.Attack; // Face up
        }

        var result = _cardEffectService.ApplyCardEffect(_gameState, placed.Card, target, discardIndex, handIndex);

        // Auto-discard Actions/Conditions
        if (type != "entity")
        {
            // Ideally we wait for effect resolution? 
            // In TS it was setTimeout. Here we just move it.
            // But if it requires target and returns 'RequireTarget', we shouldn't discard yet!
            if (result.RequireTarget == null && result.RequireDiscardSelection == null && result.RequireHandSelection == null)
            {
                p.Discard.Add(placed.Card);
                p.ActionZones[index] = null;
            }
        }

        return result;
    }

    public EffectResult ActivateActionFromHand(string instanceId, Target? target = null, int? discardIndex = null)
    {
        var pIdx = _gameState.ActivePlayerIndex;
        var p = _gameState.Players[pIdx];
        var card = p.Hand.FirstOrDefault(c => c.InstanceId == instanceId);
        if (card == null) return ErrorResult("Card not found.");

        if (!_cardEffectService.CheckActivationConditions(_gameState, card, pIdx))
            return ErrorResult("Conditions not met.");

        // Remove from hand, add to discard (activates from discard essentially?)
        // TS logic: p.discard = [...p.discard, card];
        p.Hand.Remove(card);
        p.Discard.Add(card);

        var result = _cardEffectService.ApplyCardEffect(_gameState, card, target, discardIndex);
        return result;
    }

    public EffectResult Attack(int attackerIndex, string targetIndexStr)
    {
        var pIdx = _gameState.ActivePlayerIndex;
        var oppIdx = (pIdx + 1) % 2;
        var p = _gameState.Players[pIdx];
        var opp = _gameState.Players[oppIdx];

        var attacker = p.EntityZones[attackerIndex];
        if (attacker == null) return ErrorResult("Attacker not found.");
        if (attacker.HasAttacked) return ErrorResult("Already attacked.");
        if (attacker.Position == Position.Defense) return ErrorResult("Cannot attack in Defense.");

        attacker.HasAttacked = true;

        if (targetIndexStr == "direct")
        {
            // Check if opp has monsters? Rules say "if has monsters, cannot direct attack"?
            // TS logic: "if (hasMonsters) handleAttack(idx, i); else handleAttack(idx, 'direct');"
            // The Server should validate.
            if (opp.EntityZones.Any(z => z != null)) return ErrorResult("Cannot attack direct while opponent has monsters.");

            opp.Lp -= attacker.Card.Atk;
            _gameState.Log.Insert(0, $"Direct Attack: -{attacker.Card.Atk} LP.");
        }
        else
        {
            if (!int.TryParse(targetIndexStr, out int defIdx)) return ErrorResult("Invalid target index.");
            var defender = opp.EntityZones[defIdx];
            if (defender == null) return ErrorResult("Defender not found.");

            // Combat Logic
            if (defender.Position == Position.Hidden)
            {
                defender.Position = Position.Defense; // Flip
                _gameState.Log.Insert(0, $"{defender.Card.Name} flipped.");
            }

            if (defender.Position == Position.Attack)
            {
                int diff = attacker.Card.Atk - defender.Card.Atk;
                if (diff > 0)
                {
                    opp.Lp -= diff;
                    opp.Discard.Add(defender.Card);
                    opp.EntityZones[defIdx] = null;
                    _gameState.Log.Insert(0, $"Attack Success: {defender.Card.Name} destroyed. -{diff} LP.");
                }
                else if (diff < 0)
                {
                    p.Lp += diff; // diff is negative
                    p.Discard.Add(attacker.Card);
                    p.EntityZones[attackerIndex] = null;
                    _gameState.Log.Insert(0, $"Attack Failed: {attacker.Card.Name} destroyed. Recoil {diff}.");
                }
                else
                {
                    p.Discard.Add(attacker.Card);
                    opp.Discard.Add(defender.Card);
                    p.EntityZones[attackerIndex] = null;
                    opp.EntityZones[defIdx] = null;
                    _gameState.Log.Insert(0, "Mutual Destruction.");
                }
            }
            else // DEFENSE
            {
                if (attacker.Card.Atk > defender.Card.Def)
                {
                    opp.Discard.Add(defender.Card);
                    opp.EntityZones[defIdx] = null;
                    _gameState.Log.Insert(0, $"Defense Crushed: {defender.Card.Name} destroyed.");
                }
                else if (attacker.Card.Atk < defender.Card.Def)
                {
                    int recoil = defender.Card.Def - attacker.Card.Atk;
                    p.Lp -= recoil;
                    _gameState.Log.Insert(0, $"Defense Held: Recoil -{recoil} LP.");
                }
                else
                {
                    _gameState.Log.Insert(0, "Stalemate.");
                }
            }
        }

        CheckWinner();
        return new EffectResult { NewState = _gameState };
    }

    private void CheckWinner()
    {
        if (_gameState.Players[0].Lp <= 0) _gameState.Winner = _gameState.Players[1].Name;
        else if (_gameState.Players[1].Lp <= 0) _gameState.Winner = _gameState.Players[0].Name;
    }

    private EffectResult ErrorResult(string msg)
    {
        return new EffectResult { NewState = _gameState, Log = $"ERROR: {msg}" };
    }
}
