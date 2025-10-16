<?php
require_once __DIR__ . '/config.php';
require_login_json();

try {
  $db = pdo();
  $user_id = (int)$_SESSION['user_id'];
  ensure_balances_row($user_id);

  // --- detekcia stĺpcov pre balances (cents vs euros) ---
  $colMain  = 'main_cents';
  $colBonus = 'bonus_cents';
  $chk = $db->query("SHOW COLUMNS FROM balances LIKE 'main_cents'")->fetch();
  if (!$chk) { $colMain = 'main'; $colBonus = 'bonus'; }
  $balancesAreCents = ($colMain === 'main_cents');

  // --- detekcia stĺpca pre withdrawals (cents vs euros) ---
  $amountCol = 'amount_cents';
  $chk2 = $db->query("SHOW COLUMNS FROM withdrawals LIKE 'amount_cents'")->fetch();
  if (!$chk2) { $amountCol = 'amount'; }
  $withdrawalsAreCents = ($amountCol === 'amount_cents');

  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

  // ----------------------- GET -----------------------
  if ($method === 'GET') {
    $include = $_GET['include'] ?? '';

    $st = $db->prepare("SELECT IFNULL($colMain,0) AS m, IFNULL($colBonus,0) AS b FROM balances WHERE user_id=?");
    $st->execute([$user_id]);
    $b = $st->fetch() ?: ['m'=>0,'b'=>0];

    $out = [
      'main'  => $balancesAreCents ? round(((int)$b['m'])/100, 2) : (float)$b['m'],
      'bonus' => $balancesAreCents ? round(((int)$b['b'])/100, 2) : (float)$b['b'],
    ];

    if ($include === 'my_withdrawals') {
      $t = $db->query("SHOW TABLES LIKE 'withdrawals'")->fetch();
      if ($t) {
        $w = $db->prepare("SELECT id, type, $amountCol AS amt, status, created_at FROM withdrawals WHERE user_id=? ORDER BY created_at DESC");
        $w->execute([$user_id]);
        $rows = [];
        while ($r = $w->fetch()) {
          $rows[] = [
            'id'         => (int)$r['id'],
            'type'       => $r['type'],
            'amount'     => $withdrawalsAreCents ? round(((int)$r['amt'])/100, 2) : (float)$r['amt'],
            'status'     => $r['status'],
            'created_at' => $r['created_at'],
          ];
        }
        $out['withdrawals'] = $rows;
      }
    }

    json_ok($out);
  }

  // ----------------------- POST (redeem = hneď strhnúť) -----------------------
  if ($method === 'POST') {
    // over, že withdrawals tabuľka existuje
    $t = $db->query("SHOW TABLES LIKE 'withdrawals'")->fetch();
    if (!$t) json_error("Missing table 'withdrawals'.", 500);

    $input = read_json();
    $action = $input['action'] ?? '';
    $amount_eur = isset($input['amount']) ? (float)$input['amount'] : 0.0;
    if (!in_array($action, ['redeem_main','redeem_bonus'], true)) json_error('Neznáma akcia');
    if ($amount_eur <= 0) json_error('Chýba alebo je neplatná suma "amount"');

    $type = ($action === 'redeem_main') ? 'main' : 'bonus';
    $min_eur = ($type === 'main') ? 200 : 20;

    // prepočítaj na jednotky zostatku
    $amountUnitsForBalance = $balancesAreCents ? (int)round($amount_eur * 100) : (int)round($amount_eur);
    $amountUnitsForWithdraw = $withdrawalsAreCents ? (int)round($amount_eur * 100) : (int)round($amount_eur);

    if ($amount_eur < $min_eur) json_error('Suma je nižšia ako minimum pre uplatnenie');

    try {
      $db->beginTransaction();

      // zamkni riadok so zostatkom
      $st = $db->prepare("SELECT $colMain AS m, $colBonus AS b FROM balances WHERE user_id=? FOR UPDATE");
      $st->execute([$user_id]);
      $bal = $st->fetch();
      if (!$bal) { $db->rollBack(); json_error('Balance row missing', 500); }

      $curMain  = (int)$bal['m'];
      $curBonus = (int)$bal['b'];

      $available = ($type === 'main') ? $curMain : $curBonus;
      if ($amountUnitsForBalance > $available) { $db->rollBack(); json_error('Nedostatočný zostatok'); }

      // --- OKAMŽITÉ STRHNUTIE ---
      if ($type === 'main') {
        $newMain = $curMain - $amountUnitsForBalance;
        $upd = $db->prepare("UPDATE balances SET $colMain = ? WHERE user_id = ?");
        $upd->execute([$newMain, $user_id]);
      } else {
        $newBonus = $curBonus - $amountUnitsForBalance;
        $upd = $db->prepare("UPDATE balances SET $colBonus = ? WHERE user_id = ?");
        $upd->execute([$newBonus, $user_id]);
      }

      // zapíš pending withdrawal (už strhnuté)
      if ($withdrawalsAreCents) {
        $ins = $db->prepare("INSERT INTO withdrawals (user_id, type, amount_cents, status, created_at) VALUES (?,?,?,?,NOW())");
        $ins->execute([$user_id, $type, $amountUnitsForWithdraw, 'pending']);
      } else {
        $ins = $db->prepare("INSERT INTO withdrawals (user_id, type, amount, status, created_at) VALUES (?,?,?,?,NOW())");
        $ins->execute([$user_id, $type, $amountUnitsForWithdraw, 'pending']);
      }
      $pending_id = (int)$db->lastInsertId();

      $db->commit();

      json_ok([
        'pending_id' => $pending_id,
        'type'       => $type,
        'amount'     => $amount_eur,
        'status'     => 'pending',
        'message'    => 'Suma bola z účtu strhnutá a žiadosť odoslaná na spracovanie.'
      ], 201);

    } catch (Throwable $e) {
      if ($db->inTransaction()) $db->rollBack();
      error_log('balances.php POST (deduct now) error: ' . $e->getMessage());
      json_error('Server error', 500);
    }
  }

  json_error('Method not allowed', 405);

} catch (Throwable $e) {
  error_log('balances.php fatal: ' . $e->getMessage());
  json_error('Server error', 500);
}
