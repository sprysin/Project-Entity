using ProjectEntity.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register Game Logic Services
builder.Services.AddSingleton<CardEffectService>();
builder.Services.AddSingleton<GameService>();

// Configure CORS for Vite Frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection(); // Disable for simpler local dev if needed, but standard template has it.
// The user might not have dev certs trusted.
// I'll keep it but often 'dotnet run' warns.
app.UseHttpsRedirection();

app.UseCors();

app.MapControllers();

app.Run();
