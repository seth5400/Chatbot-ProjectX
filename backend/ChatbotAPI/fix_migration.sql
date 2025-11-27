-- Fix EF Core Migrations History
-- Run this script in SQL Server Management Studio or Azure Data Studio

-- Step 1: Create __EFMigrationsHistory table if not exists
IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
    PRINT 'Created __EFMigrationsHistory table';
END;

-- Step 2: Mark InitialCreate as applied (since tables already exist)
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251126030208_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20251126030208_InitialCreate', N'10.0.0');
    PRINT 'Marked InitialCreate migration as applied';
END;

-- Step 3: Add ImagePublicId column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[Messages]')
    AND name = 'ImagePublicId'
)
BEGIN
    ALTER TABLE [Messages] ADD [ImagePublicId] nvarchar(200) NULL;
    PRINT 'Added ImagePublicId column';
END;

-- Step 4: Add ImageUrl column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[Messages]')
    AND name = 'ImageUrl'
)
BEGIN
    ALTER TABLE [Messages] ADD [ImageUrl] nvarchar(500) NULL;
    PRINT 'Added ImageUrl column';
END;

-- Step 5: Mark AddImageFieldsToMessage as applied
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20251127084121_AddImageFieldsToMessage'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20251127084121_AddImageFieldsToMessage', N'10.0.0');
    PRINT 'Marked AddImageFieldsToMessage migration as applied';
END;

PRINT 'Migration fix completed successfully!';
