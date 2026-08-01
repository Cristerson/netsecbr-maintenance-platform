<?php
declare(strict_types=1);

/*
 * Executado pelo Cron Job da HostGator uma vez por dia.
 * O arquivo keepalive-config.php deve ficar fora de public_html e não entra no Git.
 */

$config = require __DIR__ . '/../private/keepalive-config.php';

$endpoint = rtrim($config['supabase_url'], '/') . '/rest/v1/rpc/keep_alive';
$headers = [
    'apikey: ' . $config['supabase_anon_key'],
    'Authorization: Bearer ' . $config['supabase_anon_key'],
    'Content-Type: application/json',
];

$request = curl_init($endpoint);
curl_setopt_array($request, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => '{}',
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
]);

$body = curl_exec($request);
$status = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
$error = curl_error($request);
curl_close($request);

if ($body === false || $status < 200 || $status >= 300) {
    error_log(sprintf('Supabase keep-alive falhou: HTTP %d %s', $status, $error));
    exit(1);
}

echo sprintf("Supabase keep-alive executado: %s\n", gmdate('c'));
