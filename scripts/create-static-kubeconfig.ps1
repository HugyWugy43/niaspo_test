# Static kubeconfig for CI (no exec/yc). Run from repo root.
# Output: static-kubeconfig.yaml -> base64 -> GitHub secret KUBE_CONFIG_B64

param(
    [string]$OutFile = "static-kubeconfig.yaml"
)

$ErrorActionPreference = "Stop"

$k8sDir = Join-Path (Split-Path -Parent $PSScriptRoot) "k8s"
$saYaml = Join-Path $k8sDir "sa-for-ci.yaml"

if (-not (Test-Path $saYaml)) {
    Write-Error "File not found: $saYaml"
}

Write-Host "Applying k8s/sa-for-ci.yaml..."
kubectl apply -f $saYaml
Start-Sleep -Seconds 5

Write-Host "Getting token..."
$tokenB64 = kubectl get secret ci-deploy-token -n kube-system -o jsonpath='{.data.token}' 2>$null
if (-not $tokenB64) {
    Write-Error "Secret ci-deploy-token not found. Run script again or check: kubectl get secret -n kube-system"
}
$token = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($tokenB64))

# Read CA and server from kubeconfig file for cluster with 158.160.x (avoid JSON/encoding issues)
$configPath = if ($env:KUBECONFIG) { $env:KUBECONFIG } else { Join-Path $env:USERPROFILE ".kube\config" }
if (-not (Test-Path $configPath)) { Write-Error "Kubeconfig not found: $configPath" }
$lines = [System.IO.File]::ReadAllLines($configPath, [System.Text.Encoding]::UTF8)
$server = "https://158.160.154.219"
$targetLineIdx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'server:\s*(https://158\.160\.\d+\.\d+)') {
        $server = $matches[1].Trim()
        $targetLineIdx = $i
        break
    }
}
if ($targetLineIdx -lt 0) { Write-Error "Cluster with server 158.160.x not found in $configPath" }
# In this cluster block, certificate-authority-data is above server; find its line then read forward
$caStartIdx = -1
for ($i = $targetLineIdx - 1; $i -ge 0; $i--) {
    if ($lines[$i] -match 'certificate-authority-data:') {
        $caStartIdx = $i
        break
    }
}
if ($caStartIdx -lt 0) { Write-Error "certificate-authority-data not found before server line" }
$caLines = @()
if ($lines[$caStartIdx] -match 'certificate-authority-data:\s*(.*)') {
    $rest = $matches[1].Trim()
    if ($rest) { $caLines += $rest }
}
for ($i = $caStartIdx + 1; $i -lt $targetLineIdx; $i++) {
    $t = $lines[$i].Trim()
    if ($t -and $t -notmatch '^server:') { $caLines += $t }
}
$caB64 = ($caLines -join '') -replace '\s+', ''
if (-not $caB64) { Write-Error "Could not extract certificate-authority-data for $server from $configPath" }
$caDecoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($caB64))
if (-not ($caDecoded.StartsWith("-----BEGIN"))) { Write-Error "Decoded CA is not valid PEM (wrong base64?)" }

# Build kubeconfig: no quotes around CA (single line), UTF-8 no BOM
$staticConfig = "apiVersion: v1`nkind: Config`nclusters:`n- name: cluster`n  cluster:`n    server: $server`n    certificate-authority-data: $caB64`nusers:`n- name: ci-deploy`n  user:`n    token: $token`ncontexts:`n- name: default`n  context:`n    cluster: cluster`n    user: ci-deploy`ncurrent-context: default`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$outPath = Join-Path (Get-Location) $OutFile
[System.IO.File]::WriteAllText($outPath, $staticConfig, $utf8NoBom)
Write-Host "Saved: $outPath"
Write-Host ""
Write-Host "Test: kubectl --kubeconfig=$OutFile get ns"
Write-Host "Base64 for GitHub: [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content -Path '$outPath' -Raw)))"
