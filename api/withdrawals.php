<?php
require_once __DIR__ . '/config.php';
require_admin();

try {
  $db = pdo();

  // balances columns
  $colMain  = 'main_cents';
  $colBonus = 'bonus_cents';
  $chk = $db->query("SHOW COLUMNS FROM balances LIKE 'main_cents'")->fetch();
  if (!$chk) { $colMain = 'main'; $colBonus = 'bonus'; }
  $balancesAreCents = ($colMain === 'main_cents');

  // withdrawals column
  $amountCol = 'amount_cents';
  $chk2 = $db->query("SHOW COLUMNS FROM withdrawals LIKE 'amount_cents'")->fetch();
  if (!$chk2) { $amountCol = 'amount'; }
  $withdrawalsAreCents = ($amountCol === 'amount_cents');

  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

  // ----------------------- GET (list pending) -----------------------
  if ($method === 'GET') {
    $t = $db->query("SHOW TABLES LIKE 'withdrawals'")->fetch();
    if (!$t) json_ok([]);

    $sql = "
      SELECT w.id, w.user_id, w.type, w.$amountCol AS amt, w.status, w.created_at, u.email
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      WHERE w.status = 'pending'
      ORDER BY w.created_at DESC, w.id DESC
    ";
    $st = $db->query($sql);

    $rows = [];
    while ($r = $st->fetch()) {
      $rows[] = [
        'id'         => (int)$r['id'],
        'user_id'    => (int)$r['user_id'],
        'email'      => $r['email'],
        'type'       => $r['type'],
        'amount'     => $withdrawalsAreCents ? round(((int)$r['amt'])/100, 2) : (float)$r['amt'],
        'status'     => $r['status'],
        'created_at' => $r['created_at'],
      ];
    }
    json_ok($rows);
  }

  // ----------------------- POST (approve/reject) -----------------------
  if ($method === 'POST') {
    $input = read_json();
    $id       = isset($input['id']) ? (int)$input['id'] : 0;
    $decision = strtolower(trim($input['decision'] ?? ''));

    if ($id <= 0) json_error('Chýbajúce alebo neplatné "id"');
    if (!in_array($decision, ['approve','reject'], true)) json_error('Neznáme rozhodnutie');

    $admin_id = (int)($_SESSION['user_id'] ?? 0);

    try {
      $db->beginTransaction();

      // načítaj a zamkni žiadosť
      $st = $db->prepare("
        SELECT w.id, w.user_id, w.type, w.$amountCol AS amt, w.status
        FROM withdrawals w
        WHERE w.id = ? FOR UPDATE
      ");
      $st->execute([$id]);
      $w = $st->fetch();

      if (!$w) { $db->rollBack(); json_error('Žiadosť neexistuje', 404); }
      if ($w['status'] !== 'pending') { $db->rollBack(); json_error('Žiadosť už bola spracovaná'); }

      $user_id = (int)$w['user_id'];
      $type    = $w['type'];
      $amtUnitsWithdraw = (int)$w['amt']; // v jednotkách withdrawals (cents/eur)

      if ($decision === 'approve') {
        // nič neodpočítavaj – už bolo strhnuté pri vytvorení žiadosti
        $u = $db->prepare("UPDATE withdrawals SET status='approved', processed_at=NOW(), admin_id=? WHERE id=?");
        $u->execute([$admin_id, $id]);
        $db->commit();
        json_ok(['id'=>$id,'status'=>'approved']);
      }

      // decision === 'reject' -> vráť späť
      // prepočítaj na jednotky balances
      if ($balancesAreCents && !$withdrawalsAreCents) {
        $refund = $amtUnitsWithdraw * 100;
      } elseif (!$balancesAreCents && $withdrawalsAreCents) {
        $refund = (int)round($amtUnitsWithdraw / 100);
      } else {
        $refund = $amtUnitsWithdraw;
      }

      // zamkni balances riadok
      $bs = $db->prepare("SELECT $colMain AS m, $colBonus AS b FROM balances WHERE user_id=? FOR UPDATE");
      $bs->execute([$user_id]);
      $bal = $bs->fetch();
      if (!$bal) { $db->rollBack(); json_error('Balance row missing', 500); }

      if ($type === 'main') {
        $newMain = ((int)$bal['m']) + $refund;
        $upd = $db->prepare("UPDATE balances SET $colMain = ? WHERE user_id = ?");
        $upd->execute([$newMain, $user_id]);
      } else {
        $newBonus = ((int)$bal['b']) + $refund;
        $upd = $db->prepare("UPDATE balances SET $colBonus = ? WHERE user_id = ?");
        $upd->execute([$newBonus, $user_id]);
      }

      // označ zamietnuté
      $u = $db->prepare("UPDATE withdrawals SET status='rejected', processed_at=NOW(), admin_id=? WHERE id=?");
      $u->execute([$admin_id, $id]);

      $db->commit();
      json_ok(['id'=>$id,'status'=>'rejected']);

    } catch (Throwable $e) {
      if ($db->inTransaction()) $db->rollBack();
      error_log('withdrawals.php POST error: ' . $e->getMessage());
      json_error('Server error', 500);
    }
  }

  json_error('Method not allowed', 405);

} catch (Throwable $e) {
  error_log('withdrawals.php fatal: ' . $e->getMessage());
  json_error('Server error', 500);
}
