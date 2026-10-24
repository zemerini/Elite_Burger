<?php
// Gibt alle News als JSON aus (für den Bereich "News & Aktuelles").

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Erlaubt Tests von anderen lokalen Ports

require_once 'db.php';

try {
    $stmt = $pdo->query('SELECT id, title, badge, news_date, content FROM news ORDER BY created_at DESC');
    echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Details nur ins Server-Log, nicht an Besucher
    error_log('News-Fehler: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Fehler beim Laden der Neuigkeiten.'], JSON_UNESCAPED_UNICODE);
}
