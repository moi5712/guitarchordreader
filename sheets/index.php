<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

$sheetsDir = __DIR__;
$sheets = [];

// 掃描目錄中的 .txt 和 .gtab 檔案
$files = glob($sheetsDir . '/*.{txt,gtab}', GLOB_BRACE);

foreach ($files as $file) {
    if (is_file($file)) {
        $filename = basename($file);
        $content = file_get_contents($file);
        
        // 解析 meta 資訊
        $meta = [];
        $lines = explode("\n", $content);
        foreach ($lines as $line) {
            $line = trim($line);
            if (strpos($line, '#') === 0) {
                if (preg_match('/^#(\w+):\s*(.*)$/', $line, $matches)) {
                    $meta[$matches[1]] = $matches[2];
                }
            } else {
                break; // 遇到非 meta 行就停止
            }
        }
        
        $sheets[] = [
            'filename' => $filename,
            'title' => isset($meta['title']) ? $meta['title'] : pathinfo($filename, PATHINFO_FILENAME),
            'artist' => isset($meta['artist']) ? $meta['artist'] : '',
            'key' => isset($meta['key']) ? $meta['key'] : '',
            'bpm' => isset($meta['bpm']) ? $meta['bpm'] : '',
            'capo' => isset($meta['capo']) ? $meta['capo'] : '',
            'content' => $content,
            'lastModified' => filemtime($file),
            'size' => filesize($file)
        ];
    }
}

// 按檔案名排序
usort($sheets, function($a, $b) {
    return strcmp($a['filename'], $b['filename']);
});

echo json_encode([
    'success' => true,
    'count' => count($sheets),
    'sheets' => $sheets
], JSON_UNESCAPED_UNICODE);
?>
