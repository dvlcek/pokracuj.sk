<?php
require __DIR__ . '/config.php';

$input = read_json();
$email = strtolower(trim($input['email'] ?? ''));
$password = (string)($input['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Neplatný email');

$db = pdo();
$st = $db->prepare("SELECT id, password_hash, role FROM users WHERE email=?");
$st->execute([$email]);
$u = $st->fetch();

if (!$u || !password_verify($password, $u['password_hash'])) {
  json_error('Nesprávny email alebo heslo', 401);
}

$_SESSION['user_id'] = (int)$u['id'];
$_SESSION['email']   = $email;
$_SESSION['role']    = $u['role'];

ensure_balances_row((int)$u['id']);

json_ok(['email' => $email, 'role' => $u['role']]);
