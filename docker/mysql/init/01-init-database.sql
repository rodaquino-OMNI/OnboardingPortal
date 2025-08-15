-- MySQL Initialization Script for AUSTA Onboarding Portal
-- This script sets up the initial database configuration

-- Ensure database exists with proper character set
CREATE DATABASE IF NOT EXISTS austa_portal
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE austa_portal;

-- Create user if not exists and grant privileges
CREATE USER IF NOT EXISTS 'austa_user'@'%' IDENTIFIED BY 'austa_password';
GRANT ALL PRIVILEGES ON austa_portal.* TO 'austa_user'@'%';

-- Create read-only user for reporting (optional)
CREATE USER IF NOT EXISTS 'austa_readonly'@'%' IDENTIFIED BY 'readonly_password';
GRANT SELECT ON austa_portal.* TO 'austa_readonly'@'%';

-- Create backup user (optional)
CREATE USER IF NOT EXISTS 'austa_backup'@'%' IDENTIFIED BY 'backup_password';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON austa_portal.* TO 'austa_backup'@'%';

-- Performance optimization settings for the database
ALTER DATABASE austa_portal CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Create initial tables structure for session management
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    payload LONGTEXT NOT NULL,
    last_activity INT NOT NULL,
    PRIMARY KEY (id),
    INDEX sessions_user_id_index (user_id),
    INDEX sessions_last_activity_index (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create cache table for database caching
CREATE TABLE IF NOT EXISTS cache (
    `key` VARCHAR(255) NOT NULL,
    value MEDIUMTEXT NOT NULL,
    expiration INT NOT NULL,
    PRIMARY KEY (`key`),
    INDEX cache_expiration_index (expiration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create cache locks table
CREATE TABLE IF NOT EXISTS cache_locks (
    `key` VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    expiration INT NOT NULL,
    PRIMARY KEY (`key`),
    INDEX cache_locks_expiration_index (expiration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create jobs table for queue management
CREATE TABLE IF NOT EXISTS jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    queue VARCHAR(255) NOT NULL,
    payload LONGTEXT NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL,
    reserved_at INT UNSIGNED NULL,
    available_at INT UNSIGNED NOT NULL,
    created_at INT UNSIGNED NOT NULL,
    INDEX jobs_queue_index (queue),
    INDEX jobs_reserved_at_index (reserved_at),
    INDEX jobs_available_at_index (available_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create failed jobs table
CREATE TABLE IF NOT EXISTS failed_jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(255) NOT NULL,
    connection TEXT NOT NULL,
    queue TEXT NOT NULL,
    payload LONGTEXT NOT NULL,
    exception LONGTEXT NOT NULL,
    failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY failed_jobs_uuid_unique (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create job batches table
CREATE TABLE IF NOT EXISTS job_batches (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    total_jobs INT NOT NULL,
    pending_jobs INT NOT NULL,
    failed_jobs INT NOT NULL,
    failed_job_ids LONGTEXT NOT NULL,
    options MEDIUMTEXT NULL,
    cancelled_at INT NULL,
    created_at INT NOT NULL,
    finished_at INT NULL,
    INDEX job_batches_created_at_index (created_at),
    INDEX job_batches_finished_at_index (finished_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Set global settings for performance
SET GLOBAL max_allowed_packet = 100 * 1024 * 1024;
SET GLOBAL group_concat_max_len = 100000;

-- Flush privileges to ensure all changes take effect
FLUSH PRIVILEGES;

-- Create stored procedure for health check
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS health_check()
BEGIN
    SELECT 'healthy' as status, NOW() as checked_at;
END$$
DELIMITER ;

-- Create stored procedure for database size monitoring
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS database_stats()
BEGIN
    SELECT 
        table_schema AS 'Database',
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)',
        COUNT(*) AS 'Tables'
    FROM information_schema.tables
    WHERE table_schema = 'austa_portal'
    GROUP BY table_schema;
END$$
DELIMITER ;

-- Create function for generating UUIDs
DELIMITER $$
CREATE FUNCTION IF NOT EXISTS generate_uuid() RETURNS VARCHAR(36)
DETERMINISTIC
BEGIN
    RETURN UUID();
END$$
DELIMITER ;

-- Success message
SELECT 'Database initialization completed successfully' AS message;