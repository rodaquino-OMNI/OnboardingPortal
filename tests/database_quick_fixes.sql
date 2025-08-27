-- Quick Database Fixes for OnboardingPortal Schema Issues
-- Run these SQL commands to fix the identified database problems

-- Fix 1: Health Questionnaire - Make questionnaire_type nullable or add default
ALTER TABLE `health_questionnaires` 
MODIFY COLUMN `questionnaire_type` VARCHAR(255) DEFAULT 'general';

-- Fix 2: Beneficiaries - Make full_name nullable  
ALTER TABLE `beneficiaries` 
MODIFY COLUMN `full_name` VARCHAR(255) NULL;

-- Fix 3: Documents - Check current status enum values
SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'austa_portal' 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'status';

-- Fix 4: Add missing indexes for performance (if not already present)
ALTER TABLE `health_questionnaires` 
ADD INDEX `idx_beneficiary_completed` (`beneficiary_id`, `completed_at`);

ALTER TABLE `documents` 
ADD INDEX `idx_beneficiary_status` (`beneficiary_id`, `status`);

ALTER TABLE `beneficiaries` 
ADD INDEX `idx_user_id` (`user_id`);

-- Fix 5: Ensure proper foreign key constraints
ALTER TABLE `health_questionnaires` 
ADD CONSTRAINT `fk_health_questionnaires_beneficiary` 
FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON DELETE CASCADE;

ALTER TABLE `documents` 
ADD CONSTRAINT `fk_documents_beneficiary` 
FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON DELETE CASCADE;

-- Verification queries to check fixes
SELECT 'health_questionnaires schema check' as test;
DESCRIBE `health_questionnaires`;

SELECT 'beneficiaries schema check' as test;  
DESCRIBE `beneficiaries`;

SELECT 'documents enum values check' as test;
SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'austa_portal' 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'status';

-- Test data insertion after fixes
INSERT INTO `health_questionnaires` (beneficiary_id, responses, completed_at) 
VALUES (1, '{"test": "data"}', NOW());

INSERT INTO `beneficiaries` (user_id, cpf, birth_date, gender) 
VALUES (1, '123.456.789-00', '1990-01-01', 'male');

-- Cleanup test data
DELETE FROM `health_questionnaires` WHERE responses = '{"test": "data"}';
DELETE FROM `beneficiaries` WHERE cpf = '123.456.789-00';