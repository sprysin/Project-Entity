namespace ProjectEntity.Server.Models;

public class Card
{
    public string InstanceId { get; set; } = Guid.NewGuid().ToString();
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public CardType Type { get; set; }
    public int Level { get; set; }
    public int Atk { get; set; }
    public int Def { get; set; }
    public string EffectText { get; set; } = string.Empty;
    public string OwnerId { get; set; } = string.Empty;
}
