namespace ProjectEntity.Server.Models;

public class SummonRequest
{
    public required string CardId { get; set; }
    public required string Mode { get; set; } // "normal", "hidden", "tribute"
    public List<int>? TributeIndices { get; set; }
}

public class SetActionRequest
{
    public required string CardId { get; set; }
}

public class AttackRequest
{
    public int AttackerIndex { get; set; }
    public required string TargetIndexStr { get; set; } // "0", "1", "direct"
}

public class ActivationRequest
{
    // For Hand activation:
    public string? CardId { get; set; }
    // For Field activation:
    public int? Index { get; set; }
    public string? Type { get; set; } // "entity", "action"

    // Shared:
    public string Location { get; set; } = "hand"; // "hand", "field"

    // Complex params:
    public Target? Target { get; set; }
    public int? DiscardIndex { get; set; }
    public int? HandIndex { get; set; }
}
