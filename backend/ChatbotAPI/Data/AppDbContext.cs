using Microsoft.EntityFrameworkCore;
using ChatbotAPI.Models;

namespace ChatbotAPI.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Chat> Chats { get; set; }
        public DbSet<Message> Messages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Chat entity
            modelBuilder.Entity<Chat>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Title).IsRequired().HasColumnType("nvarchar(max)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

                // One-to-many relationship
                entity.HasMany(c => c.Messages)
                      .WithOne(m => m.Chat)
                      .HasForeignKey(m => m.ChatId)
                      .OnDelete(DeleteBehavior.Cascade); // CASCADE delete
            });

            // Configure Message entity
            modelBuilder.Entity<Message>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Role).IsRequired();
                entity.Property(e => e.Content).IsRequired().HasColumnType("nvarchar(max)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.ChatId).IsRequired();
            });
        }
    }
}
