' Wake-on-LAN Agent - Silent Background Launcher
' Double-click this file to start the server in the background

Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Path to the executable
exePath = scriptDir & "\rushbee-wol-agent-win.exe"

' Check if executable exists
If Not fso.FileExists(exePath) Then
    MsgBox "Error: rushbee-wol-agent-win.exe not found" & vbCrLf & vbCrLf & _
           "Expected location: " & scriptDir, vbCritical, "WoL Agent - Error"
    WScript.Quit 1
End If

' Check if already running and kill it
On Error Resume Next
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set processes = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'rushbee-wol-agent-win.exe'")
For Each process In processes
    process.Terminate()
    WScript.Sleep 500
Next
On Error Goto 0

' Run the executable hidden (0 = hidden, no console window)
objShell.Run Chr(34) & exePath & Chr(34), 0, False

' Optional: Show success message (comment out if you don't want it)
' MsgBox "WoL Agent started successfully in background", vbInformation, "WoL Agent"

WScript.Quit
