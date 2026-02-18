namespace ProjectEntity.Server.Models;

public class Player
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Lp { get; set; }
    public List<Card> Deck { get; set; } = new();
    public List<Card> Hand { get; set; } = new();
    public List<Card> Discard { get; set; } = new();
    public List<Card> Void { get; set; } = new();
    public PlacedCard?[] EntityZones { get; set; } = new PlacedCard?[5];
    public PlacedCard?[] ActionZones { get; set; } = new PlacedCard?[5];
    public bool NormalSummonUsed { get; set; }
    public bool HiddenSummonUsed { get; set; }
}
