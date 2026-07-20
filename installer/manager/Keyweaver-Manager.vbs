' Silent launcher — no PowerShell console window.
' Syncs from keyweaver.io then opens Keyweaver-Manager.exe.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("Wscript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
ps = sh.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
script = dir & "\Keyweaver-Manager-Launcher.ps1"
cmd = """" & ps & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & script & """"

On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set startup = wmi.Get("Win32_ProcessStartup")
Set config = startup.SpawnInstance_
config.ShowWindow = 0
pid = 0
result = wmi.Get("Win32_Process").Create(cmd, dir, config, pid)
On Error GoTo 0

If result <> 0 Then
  sh.Run cmd, 0, False
End If
