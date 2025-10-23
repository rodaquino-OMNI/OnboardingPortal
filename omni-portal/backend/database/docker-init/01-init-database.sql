-- OnboardingPortal Database Initialization Script
-- This script runs automatically when MySQL container starts

-- Ensure database exists
CREATE DATABASE IF NOT EXISTS `onboarding_portal` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges
GRANT ALL PRIVILEGES ON `onboarding_portal`.* TO 'onboarding_user'@'%';
FLUSH PRIVILEGES;

USE `onboarding_portal`;

-- Create health check table
CREATE TABLE IF NOT EXISTS `health_check` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `status` varchar(255) NOT NULL DEFAULT 'healthy',
    `checked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial health check record
INSERT INTO `health_check` (`status`, `checked_at`) VALUES ('healthy', NOW());

-- Set MySQL configurations for better performance
SET GLOBAL max_connections = 200;
SET GLOBAL query_cache_size = 0;
SET GLOBAL query_cache_type = 0;
SET GLOBAL innodb_buffer_pool_size = 256M;
SET GLOBAL innodb_log_file_size = 64M;
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
SET GLOBAL innodb_flush_method = O_DIRECT;

SELECT 'Database initialized successfully' AS status;
