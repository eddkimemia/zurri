<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/Auth.php';

$auth = new Auth();
$user = $auth->getCurrentUser();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$db = Database::getInstance()->getConnection();
$stmt = $db->prepare("
    SELECT u.name, u.created_at, r.level, r.commission_amount
    FROM referrals r
    JOIN users u ON r.referred_id = u.id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
");
$stmt->execute([$user['id']]);
$referrals = $stmt->fetchAll();

echo json_encode(['success' => true, 'referrals' => $referrals]);
