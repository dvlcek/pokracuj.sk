<?php
require_once __DIR__ . '/config.php';

if (empty($_SESSION['user_id'])) {
  json_ok(['authenticated' => false]);
}

json_ok([
  'authenticated' => true,
  'email' => $_SESSION['email'] ?? null,
  'role'  => $_SESSION['role']  ?? 'user',
  'id'    => (int)($_SESSION['user_id'] ?? 0),
]);
