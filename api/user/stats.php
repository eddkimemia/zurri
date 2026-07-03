<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/Auth.php';

$auth = new Auth();
$user = $auth->getCurrentUser();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// Additional aggregated stats
$db = Database::getInstance()->getConnection();
$stmt = $db->prepare("SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND level = 1");
$stmt->execute([$user['id']]);
$direct_count = $stmt->fetch()['count'];

$stmt = $db->prepare("SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND level = 2");
$stmt->execute([$user['id']]);
$indirect_count = $stmt->fetch()['count'];

echo json_encode([
    'success' => true,
    'user' => [
        'name' => $user['name'],
        'phone' => $user['phone'],
        'referral_code' => $user['referral_code'],
        'balance' => $user['balance'],
        'total_earned' => $user['total_earned'],
        'total_withdrawn' => $user['total_withdrawn'],
        'status' => $user['status'],
        'direct_count' => $direct_count,
        'indirect_count' => $indirect_count,
        'total_team' => $direct_count + $indirect_count
    ]
]);
