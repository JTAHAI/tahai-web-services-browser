; PASS40 installer include
; Only repair icons on shortcuts that the default installer created.
; This preserves Electron Builder's assisted installer behavior, including the Desktop shortcut checkbox.

!macro customInstall
  DetailPrint "TAHAI: refreshing installed shortcut icons"

  IfFileExists "$SMPROGRAMS\TAHAI Web Services Browser.lnk" 0 +2
    CreateShortCut "$SMPROGRAMS\TAHAI Web Services Browser.lnk" "$INSTDIR\TAHAI Web Services Browser.exe" "" "$INSTDIR\TAHAI Web Services Browser.exe" 0 SW_SHOWNORMAL "" "TAHAI Web Services Browser"

  IfFileExists "$DESKTOP\TAHAI Web Services Browser.lnk" 0 +2
    CreateShortCut "$DESKTOP\TAHAI Web Services Browser.lnk" "$INSTDIR\TAHAI Web Services Browser.exe" "" "$INSTDIR\TAHAI Web Services Browser.exe" 0 SW_SHOWNORMAL "" "TAHAI Web Services Browser"

  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\TAHAI Web Services Browser.lnk"
  Delete "$DESKTOP\TAHAI Web Services Browser.lnk"
!macroend
