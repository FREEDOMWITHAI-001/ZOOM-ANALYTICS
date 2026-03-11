-- Admin Dashboard Setup Migration
-- Run this on your PostgreSQL database ONCE before deploying the update

-- Step 1: Add role and created_at columns to client_credentials
ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Step 2: See existing clients
SELECT client_name, is_active FROM client_credentials;

-- Step 3: Promote an existing client to admin
-- Replace 'your_username' with an existing client_name from Step 2
UPDATE client_credentials SET role = 'admin' WHERE client_name = 'your_username';

-- Step 4: Verify
SELECT client_name, role, is_active, created_at FROM client_credentials ORDER BY created_at;
