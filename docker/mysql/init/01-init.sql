-- Initialize AUSTA Portal Database
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS austa_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE austa_portal;

-- Create application user
CREATE USER IF NOT EXISTS 'austa_user'@'%' IDENTIFIED BY 'austa_password';
GRANT ALL PRIVILEGES ON austa_portal.* TO 'austa_user'@'%';

-- Set proper permissions
FLUSH PRIVILEGES;