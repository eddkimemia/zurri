<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../src/Auth.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Invalid input']);
    exit;
}

$auth = new Auth();
$result = $auth->login(
    $data['phone'] ?? '',
    $data['password'] ?? ''
);

echo json_encode($result);
