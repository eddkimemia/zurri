<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../src/Auth.php';

$auth = new Auth();
if ($auth->isLoggedIn()) {
    echo json_encode(['success' => true, 'csrf_token' => $auth->generateCsrfToken()]);
} else {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
}
