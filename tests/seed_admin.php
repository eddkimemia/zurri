<?php
require_once __DIR__ . '/../src/Auth.php';

function seed_admin() {
    $auth = new Auth();
    $result = $auth->register("System Admin", "700000000", "admin@zuriagency.co.ke", "Nairobi", "admin123");
    if ($result['success']) {
        echo "Admin user created successfully.\n";
        // Activate admin
        require_once __DIR__ . '/../src/ReferralManager.php';
        $rm = new ReferralManager();
        $rm->processNewActiveUser($result['user_id']);
        echo "Admin user activated.\n";
    } else {
        echo "Admin creation failed: " . $result['message'] . "\n";
    }
}

seed_admin();
