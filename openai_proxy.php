<?php
// /aims/openai_proxy.php
//
// OpenAI proxy for the AIMS Visualizer's AI Summary feature.
//
// Two modes (see README.md "API key & the OpenAI proxy"):
//   1) DEFAULT (safe, recommended for production):
//      The OpenAI key is read from the OPENAI_API_KEY environment variable
//      on the PHP host. The browser never sees the key.
//   2) DEV MODE (local testing only):
//      Set DEV_ALLOW_CLIENT_KEY to true below AND paste a key into
//      OPENAI_API_KEY in visualizer.js. The browser will send the key in
//      the request body. Do NOT deploy this configuration.

// Flip to true ONLY for local development. Leave false in production.
const DEV_ALLOW_CLIENT_KEY = false;

header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed"]);
  exit;
}

$raw = file_get_contents("php://input");
$body = json_decode($raw, true);

$text   = $body["text"] ?? "";
$maxOut = isset($body["max_output_tokens"]) ? (int)$body["max_output_tokens"] : 320;
$temp   = isset($body["temperature"]) ? (float)$body["temperature"] : 0.2;

if ($maxOut < 64)   $maxOut = 64;
if ($maxOut > 1200) $maxOut = 1200;

// Resolve API key: env var first, client-supplied only if dev mode is on.
$apiKey = getenv("OPENAI_API_KEY") ?: "";
if ($apiKey === "" && DEV_ALLOW_CLIENT_KEY) {
  $apiKey = $body["apiKey"] ?? "";
}

if (!$apiKey) {
  http_response_code(500);
  echo json_encode([
    "error" => "Server-side OPENAI_API_KEY not configured. " .
               "Set OPENAI_API_KEY on the PHP host, or enable dev mode " .
               "(DEV_ALLOW_CLIENT_KEY = true) for local testing."
  ]);
  exit;
}

if (!$text) {
  http_response_code(400);
  echo json_encode(["error" => "Missing text"]);
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
