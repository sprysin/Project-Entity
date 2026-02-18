namespace ProjectEntity.Server.Models;

public class GameState
{
    public Player[] Players { get; set; } = new Player[2];
    public int ActivePlayerIndex { get; set; }
    public Phase CurrentPhase { get; set; }
    public int TurnNumber { get; set; }
    public List<string> Log { get; set; } = new();
    public string? Winner { get; set; }
    public List<PendingEffect> PendingEffects { get; set; } = new();
}
