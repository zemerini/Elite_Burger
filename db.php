<?php
// db.php - Dynamische Datenbankverbindung (Lokales Testen vs. Ionos Server)

// Erkennen, ob die Seite lokal über localhost aufgerufen wird
$is_localhost = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1']) 
             || in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1']);

if ($is_localhost) {
    // Lokale Testdaten für XAMPP
    $host = '127.0.0.1';
    $db   = 'dbs15777005'; // Name deiner lokalen Datenbank (in HeidiSQL erstellen)
    $user = 'root';
    $pass = '';           // Bei XAMPP standardmäßig leer
    $port = '3306';
} else {
    // Live-Zugangsdaten von Ionos
    $host = 'db5020669638.hosting-data.io';
    $db   = 'dbs15777005';
    $user = 'dbu3079816';
    $pass = 'AS4NOa:Elits0W-1859!Qyutaslc@';
    $port = '3306';
}

$charset = 'utf8mb4';
$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    die("Datenbankverbindung fehlgeschlagen: " . $e->getMessage());
}
?>
