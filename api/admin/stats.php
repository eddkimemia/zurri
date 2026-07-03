<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/Auth.php';

$auth = new Auth();
if (!isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$db = Database::getInstance()->getConnection();

$total_users = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
$total_revenue = $db->query("SELECT COUNT(*) * 1000 FROM users WHERE status = 'active'")->fetchColumn();
$total_paid = $db->query("SELECT SUM(amount) FROM withdrawals WHERE status = 'completed'")->fetchColumn() ?: 0;
$pending_withdrawals = $db->query("SELECT SUM(amount) FROM withdrawals WHERE status = 'pending'")->fetchColumn() ?: 0;

echo json_encode([
    'success' => true,
    'stats' => [
        'total_users' => $total_users,
        'total_revenue' => $total_revenue,
        'total_paid_out' => $total_paid,
        'pending_withdrawals' => $pending_withdrawals,
        'platform_profit' => $total_revenue - ($total_users * 500) // Rough estimate
    ]
]);
