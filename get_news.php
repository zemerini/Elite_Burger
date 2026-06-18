<?php
// get_news.php - News-Einträge als JSON ausgeben

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Ermöglicht lokales Testen von anderen Ports/Ursprüngen aus

require_once 'db.php';

try {
    // Abrufen aller News sortiert nach Erstellungsdatum (neueste zuerst)
    $stmt = $pdo->query('SELECT id, title, badge, news_date, content FROM news ORDER BY created_at DESC');
    $news = $stmt->fetchAll();
    
    echo json_encode($news, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Fehler beim Laden der Neuigkeiten.',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
