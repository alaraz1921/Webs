# Copia lógica de solo lectura. Contraseña introducida por el usuario en un formulario local.
# No migra, no restaura, no cambia contraseñas ni permisos remotos.
[CmdletBinding()]
param(
 [Parameter(Mandatory)][string]$ToolsDirectory,
 [string]$OutputRoot=(Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'FinTin\Backups\TrackTin-FinTin'),
 [string]$ResultFile=(Join-Path ([IO.Path]::GetTempPath()) 'FinTin-backup-result.json')
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$hostName='aws-1-eu-west-2.pooler.supabase.com'
$databaseUser='postgres.nxuqkvuvmllqihaefjky'
$result=[ordered]@{status='pending';phase='initialization';passwordRequested=$false;project='nxuqkvuvmllqihaefjky';started=(Get-Date).ToUniversalTime().ToString('o')}
function Save-Result { $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ResultFile -Encoding utf8 }
function Run-Postgres([string]$Executable,[string[]]$Arguments) {
 $start=[Diagnostics.ProcessStartInfo]::new()
 $start.FileName=Join-Path $ToolsDirectory $Executable
 $start.UseShellExecute=$false; $start.CreateNoWindow=$true
 $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
 foreach($argument in $Arguments){[void]$start.ArgumentList.Add($argument)}
 $start.Environment['PGHOST']=$hostName
 $start.Environment['PGPORT']='5432'
 $start.Environment['PGDATABASE']='postgres'
 $start.Environment['PGUSER']=$databaseUser
 $start.Environment['PGSSLMODE']='require'
 $start.Environment['PGCONNECT_TIMEOUT']='20'
 $start.Environment['PGOPTIONS']='-c default_transaction_read_only=on'
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($script:securePassword)
 try {$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer);$start.Environment['PGPASSWORD']=$plain}
 finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 $process=[Diagnostics.Process]::new();$process.StartInfo=$start
 try {
  [void]$process.Start();[void]$start.Environment.Remove('PGPASSWORD')
  $outTask=$process.StandardOutput.ReadToEndAsync();$errTask=$process.StandardError.ReadToEndAsync()
  while(-not $process.WaitForExit(200)){[Windows.Forms.Application]::DoEvents()}
  $outText=$outTask.GetAwaiter().GetResult();$errText=$errTask.GetAwaiter().GetResult()
  if($process.ExitCode -ne 0){throw ($errText.Replace($plain,'[REDACTADO]'))}
  return $outText
 } finally {$plain=$null;[void]$start.Environment.Remove('PGPASSWORD');$process.Dispose()}
}
try {
 foreach($name in 'pg_dump.exe','pg_dumpall.exe','pg_restore.exe','psql.exe'){
  if(-not(Test-Path -LiteralPath (Join-Path $ToolsDirectory $name))){throw "Falta la herramienta $name"}
 }
 $result.phase='connectivity';Save-Result
 $reachable=$false
 foreach($address in [Net.Dns]::GetHostAddresses($hostName)){
  $tcp=[Net.Sockets.TcpClient]::new($address.AddressFamily)
  try{$attempt=$tcp.ConnectAsync($address,5432);if($attempt.Wait(4000) -and $tcp.Connected){$reachable=$true;break}}
  catch{}finally{$tcp.Dispose()}
 }
 if(-not $reachable){throw 'No se alcanza el pooler PostgreSQL por TCP/5432. No se ha solicitado la contraseña ni contactado con la base. Verifica la conectividad desde una red autorizada antes de repetir.'}
 $result.phase='credentials';$result.passwordRequested=$true;Save-Result
 $form=[Windows.Forms.Form]::new();$form.Text='FinTin · Copia previa de Supabase';$form.Width=580;$form.Height=270
 $form.StartPosition='CenterScreen';$form.TopMost=$true;$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.MinimizeBox=$false
 $label=[Windows.Forms.Label]::new();$label.SetBounds(20,18,530,85)
 $label.Text="Proyecto compartido con TrackTin: nxuqkvuvmllqihaefjky`nIntroduce la contraseña de PostgreSQL (no la clave pública).`nSe utilizará solo en memoria para una copia de solo lectura."
 $form.Controls.Add($label)
 $password=[Windows.Forms.TextBox]::new();$password.SetBounds(20,110,525,30);$password.UseSystemPasswordChar=$true;$form.Controls.Add($password)
 $ok=[Windows.Forms.Button]::new();$ok.Text='Crear copia';$ok.SetBounds(310,160,115,32);$ok.DialogResult=[Windows.Forms.DialogResult]::OK;$form.Controls.Add($ok)
 $cancel=[Windows.Forms.Button]::new();$cancel.Text='Cancelar';$cancel.SetBounds(435,160,110,32);$cancel.DialogResult=[Windows.Forms.DialogResult]::Cancel;$form.Controls.Add($cancel)
 $form.AcceptButton=$ok;$form.CancelButton=$cancel
 $form.Add_Shown({$password.Focus()})
 $choice=$form.ShowDialog()
 if($choice -ne [Windows.Forms.DialogResult]::OK){$result.status='cancelled';Save-Result;exit 2}
 if([string]::IsNullOrEmpty($password.Text)){throw 'La contraseña está vacía; no se ha conectado a la base.'}
 $script:securePassword=ConvertTo-SecureString $password.Text -AsPlainText -Force
 $password.Clear();$form.Dispose()
 $progress=[Windows.Forms.Form]::new();$progress.Text='FinTin · Creando copia';$progress.Width=550;$progress.Height=150;$progress.StartPosition='CenterScreen';$progress.TopMost=$true
 $progress.ControlBox=$false
 $progressLabel=[Windows.Forms.Label]::new();$progressLabel.SetBounds(20,20,500,70);$progressLabel.Text='Creando copia local de solo lectura. No se ejecutará ninguna migración desde este proceso.';$progress.Controls.Add($progressLabel);$progress.Show();[Windows.Forms.Application]::DoEvents()
 $result.phase='identity';Save-Result
 $identity=Run-Postgres 'psql.exe' @('--no-password','--no-psqlrc','--tuples-only','--no-align','--command',"SELECT current_database()||'|'||current_setting('server_version')||'|'||(to_regclass('public.tracktin_media') IS NOT NULL)::text")
 if($identity.Trim() -notmatch '^postgres\|17\.[^|]+\|true$'){throw 'La comprobación del servidor o de TrackTin no coincide; no se ha creado la copia.'}
 $destination=Join-Path $OutputRoot ((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
 [void][IO.Directory]::CreateDirectory($destination)
 $dumpPath=Join-Path $destination 'database.dump';$rolesPath=Join-Path $destination 'roles-sin-passwords.sql'
 $result.directory=$destination;$result.server=$identity.Trim();Save-Result
 $result.phase='dump';Save-Result
 [void](Run-Postgres 'pg_dump.exe' @('--no-password','--format=custom','--lock-wait-timeout=10s','--file',$dumpPath))
 [void](Run-Postgres 'pg_dumpall.exe' @('--no-password','--database=postgres','--roles-only','--no-role-passwords','--file',$rolesPath))
 $result.phase='verification';Save-Result
 $toc=Run-Postgres 'pg_restore.exe' @('--list',$dumpPath)
 if($toc -notmatch 'tracktin_media'){throw 'El índice de la copia no contiene la tabla esperada de TrackTin.'}
 # Recorre y descomprime todo el archivo sin ejecutar el SQL ni generar otra copia con datos.
 [void](Run-Postgres 'pg_restore.exe' @('--file=NUL',$dumpPath))
 $files=@($dumpPath,$rolesPath)|ForEach-Object{[ordered]@{file=[IO.Path]::GetFileName($_);bytes=(Get-Item -LiteralPath $_).Length;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash}}
 if(($files|Where-Object{$_.bytes -eq 0}).Count){throw 'Se ha generado un archivo vacío.'}
 $result.status='verified';$result.completed=(Get-Date).ToUniversalTime().ToString('o');$result.files=$files
 $result.verification='pg_restore --list y lectura/descompresión completa; no se ha ensayado una restauración en servidor.'
 $result.scope='Copia lógica de base y roles sin contraseñas; incluye metadatos Storage, no los archivos de Storage.'
 $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
 Save-Result
} catch {
 $result.status='failed';$result.error=$_.Exception.Message;Save-Result
 Write-Warning ('No se ha completado la copia. No se ha ejecutado ninguna migración. Resultado: '+$ResultFile)
 exit 1
} finally {
 if($progress){$progress.Dispose()}
 if($script:securePassword){$script:securePassword.Dispose()}
}
