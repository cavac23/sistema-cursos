$base = 'http://localhost:3001'
$results = @()

function Test-Api {
  param($Name, $ScriptBlock)
  try {
    & $ScriptBlock
    $script:results += [pscustomobject]@{ Prueba = $Name; Resultado = 'OK'; Detalle = '' }
  } catch {
    $script:results += [pscustomobject]@{ Prueba = $Name; Resultado = 'FAIL'; Detalle = $_.Exception.Message }
  }
}

function Invoke-SessionLogin {
  param($Correo, $Contrasena)
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = @{ correo = $Correo; contrasena = $Contrasena } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "$base/api/login" -Method POST -Body $body -ContentType 'application/json' -WebSession $session
  return @{ Session = $session; Data = ($r.Content | ConvertFrom-Json) }
}

Test-Api 'Login instructor' {
  $login = Invoke-SessionLogin 'instructor@test.com' 'Test1234'
  if ($login.Data.usuario.rol -ne 'instructor') { throw 'Rol incorrecto' }
}

Test-Api 'Dashboard admin bloqueado para instructor' {
  $login = Invoke-SessionLogin 'instructor@test.com' 'Test1234'
  try {
    Invoke-WebRequest -Uri "$base/api/dashboard/admin" -WebSession $login.Session | Out-Null
    throw 'Debió devolver 403'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw $_ }
  }
}

Test-Api 'PDF general bloqueado para instructor' {
  $login = Invoke-SessionLogin 'instructor@test.com' 'Test1234'
  try {
    Invoke-WebRequest -Uri "$base/api/reportes/general/pdf" -WebSession $login.Session | Out-Null
    throw 'Debió devolver 403'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw $_ }
  }
}

Test-Api 'Reportes instructor solo sus cursos' {
  $login = Invoke-SessionLogin 'instructor@test.com' 'Test1234'
  $r = Invoke-WebRequest -Uri "$base/api/reportes/cursos" -WebSession $login.Session
  $data = $r.Content | ConvertFrom-Json
  if (-not $data.ok) { throw 'Respuesta no ok' }
}

Test-Api 'Excel general instructor' {
  $login = Invoke-SessionLogin 'instructor@test.com' 'Test1234'
  $r = Invoke-WebRequest -Uri "$base/api/reportes/cursos/excel" -WebSession $login.Session
  if ($r.Headers['Content-Type'] -notlike '*spreadsheet*') { throw 'Content-Type incorrecto' }
  if ($r.RawContentLength -lt 1000) { throw 'Archivo muy pequeño' }
}

Test-Api 'Login estudiante' {
  $login = Invoke-SessionLogin 'estudiante@test.com' 'Test1234'
  if ($login.Data.usuario.rol -ne 'estudiante') { throw 'Rol incorrecto' }
}

Test-Api 'Reportes bloqueados para estudiante' {
  $login = Invoke-SessionLogin 'estudiante@test.com' 'Test1234'
  try {
    Invoke-WebRequest -Uri "$base/api/reportes/cursos" -WebSession $login.Session | Out-Null
    throw 'Debió devolver 403'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw $_ }
  }
}

Test-Api 'Login administrador' {
  $login = Invoke-SessionLogin 'admin@test.com' 'Test1234'
  if ($login.Data.usuario.rol -ne 'administrador') { throw "Rol actual: $($login.Data.usuario.rol)" }
  $script:adminSession = $login.Session
}

if ($script:adminSession) {
  Test-Api 'Dashboard administrador' {
    $r = Invoke-WebRequest -Uri "$base/api/dashboard/admin" -WebSession $script:adminSession
    $data = $r.Content | ConvertFrom-Json
    if (-not $data.ok) { throw 'Respuesta no ok' }
    if ($null -eq $data.totalUsuariosActivos) { throw 'Falta totalUsuariosActivos' }
  }

  Test-Api 'PDF general administrador' {
    $r = Invoke-WebRequest -Uri "$base/api/reportes/general/pdf" -WebSession $script:adminSession
    if ($r.Headers['Content-Type'] -notlike '*pdf*') { throw 'Content-Type incorrecto' }
    if ($r.RawContentLength -lt 500) { throw 'PDF muy pequeño' }
  }

  Test-Api 'Reportes admin todos los cursos' {
    $loginInst = Invoke-SessionLogin 'instructor@test.com' 'Test1234'
    $rInst = Invoke-WebRequest -Uri "$base/api/reportes/cursos" -WebSession $loginInst.Session
    $inst = ($rInst.Content | ConvertFrom-Json).cursos.Count
    $rAdmin = Invoke-WebRequest -Uri "$base/api/reportes/cursos" -WebSession $script:adminSession
    $admin = ($rAdmin.Content | ConvertFrom-Json).cursos.Count
    if ($admin -lt $inst) { throw "Admin ($admin) debería ver >= cursos que instructor ($inst)" }
  }
}

$results | Format-Table -AutoSize
$fail = $results | Where-Object Resultado -eq 'FAIL'
if ($fail) { exit 1 }
