namespace ProjectEntity.Server.Models;

public class EffectResult
{
    public required GameState NewState { get; set; }
    public string Log { get; set; } = string.Empty;
    public string? RequireTarget { get; set; } // "entity", "action", "any"
    public SelectionRequirement? RequireDiscardSelection { get; set; }
    public SelectionRequirement? RequireHandSelection { get; set; }
}

public class SelectionRequirement
{
    public int PlayerIndex { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FilterCode { get; set; } = string.Empty;
}
