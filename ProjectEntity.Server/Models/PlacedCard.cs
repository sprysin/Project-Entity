namespace ProjectEntity.Server.Models;

public class PlacedCard
{
    public Card Card { get; set; } = new();
    public Position Position { get; set; }
    public bool HasAttacked { get; set; }
    public bool HasChangedPosition { get; set; }
    public int SummonedTurn { get; set; }
    public bool IsSetTurn { get; set; }
}
