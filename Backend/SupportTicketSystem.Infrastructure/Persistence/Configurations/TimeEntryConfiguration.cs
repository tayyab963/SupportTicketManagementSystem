using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportTicketSystem.Domain.Entities;

namespace SupportTicketSystem.Infrastructure.Persistence.Configurations;

public class TimeEntryConfiguration : IEntityTypeConfiguration<TimeEntry>
{
    public void Configure(EntityTypeBuilder<TimeEntry> builder)
    {
        builder.ToTable("TimeEntries");

        builder.HasKey(te => te.Id);
        builder.Property(te => te.Id).ValueGeneratedOnAdd();

        builder.Property(te => te.WorkDate).IsRequired().HasColumnType("date");
        builder.Property(te => te.DurationMinutes).IsRequired();
        builder.Property(te => te.Description).IsRequired().HasMaxLength(500);
        builder.Property(te => te.CreatedAt).IsRequired();

        builder.HasIndex(te => te.TicketId);
        builder.HasIndex(te => te.UserId);
    }
}
