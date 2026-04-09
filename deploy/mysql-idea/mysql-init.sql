CREATE DATABASE IF NOT EXISTS parking_management_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE parking_management_system;

-- 如果你希望使用独立账号而不是 root，可以取消下面这段注释：
-- CREATE USER IF NOT EXISTS 'parksphere'@'localhost' IDENTIFIED BY 'parksphere123';
-- GRANT ALL PRIVILEGES ON parking_management_system.* TO 'parksphere'@'localhost';
-- FLUSH PRIVILEGES;
