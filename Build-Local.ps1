param(
 [string]$GameRoot = (Join-Path $PSScriptRoot 'game'),
 [string]$Destination,
 [string]$ElectronZip,
 [string]$AndroidSdk = "$env:LOCALAPPDATA/Android/Sdk",
 [string]$JdkHome = 'C:/Program Files/Android/Android Studio/jbr',
 [string]$SigningKey,
 [string]$SigningPassFile
)
$ErrorActionPreference='Stop'
if (!$Destination -or !$ElectronZip -or !$SigningKey -or !$SigningPassFile) { throw 'Provide Destination, ElectronZip, SigningKey and SigningPassFile.' }
if (Test-Path -LiteralPath $Destination) { throw 'Use a fresh destination; existing deliverables are never overwritten.' }
$GameRoot=(Resolve-Path -LiteralPath $GameRoot).Path
$appVersion=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'desktop/package.json') -Encoding UTF8 -Raw | ConvertFrom-Json).version
$releaseVersion=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release/version.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$desktopVersion=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'desktop/package.json') -Encoding UTF8 -Raw | ConvertFrom-Json
if ($releaseVersion.version -ne $appVersion -or $releaseVersion.build -ne $desktopVersion.build) { throw 'Run node tools/sync-version.cjs before building.' }
$manifestSource=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'android/AndroidManifest.xml') -Encoding UTF8 -Raw
if ($manifestSource -notmatch ('android:versionName="'+[regex]::Escape($appVersion)+'"')) { throw 'Desktop and Android versions differ.' }
if ($manifestSource -notmatch ('android:versionCode="'+$releaseVersion.build+'"')) { throw 'Android build code differs.' }
if (!(Test-Path -LiteralPath (Join-Path $GameRoot 'build-info.js'))) { throw 'Missing packaged build metadata.' }
$buildTools=Join-Path $AndroidSdk 'build-tools/36.1.0'
$androidJar=Join-Path $AndroidSdk 'platforms/android-36.1/android.jar'
foreach ($required in @($ElectronZip,$SigningKey,$SigningPassFile,$androidJar,(Join-Path $JdkHome 'bin/javac.exe'),(Join-Path $buildTools 'aapt2.exe'))) { if (!(Test-Path -LiteralPath $required)) { throw "Missing build input: $required" } }
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$Destination=(Resolve-Path -LiteralPath $Destination).Path
$win=Join-Path $Destination 'Windows'
Expand-Archive -LiteralPath $ElectronZip -DestinationPath $win
Rename-Item -LiteralPath (Join-Path $win 'electron.exe') -NewName 'ZombossRise.exe'
$app=Join-Path $win 'resources/app'
New-Item -ItemType Directory -Path $app -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'desktop') -File | Where-Object { $_.Extension -eq '.cjs' -or $_.Name -eq 'package.json' } | Copy-Item -Destination $app
Copy-Item -LiteralPath $GameRoot -Destination (Join-Path $app 'game') -Recurse
$build=Join-Path $Destination 'android-build'
foreach ($dir in @('assets','res/drawable','classes','dex','generated')) { New-Item -ItemType Directory -Path (Join-Path $build $dir) -Force | Out-Null }
Copy-Item -LiteralPath $GameRoot -Destination (Join-Path $build 'assets/web') -Recurse
Copy-Item -LiteralPath (Join-Path $GameRoot 'assets/portraits/zomboss-head.png') -Destination (Join-Path $build 'res/drawable/app_icon.png')
& (Join-Path $buildTools 'aapt2.exe') compile --dir (Join-Path $build 'res') -o (Join-Path $build 'resources.zip')
if ($LASTEXITCODE) { throw 'Resource compilation failed' }
& (Join-Path $buildTools 'aapt2.exe') link -I $androidJar --manifest (Join-Path $PSScriptRoot 'android/AndroidManifest.xml') --min-sdk-version 26 --target-sdk-version 36 --auto-add-overlay --java (Join-Path $build 'generated') -A (Join-Path $build 'assets') -o (Join-Path $build 'unsigned.apk') (Join-Path $build 'resources.zip')
if ($LASTEXITCODE) { throw 'Resource linking failed' }
$javaSources=@(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'android/src') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
& (Join-Path $JdkHome 'bin/javac.exe') --release 8 -encoding UTF-8 -classpath $androidJar -d (Join-Path $build 'classes') @javaSources
if ($LASTEXITCODE) { throw 'Java compilation failed' }
$classFiles=@(Get-ChildItem -LiteralPath (Join-Path $build 'classes') -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
& (Join-Path $JdkHome 'bin/java.exe') -cp (Join-Path $buildTools 'lib/d8.jar') com.android.tools.r8.D8 --release --min-api 26 --lib $androidJar --output (Join-Path $build 'dex') @classFiles
if ($LASTEXITCODE) { throw 'DEX compilation failed' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk=[IO.Compression.ZipFile]::Open((Join-Path $build 'unsigned.apk'),[IO.Compression.ZipArchiveMode]::Update)
try {
 foreach ($entry in @($apk.Entries)) {
  if ($entry.FullName.Contains([char]92)) {
   $name=$entry.FullName.Replace([char]92,[char]47);$memory=[IO.MemoryStream]::new();$input=$entry.Open()
   try {$input.CopyTo($memory)} finally {$input.Dispose()}
   $entry.Delete();$target=$apk.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal).Open()
   try {$memory.Position=0;$memory.CopyTo($target)} finally {$target.Dispose();$memory.Dispose()}
  }
 }
 [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apk,(Join-Path $build 'dex/classes.dex'),'classes.dex',[IO.Compression.CompressionLevel]::Optimal) | Out-Null
} finally { $apk.Dispose() }
& (Join-Path $buildTools 'zipalign.exe') -f -P 16 4 (Join-Path $build 'unsigned.apk') (Join-Path $build 'aligned.apk')
if ($LASTEXITCODE) { throw 'APK alignment failed' }
$finalApk=Join-Path $Destination ("ZombossRise-$appVersion.apk")
& (Join-Path $JdkHome 'bin/java.exe') -jar (Join-Path $buildTools 'lib/apksigner.jar') sign --ks $SigningKey --ks-key-alias zomboss --ks-pass "file:$SigningPassFile" --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false --out $finalApk (Join-Path $build 'aligned.apk')
if ($LASTEXITCODE) { throw 'APK signing failed' }
& (Join-Path $JdkHome 'bin/java.exe') -jar (Join-Path $buildTools 'lib/apksigner.jar') verify --verbose --print-certs $finalApk
if ($LASTEXITCODE) { throw 'APK verification failed' }
& (Join-Path $buildTools 'zipalign.exe') -c -P 16 4 $finalApk
if ($LASTEXITCODE) { throw 'APK final alignment check failed' }
Write-Output "Built Windows executable folder and signed APK at $Destination"
