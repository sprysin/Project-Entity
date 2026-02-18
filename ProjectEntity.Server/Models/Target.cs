namespace ProjectEntity.Server.Models;

public class Target
{
    public int PlayerIndex { get; set; }
    public string Type { get; set; } = string.Empty; // "entity" or "action"
    public int Index { get; set; }
}
