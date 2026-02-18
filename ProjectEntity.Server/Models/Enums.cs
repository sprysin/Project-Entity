namespace ProjectEntity.Server.Models;

public enum CardType
{
    Entity,
    Action,
    Condition
}

public enum Phase
{
    Draw,
    Standby,
    Main1,
    Battle,
    Main2,
    End
}

public enum Position
{
    Attack,
    Defense,
    Hidden
}
