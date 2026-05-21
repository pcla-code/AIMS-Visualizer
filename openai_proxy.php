<?php
// /aims/openai_proxy.php
// Minimal OpenAI proxy for testing (POST only).
// IMPORTANT: delete after testing, or lock it down.

header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed"]);
  exit;
}

$raw = file_get_contents("php://input");
$body = json_decode($raw, true);

$apiKey = $body["apiKey"] ?? "";
$text   = $body["text"] ?? "";
$maxOut = isset($body["max_output_tokens"]) ? (int)$body["max_output_tokens"] : 320;
$temp   = isset($body["temperature"]) ? (float)$body["temperature"] : 0.2;

if ($maxOut < 64)   $maxOut = 64;
if ($maxOut > 1200) $maxOut = 1200;

if (!$apiKey || !$text) {
  http_response_code(400);
  echo json_encode(["error" => "Missing apiKey or text"]);
  exit;
}

$payload = [
  "model" => "gpt-4.1-mini",
  "input" => $text,
  "temperature" => $temp,
  "max_output_tokens" => $maxOut
];

$ch = curl_init("https://api.openai.com/v1/responses");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . $apiKey,
    "Content-Type: application/json"
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_TIMEOUT => 60,
]);

$res = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($err) {
  http_response_code(500);
  echo json_encode(["error" => "cURL error", "detail" => $err]);
  exit;
}

http_response_code($code);
echo $res;