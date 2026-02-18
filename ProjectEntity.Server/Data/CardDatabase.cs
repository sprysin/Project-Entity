using ProjectEntity.Server.Models;

namespace ProjectEntity.Server.Data;

public static class CardDatabase
{
    public static readonly List<Card> BaseCards = new()
    {
        new Card { Id = "entity_01", Name = "Solstice Sentinel", Type = CardType.Entity, Level = 4, Atk = 140, Def = 110, EffectText = "ON NORMAL SUMMON: Gain 100 LP." },
        new Card { Id = "entity_02", Name = "High King", Type = CardType.Entity, Level = 5, Atk = 170, Def = 50, EffectText = "ON SUMMON: Target 1 face-up monster on the field; it loses 20 ATK." },
        new Card { Id = "entity_03", Name = "Force Fire Sparker", Type = CardType.Entity, Level = 2, Atk = 30, Def = 150, EffectText = "ON NORMAL SUMMON: Deal 10 damage for each set Action/Condition on opponent's field." },
        new Card { Id = "entity_04", Name = "Void Caster", Type = CardType.Entity, Level = 3, Atk = 100, Def = 80, EffectText = "ON SUMMON: Add \"Void Blast\" from your Discard to your hand." },
        new Card { Id = "entity_05", Name = "High Voltage - Charged Dragon", Type = CardType.Entity, Level = 8, Atk = 250, Def = 190, EffectText = "ON FIELD: Discard 1 card; this card gains 10 ATK." },
        new Card { Id = "action_01", Name = "Void Blast", Type = CardType.Action, Level = 0, Atk = 0, Def = 0, EffectText = "Deal 50 damage to your opponent." },
        new Card { Id = "action_02", Name = "Quick recovery", Type = CardType.Action, Level = 0, Atk = 0, Def = 0, EffectText = "If opponent has Entity: Return Lv 3 or lower Entity from Discard to hand, gain 20 LP." },
        new Card { Id = "condition_01", Name = "Reinforcement", Type = CardType.Condition, Level = 0, Atk = 0, Def = 0, EffectText = "Target Entity gains +20 ATK." },
        new Card { Id = "condition_02", Name = "Void Call", Type = CardType.Condition, Level = 0, Atk = 0, Def = 0, EffectText = "Target 1 Set Action/Condition card; send it to the Void." }
    };

    public static List<Card> CreateDeck(string playerId)
    {
        var deck = new List<Card>();
        for (int i = 0; i < 40; i++)
        {
            var baseCard = BaseCards[i % BaseCards.Count];
            var newCard = new Card
            {
                InstanceId = $"{playerId}_{i}_{Guid.NewGuid()}",
                Id = baseCard.Id,
                Name = baseCard.Name,
                Type = baseCard.Type,
                Level = baseCard.Level,
                Atk = baseCard.Atk,
                Def = baseCard.Def,
                EffectText = baseCard.EffectText,
                OwnerId = playerId
            };
            deck.Add(newCard);
        }

        // Fisher-Yates shuffle
        var rng = new Random();
        int n = deck.Count;
        while (n > 1)
        {
            n--;
            int k = rng.Next(n + 1);
            Card value = deck[k];
            deck[k] = deck[n];
            deck[n] = value;
        }

        return deck;
    }
}
