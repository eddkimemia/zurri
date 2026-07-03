<?php
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/ReferralManager.php';

function test_flow() {
    $db = Database::getInstance()->getConnection();
    // Clear tables for clean test
    $db->exec("DELETE FROM referrals");
    $db->exec("DELETE FROM transactions");
    $db->exec("DELETE FROM withdrawals");
    $db->exec("DELETE FROM users");
    $db->exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'referrals', 'transactions', 'withdrawals')");

    $auth = new Auth();
    $rm = new ReferralManager();

    // 1. Register User 1 (Referrer)
    echo "Registering User 1...\n";
    $u1 = $auth->register("User One", "711111111", "u1@test.com", "Nairobi", "pass123");
    if (!$u1['success']) die("U1 Registration failed: " . $u1['message'] . "\n");

    $stmt = $db->prepare("SELECT referral_code FROM users WHERE id = ?");
    $stmt->execute([$u1['user_id']]);
    $u1_code = $stmt->fetchColumn();
    echo "User 1 registered with code: $u1_code\n";

    // Activate U1
    $rm->processNewActiveUser($u1['user_id']);
    echo "User 1 activated.\n";

    // 2. Register User 2 (referred by User 1)
    echo "Registering User 2 (referred by U1)...\n";
    $u2 = $auth->register("User Two", "722222222", "u2@test.com", "Mombasa", "pass123", $u1_code);
    if (!$u2['success']) die("U2 Registration failed: " . $u2['message'] . "\n");

    // Activate U2
    echo "Activating User 2...\n";
    $rm->processNewActiveUser($u2['user_id']);

    // Check U1 Balance (Should be 500 bonus + 350 direct = 850)
    $stmt = $db->prepare("SELECT balance FROM users WHERE id = ?");
    $stmt->execute([$u1['user_id']]);
    $u1_balance = $stmt->fetchColumn();
    echo "User 1 Balance: $u1_balance (Expected 850)\n";
    if ($u1_balance != 850) die("U1 balance mismatch!\n");

    // 3. Register User 3 (referred by User 2)
    $stmt = $db->prepare("SELECT referral_code FROM users WHERE id = ?");
    $stmt->execute([$u2['user_id']]);
    $u2_code = $stmt->fetchColumn();

    echo "Registering User 3 (referred by U2)...\n";
    $u3 = $auth->register("User Three", "733333333", "u3@test.com", "Kisumu", "pass123", $u2_code);
    $rm->processNewActiveUser($u3['user_id']);

    // Check U1 Balance (Should be 850 + 150 indirect = 1000)
    $stmt = $db->prepare("SELECT balance FROM users WHERE id = ?");
    $stmt->execute([$u1['user_id']]);
    $u1_balance = $stmt->fetchColumn();
    echo "User 1 Balance after U3 join: $u1_balance (Expected 1000)\n";
    if ($u1_balance != 1000) die("U1 balance mismatch after indirect referral!\n");

    // Check U2 Balance (Should be 500 bonus + 350 direct = 850)
    $stmt->execute([$u2['user_id']]);
    $u2_balance = $stmt->fetchColumn();
    echo "User 2 Balance: $u2_balance (Expected 850)\n";
    if ($u2_balance != 850) die("U2 balance mismatch!\n");

    echo "\nFull Flow Test Passed!\n";
}

test_flow();
