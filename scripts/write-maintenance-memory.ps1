param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
python "$ScriptDir/write_maintenance.py" memory @Args
exit $LASTEXITCODE

