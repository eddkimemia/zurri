<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/Auth.php';

$auth = new Auth();
if (!isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$db = Database::getInstance()->getConnection();
$stmt = $db->query("SELECT id, name, phone, county, balance, total_earned, status FROM users ORDER BY created_at DESC");
$users = $stmt->fetchAll();

echo json_encode(['success' => true, 'users' => $users]);
