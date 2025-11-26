-- ======================================
-- Script สำหรับ Reset Database
-- ======================================

USE master;
GO

-- ปิด connections ทั้งหมดที่เชื่อมต่ออยู่
ALTER DATABASE [ChatbotDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

-- ลบ database
DROP DATABASE IF EXISTS [ChatbotDB];
GO

-- สร้าง database ใหม่
CREATE DATABASE [ChatbotDB];
GO

USE [ChatbotDB];
GO

-- สร้าง table Chats
CREATE TABLE [Chats] (
    [Id] NVARCHAR(450) NOT NULL PRIMARY KEY,
    [Title] NVARCHAR(500) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL,
    [UpdatedAt] DATETIME2 NOT NULL
);
GO

-- สร้าง table Messages
CREATE TABLE [Messages] (
    [Id] NVARCHAR(450) NOT NULL PRIMARY KEY,
    [Role] NVARCHAR(50) NOT NULL,
    [Content] NVARCHAR(MAX) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL,
    [ChatId] NVARCHAR(450) NOT NULL,
    CONSTRAINT [FK_Messages_Chats] FOREIGN KEY ([ChatId])
        REFERENCES [Chats]([Id]) ON DELETE CASCADE
);
GO

-- สร้าง indexes เพื่อเพิ่มความเร็ว
CREATE INDEX [IX_Messages_ChatId] ON [Messages]([ChatId]);
GO
CREATE INDEX [IX_Chats_UpdatedAt] ON [Chats]([UpdatedAt] DESC);
GO

PRINT 'Database reset สำเร็จ!';
GO
