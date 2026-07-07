Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*server.js*' } |
  ForEach-Object {
    Write-Output "Deteniendo PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
Start-Sleep -Seconds 2
Set-Location $PSScriptRoot\..
Remove-Item Env:PORT -ErrorAction SilentlyContinue
node server.js
