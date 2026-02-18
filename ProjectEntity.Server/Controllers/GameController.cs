using Microsoft.AspNetCore.Mvc;
using ProjectEntity.Server.Models;
using ProjectEntity.Server.Services;

namespace ProjectEntity.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameController : ControllerBase
{
    private readonly GameService _gameService;

    public GameController(GameService gameService)
    {
        _gameService = gameService;
    }

    [HttpGet]
    public ActionResult<GameState> GetState()
    {
        return Ok(_gameService.GetState());
    }

    [HttpPost("start")]
    public ActionResult<GameState> StartGame()
    {
        _gameService.InitializeGame();
        return Ok(_gameService.GetState());
    }

    [HttpPost("phase/next")]
    public ActionResult<EffectResult> NextPhase()
    {
        return Ok(_gameService.NextPhase());
    }

    [HttpPost("summon")]
    public ActionResult<EffectResult> Summon([FromBody] SummonRequest req)
    {
        return Ok(_gameService.Summon(req.CardId, req.Mode, req.TributeIndices));
    }

    [HttpPost("set")]
    public ActionResult<EffectResult> SetAction([FromBody] SetActionRequest req)
    {
        return Ok(_gameService.SetCard(req.CardId));
    }

    [HttpPost("activate")]
    public ActionResult<EffectResult> Activate([FromBody] ActivationRequest req)
    {
        if (req.Location == "hand")
        {
            // Activate Action from Hand (only Actions typically)
            if (string.IsNullOrEmpty(req.CardId)) return BadRequest("CardId required for hand activation.");
            return Ok(_gameService.ActivateActionFromHand(req.CardId, req.Target, req.DiscardIndex));
        }
        else if (req.Location == "field")
        {
            if (req.Index == null || string.IsNullOrEmpty(req.Type)) return BadRequest("Index and Type required for field activation.");
            return Ok(_gameService.ActivateOnField(req.Index.Value, req.Type, req.Target, req.DiscardIndex, req.HandIndex));
        }
        return BadRequest("Invalid location.");
    }

    [HttpPost("attack")]
    public ActionResult<EffectResult> Attack([FromBody] AttackRequest req)
    {
        return Ok(_gameService.Attack(req.AttackerIndex, req.TargetIndexStr));
    }
}
