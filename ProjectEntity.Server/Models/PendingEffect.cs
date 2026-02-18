namespace ProjectEntity.Server.Models;

public class PendingEffect
{
    public string Type { get; set; } = "RESET_ATK";
    public string TargetInstanceId { get; set; } = string.Empty;
    public int Value { get; set; }
    public int DueTurn { get; set; }
}
