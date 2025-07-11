-- MySQL initialization script for Omni Portal

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS omni_portal
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Create user if not exists
CREATE USER IF NOT EXISTS 'omni_user'@'%' IDENTIFIED BY 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON omni_portal.* TO 'omni_user'@'%';

-- Create test database for testing environment
CREATE DATABASE IF NOT EXISTS omni_portal_test
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON omni_portal_test.* TO 'omni_user'@'%';

-- Flush privileges
FLUSH PRIVILEGES;
