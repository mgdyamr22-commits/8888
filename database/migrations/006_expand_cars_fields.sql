-- Migration: 006_expand_cars_fields.sql
-- Expands column lengths in cars table to prevent SQLSTATE[22001] string truncation errors on MySQL strict mode

ALTER TABLE cars MODIFY COLUMN vin_matching VARCHAR(128) NULL;
ALTER TABLE cars MODIFY COLUMN card_number VARCHAR(128) NULL;
ALTER TABLE cars MODIFY COLUMN color VARCHAR(128) NOT NULL;
ALTER TABLE cars MODIFY COLUMN model_year VARCHAR(64) NULL;
ALTER TABLE cars MODIFY COLUMN status VARCHAR(128) DEFAULT 'متوفره';
ALTER TABLE cars MODIFY COLUMN rental_status VARCHAR(128) DEFAULT 'لم يتم التجير';
ALTER TABLE cars MODIFY COLUMN ownership_type VARCHAR(128) DEFAULT 'مباشر';
