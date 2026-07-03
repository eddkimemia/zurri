<?php
session_start();
require_once __DIR__ . '/../../src/Auth.php';
require_once __DIR__ . '/../../src/TransactionManager.php';
require_once __DIR__ . '/../../src/Database.php';

header('Content-Type: application/json');

$auth = new Auth();
if (!$auth->isLoggedIn() || $_SESSION['user_phone'] !== '700000000') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$withdrawal_id = $data['id'] ?? null;
$action = $data['action'] ?? null; // 'approve' or 'fail'

if (!$withdrawal_id || !in_array($action, ['approve', 'fail'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid parameters']);
    exit;
}

$db = Database::getInstance()->getConnection();
$tx = new TransactionManager();

try {
    $db->beginTransaction();

    // Get withdrawal details
    $stmt = $db->prepare("SELECT * FROM withdrawals WHERE id = ?");
    $stmt->execute([$withdrawal_id]);
    $withdrawal = $stmt->fetch();

    if (!$withdrawal) {
        throw new Exception("Withdrawal not found");
    }

    if ($withdrawal['status'] !== 'pending') {
        throw new Exception("Withdrawal is already processed");
    }

    if ($action === 'approve') {
        $stmt = $db->prepare("UPDATE withdrawals SET status = 'completed' WHERE id = ?");
        $stmt->execute([$withdrawal_id]);
    } else {
        // Fail the withdrawal and REFUND the user
        $stmt = $db->prepare("UPDATE withdrawals SET status = 'failed' WHERE id = ?");
        $stmt->execute([$withdrawal_id]);

        $tx->log(
            $withdrawal['user_id'],
            'refund',
            $withdrawal['amount'],
            "Refund for failed withdrawal #" . $withdrawal['id']
        );
    }

    $db->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    $db->rollBack();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
