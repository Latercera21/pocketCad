# Servidor HTTP local para la pagina web de Sparrow.
# Se usa desde Iniciar.bat (no hace falta instalar nada: usa PowerShell, que
# viene con Windows). Sirve los archivos de esta misma carpeta y abre el navegador.
$ErrorActionPreference = "Stop"

$carpeta = $PSScriptRoot      # carpeta donde esta este script
$puerto  = 8080

# Buscar un puerto libre si el 8080 esta ocupado
function PuertoLibre([int]$intento) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $p = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    return $p
}

$enUso = $true
while ($enUso) {
    try {
        $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $puerto)
        $l.Start()
        $l.Stop()
        $enUso = $false
    } catch {
        $puerto = PuertoLibre
    }
}

$url = "http://localhost:$puerto/index.html"

# Abrir el navegador
Start-Process $url

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".css"  = "text/css"
    ".svg"  = "image/svg+xml"
    ".txt"  = "text/plain; charset=utf-8"
    ".wasm" = "application/wasm"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$puerto/")
$listener.Start()
Write-Host "Sirviendo $carpeta en $url — cerrá esta ventana para detener."

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch {
        break
    }
    $req = $ctx.Request
    $res = $ctx.Response

    $ruta = $req.Url.LocalPath
    if ($ruta -eq "/") { $ruta = "/index.html" }

    # Seguridad: nada fuera de esta carpeta (evita ..)
    $candidato = [System.IO.Path]::GetFullPath((Join-Path $carpeta $ruta.TrimStart('/')))
    $base = [System.IO.Path]::GetFullPath($carpeta)
    if (-not $candidato.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) { $res.StatusCode = 403; $res.Close(); continue }

    $ext = [System.IO.Path]::GetExtension($candidato).ToLower()
    try {
        $bytes = [System.IO.File]::ReadAllBytes($candidato)
        if ($mime.ContainsKey($ext)) {
            $res.ContentType = $mime[$ext]
        } else {
            $res.ContentType = 'application/octet-stream'
        }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        $res.StatusCode = 404
    }
    $res.Close()
}
