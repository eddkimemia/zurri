<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../src/Auth.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Invalid input']);
    exit;
}

$auth = new Auth();
$result = $auth->register(
    $data['name'] ?? '',
    $data['phone'] ?? '',
    $data['email'] ?? '',
    $data['county'] ?? '',
    $data['password'] ?? '',
    $data['referral_code'] ?? null
);

if ($result['success']) {
    // Automatically log in the user after registration so they can pay/activate
    $auth->login($data['phone'], $data['password']);
}

echo json_encode($result);
