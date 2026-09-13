param(
  [string]$WorkerName = 'ffai'
)

$securePayload = Read-Host 'Cloudflare secrets JSON' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePayload)
$payload = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)

if ([string]::IsNullOrWhiteSpace($payload)) {
  throw 'Expected one JSON line.'
}

$tempPath = Join-Path ([IO.Path]::GetTempPath()) ("ffai-secrets-{0}.json" -f [guid]::NewGuid().ToString('N'))

try {
  [IO.File]::WriteAllText($tempPath, $payload, [Text.UTF8Encoding]::new($false))
  & pnpm.cmd wrangler secret bulk $tempPath --name $WorkerName
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler secret upload failed with exit code $LASTEXITCODE."
  }
}
finally {
  $payload = $null
  Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
}
