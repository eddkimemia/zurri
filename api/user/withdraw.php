<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/Auth.php';

$auth = new Auth();
$user = $auth->getCurrentUser();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// CSRF check
$token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!$auth->verifyCsrfToken($token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$amount = floatval($data['amount'] ?? 0);

if ($amount < 500) {
    echo json_encode(['success' => false, 'message' => 'Minimum withdrawal is KES 500']);
    exit;
}

if ($amount > $user['balance']) {
    echo json_encode(['success' => false, 'message' => 'Insufficient balance']);
    exit;
}

$db = Database::getInstance()->getConnection();
try {
    $db->beginTransaction();

    // 1. Deduct from balance
    $stmt = $db->prepare("UPDATE users SET balance = balance - ?, total_withdrawn = total_withdrawn + ? WHERE id = ?");
    $stmt->execute([$amount, $amount, $user['id']]);

    // 2. Create withdrawal request
    $stmt = $db->prepare("INSERT INTO withdrawals (user_id, amount, mpesa_phone, note) VALUES (?, ?, ?, ?)");
    $stmt->execute([$user['id'], $amount, $user['phone'], $data['note'] ?? '']);

    // 3. Log transaction
    $new_balance = $user['balance'] - $amount;
    $stmt = $db->prepare("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, 'withdrawal', ?, ?, 'Withdrawal to M-Pesa')");
    $stmt->execute([$user['id'], -$amount, $new_balance]);

    $db->commit();
    echo json_encode(['success' => true, 'message' => 'Withdrawal request submitted']);
} catch (Exception $e) {
    $db->rollBack();
    echo json_encode(['success' => false, 'message' => 'Request failed: ' . $e->getMessage()]);
}
