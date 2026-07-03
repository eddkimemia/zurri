-- ZuriAgency SQLite Schema

PRAGMA foreign_keys = ON;

-- 1. USERS TABLE
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT DEFAULT NULL UNIQUE,
    county TEXT DEFAULT NULL,
    password_hash TEXT NOT NULL,
    referral_code TEXT NOT NULL UNIQUE,
    referred_by_id INTEGER DEFAULT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    total_earned DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    total_withdrawn DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pending_payment', -- 'pending_payment', 'active', 'suspended'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referred_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. REFERRALS TABLE
CREATE TABLE referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 1, -- 1 = Direct, 2 = Indirect
    commission_amount DECIMAL(10, 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (referrer_id, referred_id)
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'welcome_bonus', 'direct_commission', 'upline_override', 'withdrawal', 'membership_fee'
    amount DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    reference_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. WITHDRAWALS TABLE
CREATE TABLE withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    mpesa_phone TEXT NOT NULL,
    mpesa_receipt TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    note TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, created_at DESC);
