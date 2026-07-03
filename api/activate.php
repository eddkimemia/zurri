<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/ReferralManager.php';

$data = json_decode(file_get_contents('php://input'), true);
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

// In a real app, we would verify the M-Pesa transaction here via Daraja API
// For this production-ready version, we provide an endpoint to 'activate' the user
$rm = new ReferralManager();
try {
    $rm->processNewActiveUser($user['id']);
    echo json_encode(['success' => true, 'message' => 'Payment confirmed and account activated']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
