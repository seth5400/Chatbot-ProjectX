IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251126030208_InitialCreate'
)
BEGIN
    CREATE TABLE [Chats] (
        [Id] nvarchar(450) NOT NULL,
        [Title] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
        [UpdatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_Chats] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251126030208_InitialCreate'
)
BEGIN
    CREATE TABLE [Messages] (
        [Id] nvarchar(450) NOT NULL,
        [Role] nvarchar(max) NOT NULL,
        [Content] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
        [ChatId] nvarchar(450) NOT NULL,
        CONSTRAINT [PK_Messages] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Messages_Chats_ChatId] FOREIGN KEY ([ChatId]) REFERENCES [Chats] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251126030208_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Messages_ChatId] ON [Messages] ([ChatId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251126030208_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20251126030208_InitialCreate', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251127084121_AddImageFieldsToMessage'
)
BEGIN
    ALTER TABLE [Messages] ADD [ImagePublicId] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251127084121_AddImageFieldsToMessage'
)
BEGIN
    ALTER TABLE [Messages] ADD [ImageUrl] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251127084121_AddImageFieldsToMessage'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20251127084121_AddImageFieldsToMessage', N'10.0.0');
END;

COMMIT;
GO

