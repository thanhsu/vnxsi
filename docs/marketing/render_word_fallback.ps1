param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$PdfPath
)

$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open((Resolve-Path -LiteralPath $InputPath).Path, $false, $true)
  # WdExportFormat.wdExportFormatPDF = 17; WdExportOptimizeFor.wdExportOptimizeForPrint = 0.
  $pdfAbsolute = [IO.Path]::GetFullPath($PdfPath)
  $document.ExportAsFixedFormat($pdfAbsolute, 17, $false, 0)
}
finally {
  if ($null -ne $document) {
    $document.Close($false)
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document)
  }
  if ($null -ne $word) {
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
