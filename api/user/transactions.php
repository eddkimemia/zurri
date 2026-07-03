<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/Auth.php';
require_once __DIR__ . '/../../src/TransactionManager.php';

$auth = new Auth();
$user = $auth->getCurrentUser();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$tm = new TransactionManager();
$history = $tm->getHistory($user['id']);

echo json_encode(['success' => true, 'transactions' => $history]);
