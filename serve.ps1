$prefix = 'http://127.0.0.1:8000/'
$root = Join-Path $PSScriptRoot ''
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Serving $root on http://localhost:8000/"
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  $urlPath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
  if ($urlPath -eq '/' -or $urlPath -eq '') { $file = Join-Path $root 'index.html' } else { $rel = $urlPath.TrimStart('/').Replace('/','\\'); $file = Join-Path $root $rel }
  if (Test-Path $file) {
    try {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      switch ($ext) {
        '.html' { $res.ContentType = 'text/html; charset=utf-8' }
        '.js' { $res.ContentType = 'application/javascript; charset=utf-8' }
        '.css' { $res.ContentType = 'text/css; charset=utf-8' }
        '.json' { $res.ContentType = 'application/json; charset=utf-8' }
        '.png' { $res.ContentType = 'image/png' }
        '.jpg' { $res.ContentType = 'image/jpeg' }
        default { $res.ContentType = 'application/octet-stream' }
      }
      $res.OutputStream.Write($bytes,0,$bytes.Length)
    } catch {
      $res.StatusCode = 500
      $msg = 'Internal Server Error'
      $buf = [System.Text.Encoding]::UTF8.GetBytes($msg)
      $res.OutputStream.Write($buf,0,$buf.Length)
    }
  } else {
    $res.StatusCode = 404
    $msg = 'Not Found'
    $buf = [System.Text.Encoding]::UTF8.GetBytes($msg)
    $res.OutputStream.Write($buf,0,$buf.Length)
  }
  $res.OutputStream.Close()
}
$listener.Stop()
Write-Output 'Server stopped.'
