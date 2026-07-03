<?php
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/TransactionManager.php';
require_once __DIR__ . '/../src/Database.php';

session_start();

$db = Database::getInstance()->getConnection();
$tx = new TransactionManager();

// 1. Create a user
$phone = "999999999";
$db->exec("DELETE FROM users WHERE phone = '$phone'");
$db->prepare("INSERT INTO users (name, phone, password_hash, status, balance, referral_code) VALUES (?, ?, ?, ?, ?, ?)")
   ->execute(['Test Refund', $phone, password_hash('pass', PASSWORD_BCRYPT), 'active', 2000, 'REF999']);

$user_id = $db->lastInsertId();

// 2. Initiate withdrawal
echo "Current Balance: " . $db->query("SELECT balance FROM users WHERE id = $user_id")->fetchColumn() . "\n";

$amount = 500;
$db->prepare("INSERT INTO withdrawals (user_id, amount, mpesa_phone, status) VALUES (?, ?, ?, ?)")
   ->execute([$user_id, $amount, $phone, 'pending']);
$wd_id = $db->lastInsertId();

$tx->log($user_id, 'withdrawal', -$amount, "Withdrawal test");

echo "Balance after withdrawal initiation: " . $db->query("SELECT balance FROM users WHERE id = $user_id")->fetchColumn() . "\n";

// 3. Mock Admin Environment for withdrawals.php
$_SESSION['is_admin'] = true;
$_SESSION['user_phone'] = '700000000';
$_SERVER['REQUEST_METHOD'] = 'POST';
$GLOBALS['test_json_input'] = json_encode(['id' => $wd_id, 'status' => 'failed']);

// We need to modify withdrawals.php slightly to accept injected input for testing
// Or just replicate the logic here. Replicating the logic to avoid modifying prod code just for a test.

try {
    $db->beginTransaction();
    $stmt = $db->prepare("SELECT * FROM withdrawals WHERE id = ?");
    $stmt->execute([$wd_id]);
    $withdrawal = $stmt->fetch();

    $stmt = $db->prepare("UPDATE withdrawals SET status = 'failed', processed_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$wd_id]);

    $tx->log($withdrawal['user_id'], 'refund', $withdrawal['amount'], "Refund for failed withdrawal #" . $wd_id);
    $db->commit();
    echo "Withdrawal failed and user refunded.\n";
} catch (Exception $e) {
    $db->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
}

echo "Balance after failure: " . $db->query("SELECT balance FROM users WHERE id = $user_id")->fetchColumn() . "\n";
