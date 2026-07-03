<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/Auth.php';
require_once __DIR__ . '/../../src/TransactionManager.php';

$auth = new Auth();
if (!isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$auth->verifyCsrfToken($token)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
}

$db = Database::getInstance()->getConnection();
$data = json_decode(file_get_contents('php://input'), true);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->query("
        SELECT w.*, u.name
        FROM withdrawals w
        JOIN users u ON w.user_id = u.id
        ORDER BY w.created_at DESC
    ");
    $withdrawals = $stmt->fetchAll();
    echo json_encode(['success' => true, 'withdrawals' => $withdrawals]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($data['id'], $data['status'])) {
    $withdrawal_id = $data['id'];
    $new_status = $data['status'];

    if (!in_array($new_status, ['completed', 'failed'])) {
         echo json_encode(['success' => false, 'message' => 'Invalid status']);
         exit;
    }

    try {
        $db->beginTransaction();

        // Get withdrawal info
        $stmt = $db->prepare("SELECT * FROM withdrawals WHERE id = ?");
        $stmt->execute([$withdrawal_id]);
        $withdrawal = $stmt->fetch();

        if (!$withdrawal) {
            throw new Exception("Withdrawal not found");
        }

        if ($withdrawal['status'] !== 'pending') {
             throw new Exception("Withdrawal already processed");
        }

        $stmt = $db->prepare("UPDATE withdrawals SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$new_status, $withdrawal_id]);

        if ($new_status === 'failed') {
            // REFUND the user
            $tx = new TransactionManager();
            $tx->log(
                $withdrawal['user_id'],
                'refund',
                $withdrawal['amount'],
                "Refund for failed withdrawal #" . $withdrawal_id
            );
        }

        $db->commit();
        echo json_encode(['success' => true, 'message' => 'Withdrawal status updated']);
    } catch (Exception $e) {
        $db->rollBack();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}
