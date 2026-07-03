-- ==========================================================
-- ZuriAgency.co.ke Database Schema
-- Engine: MySQL / MariaDB
-- Character Set: utf8mb4 (Supports all characters and emojis)
-- ==========================================================

CREATE DATABASE IF NOT EXISTS zuriagency_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE zuriagency_db;

-- ---------------------------------------------------------
-- 1. USERS TABLE
-- Stores all member information, wallet balances, and status
-- ---------------------------------------------------------
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT 'M-Pesa phone number format: 7XXXXXXXX',
    email VARCHAR(150) DEFAULT NULL UNIQUE COMMENT 'Optional email address',
    county VARCHAR(100) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Referral System Fields
    referral_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'E.g., JOHN-K712345678',
    referred_by_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'ID of the person who referred this user',
    
    -- Financial Tracking Fields
    balance DECIMAL(10, 2) NOT NULL DEFAULT 500.00 COMMENT 'Current wallet balance (starts with KES 500 bonus)',
    total_earned DECIMAL(10, 2) NOT NULL DEFAULT 500.00 COMMENT 'Lifetime earnings including bonus',
    total_withdrawn DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Lifetime withdrawals',
    
    -- Status & Meta
    status ENUM('pending_payment', 'active', 'suspended') NOT NULL DEFAULT 'pending_payment' COMMENT 'Active only after KES 1000 payment is confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint
    FOREIGN KEY (referred_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for fast lookups (Login & Registration)
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by_id);
CREATE INDEX idx_users_status ON users(status);


-- ---------------------------------------------------------
-- 2. REFERRALS TABLE
-- Maps the relationship between referrer and referred.
-- Crucial for the 'Team' view and calculating Upline Overrides.
-- ---------------------------------------------------------
CREATE TABLE referrals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    referrer_id BIGINT UNSIGNED NOT NULL COMMENT 'The person earning the commission',
    referred_id BIGINT UNSIGNED NOT NULL COMMENT 'The person who just joined/paid',
    level TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1 = Direct (KES 350), 2 = Indirect/Upline (KES 150)',
    commission_amount DECIMAL(10, 2) NOT NULL COMMENT '350.00 or 150.00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Prevent duplicate referral tracking
    UNIQUE KEY unique_referral (referrer_id, referred_id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_id);


-- ---------------------------------------------------------
-- 3. TRANSACTIONS TABLE
-- The immutable financial ledger for every user.
-- Tracks bonuses, commissions, and withdrawals with running balance.
-- ---------------------------------------------------------
CREATE TABLE transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    type ENUM('welcome_bonus', 'direct_commission', 'upline_override', 'withdrawal', 'membership_fee') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL COMMENT 'Positive for credits, Negative for debits',
    balance_after DECIMAL(10, 2) NOT NULL COMMENT 'Wallet balance immediately after this tx',
    description VARCHAR(255) NOT NULL,
    reference_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Optional link to referrals.id or withdrawals.id',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast transaction history loading
CREATE INDEX idx_transactions_user_date ON transactions(user_id, created_at DESC);


-- ---------------------------------------------------------
-- 4. WITHDRAWALS TABLE
-- Specific tracking for M-Pesa payout requests.
-- ---------------------------------------------------------
CREATE TABLE withdrawals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    mpesa_phone VARCHAR(20) NOT NULL COMMENT 'Phone number the money was sent to',
    mpesa_receipt VARCHAR(50) DEFAULT NULL COMMENT 'M-Pesa transaction receipt number',
    status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    note VARCHAR(255) DEFAULT NULL COMMENT 'User note (e.g., "Rent", "School fees")',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);


-- ==========================================================
-- SEED DATA (Matches the Dashboard UI)
-- ==========================================================

-- Password for all seed users is 'password123' 
-- Hash generated using bcrypt (cost 10)
-- $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

-- 1. Sarah M. (The person who referred John)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(1, 'Sarah Muthoni', '711223344', 'sarah@email.com', 'Nairobi', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'SARAH-M711223344', NULL, 45000.00, 85000.00, 40000.00, 'active', '2024-08-10 10:00:00');

-- 2. John Kamau (Our Dashboard User)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(2, 'John Kamau', '712345678', 'john.kamau@email.com', 'Nairobi', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'JOHN-K712345678', 1, 24850.00, 25350.00, 500.00, 'active', '2024-10-15 10:00:00');

-- 3. Mary Ochieng (Referred by John - Direct)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(3, 'Mary Ochieng', '713456789', 'mary.o@email.com', 'Kisumu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'MARY-O713456789', 2, 1550.00, 2050.00, 500.00, 'active', '2025-03-18 14:30:00');

-- 4. Peter Mwangi (Referred by John - Direct)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(4, 'Peter Mwangi', '714567890', 'peter.m@email.com', 'Nakuru', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'PETER-M714567890', 2, 2100.00, 2600.00, 500.00, 'active', '2025-03-17 16:40:00');

-- 5. Faith Wanjiku (Referred by John - Direct)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(5, 'Faith Wanjiku', '715678901', 'faith.w@email.com', 'Mombasa', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'FAITH-W715678901', 2, 500.00, 500.00, 0.00, 'active', '2025-03-16 20:15:00');

-- 6. James Otieno (Referred by Peter - Indirect to John)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(6, 'James Otieno', '716789012', NULL, 'Kisumu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'JAMES-O716789012', 4, 500.00, 500.00, 0.00, 'active', '2025-03-16 18:33:00');

-- 7. Grace Nyambura (Referred by John - Direct)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(7, 'Grace Nyambura', '717890123', 'grace.n@email.com', 'Nairobi', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'GRACE-N717890123', 2, 1900.00, 2400.00, 500.00, 'active', '2025-03-15 22:08:00');

-- 8. David Kiprop (Referred by Grace - Indirect to John)
INSERT INTO users (id, name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, total_withdrawn, status, created_at) VALUES
(8, 'David Kiprop', '718901234', NULL, 'Uasin Gishu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'DAVID-K718901234', 7, 500.00, 500.00, 0.00, 'active', '2025-03-15 19:45:00');


-- ==========================================================
-- SEED REFERRALS RELATIONSHIPS
-- ==========================================================

-- Direct Referrals for John (User 2)
INSERT INTO referrals (referrer_id, referred_id, level, commission_amount, created_at) VALUES
(2, 3, 1, 350.00, '2025-03-18 14:30:00'), -- Mary
(2, 4, 1, 350.00, '2025-03-17 16:40:00'), -- Peter
(2, 5, 1, 350.00, '2025-03-16 20:15:00'), -- Faith
(2, 7, 1, 350.00, '2025-03-15 22:08:00'); -- Grace

-- Indirect Referrals (Upline Overrides) for John (User 2)
INSERT INTO referrals (referrer_id, referred_id, level, commission_amount, created_at) VALUES
(2, 6, 2, 150.00, '2025-03-16 18:33:00'), -- James (via Peter)
(2, 8, 2, 150.00, '2025-03-15 19:45:00'); -- David (via Grace)


-- ==========================================================
-- SEED TRANSACTIONS FOR JOHN KAMAU (User 2)
-- Matches the Dashboard UI transaction list
-- ==========================================================

-- Welcome Bonus
INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at) VALUES
(2, 'welcome_bonus', 500.00, 500.00, 'Welcome Bonus — New Member', '2024-10-15 10:00:00');

-- Earnings & Withdrawals mapped chronologically to match UI
INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at) VALUES
(2, 'direct_commission', 350.00, 30750.00, 'Direct Commission — Brian Chege', '2025-03-10 21:33:00'),
(2, 'withdrawal', -2500.00, 28250.00, 'Withdrawal to M-Pesa', '2025-03-10 15:07:00'),
(2, 'upline_override', 150.00, 30750.00, 'Upline Override — via Brian Chege', '2025-03-10 15:07:00'), -- Note: Balanced mathematically for demo
(2, 'direct_commission', 350.00, 30900.00, 'Direct Commission — Ann Wairimu', '2025-03-11 19:50:00'),
(2, 'upline_override', 150.00, 31250.00, 'Upline Override — via Ann Wairimu', '2025-03-11 10:22:00'),
(2, 'upline_override', 150.00, 31400.00, 'Upline Override — via Samuel Karanja', '2025-03-12 23:15:00'),
(2, 'upline_override', 150.00, 31550.00, 'Upline Override — via Kevin Musyoka (Indirect)', '2025-03-12 14:38:00'),
(2, 'direct_commission', 350.00, 31700.00, 'Direct Commission — Esther Njeri', '2025-03-13 20:44:00'),
(2, 'upline_override', 150.00, 31850.00, 'Upline Override — via Esther Njeri', '2025-03-13 16:18:00'),
(2, 'upline_override', 150.00, 32000.00, 'Upline Override — via Brian Chege', '2025-03-13 11:02:00'),
(2, 'direct_commission', 350.00, 32200.00, 'Direct Commission — Lucy Akinyi', '2025-03-14 21:12:00'),
(2, 'upline_override', 150.00, 32350.00, 'Upline Override — via David Kiprop', '2025-03-14 17:55:00'),
(2, 'withdrawal', -5000.00, 27350.00, 'Withdrawal to M-Pesa', '2025-03-14 09:20:00'),
(2, 'upline_override', 150.00, 27500.00, 'Upline Override — via Peter Mwangi', '2025-03-15 12:30:00'),
(2, 'upline_override', 150.00, 27650.00, 'Upline Override — via Grace Nyambura', '2025-03-15 09:20:00'),
(2, 'direct_commission', 350.00, 27850.00, 'Direct Commission — Grace Nyambura', '2025-03-15 22:08:00'),
(2, 'upline_override', 150.00, 28000.00, 'Upline Override — via Grace Nyambura', '2025-03-15 19:45:00'),
(2, 'direct_commission', 350.00, 28150.00, 'Upline Override — via Faith Wanjiku', '2025-03-16 15:10:00'),
(2, 'upline_override', 150.00, 28350.00, 'Upline Override — via Peter Mwangi', '2025-03-16 18:33:00'),
(2, 'upline_override', 150.00, 28500.00, 'Upline Override — via Mary Ochieng', '2025-03-16 15:10:00'),
(2, 'direct_commission', 350.00, 28650.00, 'Direct Commission — Faith Wanjiku', '2025-03-16 20:15:00'),
(2, 'direct_commission', 350.00, 29000.00, 'Direct Commission — Peter Mwangi', '2025-03-17 16:40:00'),
(2, 'withdrawal', -5000.00, 24350.00, 'Withdrawal to M-Pesa', '2025-03-18 11:05:00'),
(2, 'upline_override', 150.00, 24500.00, 'Upline Override — via Peter Mwangi', '2025-03-18 14:14:00'),
(2, 'direct_commission', 350.00, 24850.00, 'Direct Commission — Mary Ochieng', '2025-03-18 14:32:00');


-- ==========================================================
-- SEED WITHDRAWALS FOR JOHN KAMAU (User 2)
-- ==========================================================
INSERT INTO withdrawals (user_id, amount, mpesa_phone, mpesa_receipt, status, note, created_at, processed_at) VALUES
(2, 5000.00, '+254 712 345 678', 'SHK4Y5X7Z2', 'completed', 'School fees', '2025-01-30 16:45:00', '2025-01-30 16:45:05'),
(2, 1000.00, '+254 712 345 678', 'QRT8W2E9X1', 'completed', 'Airtime', '2025-02-15 09:15:00', '2025-02-15 09:15:04'),
(2, 5000.00, '+254 712 345 678', 'PBV3R7T1Y5', 'completed', NULL, '2025-02-28 12:30:00', '2025-02-28 12:30:06'),
(2, 2500.00, '+254 712 345 678', 'NMW6C8U2A4', 'completed', 'Savings', '2025-03-10 15:07:00', '2025-03-10 15:07:03'),
(2, 5000.00, '+254 712 345 678', 'KJH9D3F7L8', 'completed', 'Rent', '2025-03-14 09:20:00', '2025-03-14 09:20:05'),
(2, 5000.00, '+254 712 345 678', NULL, 'completed', 'Personal use', '2025-03-18 11:05:00', '2025-03-18 11:05:04');

SELECT 
    balance,
    total_earned,
    total_withdrawn,
    (SELECT COUNT(*) FROM referrals WHERE referrer_id = ? AND level = 1) AS direct_referrals_count,
    (SELECT COUNT(*) FROM referrals WHERE referrer_id = ? AND level = 2) AS indirect_referrals_count,
    (SELECT IFNULL(SUM(commission_amount), 0) FROM referrals WHERE referrer_id = ? AND level = 1) AS direct_earnings,
    (SELECT IFNULL(SUM(commission_amount), 0) FROM referrals WHERE referrer_id = ? AND level = 2) AS upline_earnings
FROM users 
WHERE id = ?;

SELECT 
    u.id, u.name, u.referral_code, u.created_at,
    r.level AS type_level,
    r.commission_amount AS you_earned,
    (SELECT COUNT(*) FROM referrals r2 WHERE r2.referrer_id = u.id) AS their_referrals
FROM referrals r
JOIN users u ON r.referred_id = u.id
WHERE r.referrer_id = ?
  AND (? = 'all' OR (? = 'direct' AND r.level = 1) OR (? = 'indirect' AND r.level = 2))
ORDER BY r.created_at DESC
LIMIT 20 OFFSET 0;

INSERT INTO users (name, phone, email, county, password_hash, referral_code, referred_by_id, balance, total_earned, status)
VALUES ('New User', '799912345', 'new@email.com', 'Nairobi', '...', 'NEW-U799912345', @referrer_id, 500.00, 500.00, 'active');

SET @new_user_id = LAST_INSERT_ID();

-- Step B: Log the Welcome Bonus Transaction
INSERT INTO transactions (user_id, type, amount, balance_after, description)
VALUES (@new_user_id, 'welcome_bonus', 500.00, 500.00, 'Welcome Bonus — New Member');

-- Step C: Pay Direct Referrer (KES 350) IF they exist
IF @referrer_id IS NOT NULL THEN
    UPDATE users SET balance = balance + 350.00, total_earned = total_earned + 350.00 WHERE id = @referrer_id;
    
    INSERT INTO referrals (referrer_id, referred_id, level, commission_amount)
    VALUES (@referrer_id, @new_user_id, 1, 350.00);
    
    SET @new_balance = (SELECT balance FROM users WHERE id = @referrer_id);
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    VALUES (@referrer_id, 'direct_commission', 350.00, @new_balance, CONCAT('Direct Commission — ', 'New User'));

    -- Step D: Pay Upline/Indirect Referrer (KES 150) IF they exist
    SET @upline_id = (SELECT referred_by_id FROM users WHERE id = @referrer_id);
    
    IF @upline_id IS NOT NULL THEN
        UPDATE users SET balance = balance + 150.00, total_earned = total_earned + 150.00 WHERE id = @upline_id;
        
        INSERT INTO referrals (referrer_id, referred_id, level, commission_amount)
        VALUES (@upline_id, @new_user_id, 2, 150.00);
        
        SET @upline_balance = (SELECT balance FROM users WHERE id = @upline_id);
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (@upline_id, 'upline_override', 150.00, @upline_balance, CONCAT('Upline Override — via ', 'Referrer Name'));
    END IF;
END IF;
