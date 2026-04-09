[CmdletBinding()]
param(
  [string]$BaseUrl = $env:JIRA_BASE_URL,
  [string]$ProjectKey = $env:JIRA_PROJECT_KEY,
  [string]$Email = $env:JIRA_EMAIL,
  [string]$ApiToken = $env:JIRA_API_TOKEN,
  [string]$TechAccountId = $env:JIRA_TECH_ACCOUNT_ID,
  [string]$PartnerAccountId = $env:JIRA_PARTNER_ACCOUNT_ID,
  [string]$PartnerQuery = $env:JIRA_PARTNER_QUERY,
  [string]$BacklogPath = $env:JIRA_BACKLOG_PATH,
  [switch]$EnsureComponents,
  [switch]$FailFast,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Script-scoped context (filled after auth check; keep defined for StrictMode).
$script:Myself = $null
$script:MyAccountId = $null
$script:Project = $null
$script:EpicLinkFieldId = $null
$script:ProjectStyle = $null
$script:ProjectSimplified = $null

function Convert-TextToAdf([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }

  # Jira Cloud REST API v3 expects Atlassian Document Format (ADF) for rich text fields (e.g. description).
  # We keep it simple: a single paragraph and use hardBreak for newlines.
  $lines = ($Text -split "`r?`n", -1)
  $inline = @()
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = [string]$lines[$i]
    if ($line.Length -gt 0) {
      $inline += @{ type = "text"; text = $line }
    }
    if ($i -lt ($lines.Length - 1)) {
      $inline += @{ type = "hardBreak" }
    }
  }

  # If it was only newlines/spaces, ensure we still send a valid doc.
  if ($inline.Count -eq 0) {
    $inline = @(@{ type = "text"; text = " " })
  }

  return @{
    type = "doc"
    version = 1
    content = @(
      @{
        type = "paragraph"
        content = $inline
      }
    )
  }
}

function Require-Value([string]$Name, [string]$Value, [string]$Hint) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing $Name. $Hint"
  }
}

Require-Value -Name "BaseUrl" -Value $BaseUrl -Hint "Set -BaseUrl or env var JIRA_BASE_URL (e.g. https://your-domain.atlassian.net)."
Require-Value -Name "ProjectKey" -Value $ProjectKey -Hint "Set -ProjectKey or env var JIRA_PROJECT_KEY (e.g. KAN)."
Require-Value -Name "Email" -Value $Email -Hint "Set -Email or env var JIRA_EMAIL (your Atlassian account email)."
Require-Value -Name "ApiToken" -Value $ApiToken -Hint "Set -ApiToken or env var JIRA_API_TOKEN (create in Atlassian Account > Security > API tokens)."
if ([string]::IsNullOrWhiteSpace($BacklogPath)) {
  # In some shells $PSScriptRoot isn't available during param default evaluation.
  $BacklogPath = Join-Path $PSScriptRoot "backlog-kan.json"
}
Require-Value -Name "BacklogPath" -Value $BacklogPath -Hint "Backlog JSON file path (set -BacklogPath or env var JIRA_BACKLOG_PATH)."

$BaseUrl = $BaseUrl.TrimEnd("/")

if (-not (Test-Path -LiteralPath $BacklogPath)) {
  throw "Backlog file not found: $BacklogPath"
}

$authPair = "$Email`:$ApiToken"
$authBytes = [Text.Encoding]::ASCII.GetBytes($authPair)
$authB64 = [Convert]::ToBase64String($authBytes)
$Headers = @{
  Authorization = "Basic $authB64"
  Accept        = "application/json"
  # Be explicit: Jira expects UTF-8 JSON; Windows PowerShell encoding defaults can be surprising.
  "Content-Type" = "application/json; charset=utf-8"
}

function Try-ParseJson([string]$Text) {
  try {
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    return $Text | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Invoke-Jira([string]$Method, [string]$Path, [object]$Body) {
  $uri = "$BaseUrl$Path"
  if ($DryRun) {
    Write-Host "DRYRUN $Method $uri"
    if ($null -ne $Body) {
      ($Body | ConvertTo-Json -Depth 20) | Write-Host
    }
    return $null
  }

  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers
    }

    $json = $Body | ConvertTo-Json -Depth 20
    # Always send UTF-8 bytes to avoid invalid JSON on Jira side when text contains non-ASCII.
    $bytes = [Text.Encoding]::UTF8.GetBytes([string]$json)
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -Body $bytes
  } catch {
    $err = $_
    $code = Get-HttpStatusCodeFromError $err

    $preview = $null
    try {
      # Prefer ErrorDetails.Message if present (PowerShell sometimes captures response JSON here).
      if ($null -ne $err.ErrorDetails -and -not [string]::IsNullOrWhiteSpace([string]$err.ErrorDetails.Message)) {
        $preview = [string]$err.ErrorDetails.Message
      } elseif ($null -ne $err.Exception -and $null -ne $err.Exception.Response) {
        $stream = $err.Exception.Response.GetResponseStream()
        if ($null -ne $stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $preview = $reader.ReadToEnd()
          if ($null -ne $preview -and $preview.Length -gt 800) { $preview = $preview.Substring(0, 800) + "..." }
        }
      }
    } catch { }

    $codeText = if ($null -ne $code) { "HTTP $code" } else { "HTTP ?" }
    $extra = if (-not [string]::IsNullOrWhiteSpace($preview)) { " Response: $preview" } else { "" }
    throw "Jira request failed: $Method $uri ($codeText). $($err.Exception.Message).$extra"
  }
}

function UrlEncode([string]$Value) {
  return [uri]::EscapeDataString($Value)
}

function Quote-Jql([string]$Value) {
  if ($null -eq $Value) { return '""' }
  $s = [string]$Value
  $s = $s.Replace('\', '\\')
  $s = $s.Replace('"', '\"')
  return '"' + $s + '"'
}

function Search-JiraIssues(
  [string]$Jql,
  [string[]]$Fields,
  [string]$NextPageToken = $null,
  [int]$MaxResults = 50
) {
  $body = @{
    jql = $Jql
    maxResults = $MaxResults
  }
  if ($null -ne $Fields -and $Fields.Count -gt 0) { $body.fields = $Fields }
  if (-not [string]::IsNullOrWhiteSpace($NextPageToken)) { $body.nextPageToken = $NextPageToken }

  return Invoke-Jira -Method "POST" -Path "/rest/api/3/search/jql" -Body $body
}

function Resolve-AccountId([string]$Query) {
  if ($DryRun) { return $null }
  if ([string]::IsNullOrWhiteSpace($Query)) { return $null }

  $path = "/rest/api/3/user/search?query=$(UrlEncode $Query)&maxResults=10"
  $users = Invoke-Jira -Method "GET" -Path $path -Body $null
  $arr = @($users)

  if ($arr.Count -eq 0) {
    throw "No Jira user found for query '$Query'. Add the user to the project and try again, or set JIRA_PARTNER_ACCOUNT_ID."
  }

  if ($arr.Count -eq 1) {
    return [string]$arr[0].accountId
  }

  Write-Host "Multiple Jira users matched query '$Query'. Set JIRA_PARTNER_ACCOUNT_ID explicitly. Candidates:"
  foreach ($u in $arr) {
    Write-Host " - $($u.displayName) | accountId=$($u.accountId)"
  }
  throw "Ambiguous Jira user query: '$Query'"
}

function Get-HttpStatusCodeFromError($err) {
  try {
    if ($null -ne $err.Exception -and $null -ne $err.Exception.Response -and $null -ne $err.Exception.Response.StatusCode) {
      return [int]$err.Exception.Response.StatusCode
    }
  } catch { }
  return $null
}

function Get-ExistingSeedIssueMap([string]$SeedLabel) {
  $map = @{}
  if ($DryRun) { return $map }
  if ([string]::IsNullOrWhiteSpace($SeedLabel)) { return $map }

  $jql = "project=$ProjectKey AND labels=$SeedLabel ORDER BY created DESC"
  $nextPageToken = $null
  $maxResults = 50

  while ($true) {
    $resp = Search-JiraIssues -Jql $jql -Fields @("summary", "issuetype") -NextPageToken $nextPageToken -MaxResults $maxResults
    foreach ($iss in $resp.issues) {
      $typeName = [string]$iss.fields.issuetype.name
      $summary = [string]$iss.fields.summary
      $sig = "$typeName|$summary"
      if (-not $map.ContainsKey($sig)) {
        $map[$sig] = [string]$iss.key
      }
    }

    $nextPageToken = [string](Get-Prop $resp "nextPageToken")
    if ([string]::IsNullOrWhiteSpace($nextPageToken)) { break }
  }

  return $map
}

function Find-ExistingEpicKeyBySummary([string]$Summary) {
  if ($DryRun) { return $null }
  if ([string]::IsNullOrWhiteSpace($Summary)) { return $null }
  try {
    $jql = 'project=' + $ProjectKey + ' AND issuetype=Epic AND summary = ' + (Quote-Jql $Summary) + ' ORDER BY created DESC'
    $resp = Search-JiraIssues -Jql $jql -Fields @("summary") -MaxResults 1
    if ($null -ne $resp.issues -and $resp.issues.Count -gt 0) {
      return [string]$resp.issues[0].key
    }
  } catch {
    # Best effort: ignore.
  }
  return $null
}

function Find-ExistingIssueKeyByTypeAndSummary([string]$IssueType, [string]$Summary) {
  if ($DryRun) { return $null }
  if ([string]::IsNullOrWhiteSpace($IssueType)) { return $null }
  if ([string]::IsNullOrWhiteSpace($Summary)) { return $null }
  try {
    $jql =
      'project=' + $ProjectKey +
      ' AND issuetype=' + (Quote-Jql $IssueType) +
      ' AND summary = ' + (Quote-Jql $Summary) +
      ' ORDER BY created DESC'
    $resp = Search-JiraIssues -Jql $jql -Fields @("summary") -MaxResults 1
    if ($null -ne $resp.issues -and $resp.issues.Count -gt 0) {
      return [string]$resp.issues[0].key
    }
  } catch {
    # Best effort: ignore.
  }
  return $null
}

function Normalize-ProjectStyle([string]$Style) {
  if ([string]::IsNullOrWhiteSpace($Style)) { return $null }
  $s = ([string]$Style).Trim().ToLowerInvariant()
  switch ($s) {
    "next-gen" { return "next-gen" }
    "team-managed" { return "next-gen" }
    "classic" { return "classic" }
    "company-managed" { return "classic" }
    default { return $s }
  }
}

function Assert-JiraAuthAndProjectAccess() {
  if ($DryRun) { return }

  Write-Host "Auth check: /rest/api/3/myself"
  try {
    $me = Invoke-Jira -Method "GET" -Path "/rest/api/3/myself" -Body $null
    $script:Myself = $me
    $script:MyAccountId = $me.accountId
    if ($null -ne $me -and $null -ne $me.displayName) {
      Write-Host "  OK: $($me.displayName)"
    } else {
      Write-Host "  OK"
    }
  } catch {
    $code = Get-HttpStatusCodeFromError $_
    if ($code -eq 401) {
      throw "401 Unauthorized. Revisa JIRA_EMAIL + JIRA_API_TOKEN (token nuevo, email del mismo usuario que lo genero)."
    }
    throw
  }

  Write-Host "Project check: /rest/api/3/project/${ProjectKey}?expand=insight"
  try {
    $p = Invoke-Jira -Method "GET" -Path "/rest/api/3/project/${ProjectKey}?expand=insight" -Body $null
    $script:Project = $p
    $script:ProjectStyle = Normalize-ProjectStyle ([string](Get-Prop $p "style"))
    $script:ProjectSimplified = Get-Prop $p "simplified"
    if ($null -ne $p -and $null -ne $p.name) {
      Write-Host "  OK: $($p.key) - $($p.name)"
      if (-not [string]::IsNullOrWhiteSpace($script:ProjectStyle)) {
        Write-Host "  Style: $script:ProjectStyle"
      }
      if ($null -ne $script:ProjectSimplified) {
        Write-Host "  Simplified: $script:ProjectSimplified"
      }
    } else {
      Write-Host "  OK"
    }
  } catch {
    $code = Get-HttpStatusCodeFromError $_
    if ($code -eq 404) {
      throw "404 Not Found. Revisa JIRA_PROJECT_KEY (quizas 'KAN' es el board y no la key del proyecto) o permisos de acceso al proyecto."
    }
    if ($code -eq 401) {
      throw "401 Unauthorized. Revisa credenciales (email/token)."
    }
    throw
  }
}

function Get-JiraFields() {
  return Invoke-Jira -Method "GET" -Path "/rest/api/3/field" -Body $null
}

function Get-FieldIdByCustom([object[]]$Fields, [string]$Custom) {
  foreach ($f in $Fields) {
    $schema = Get-Prop $f "schema"
    $customVal = Get-Prop $schema "custom"
    if ($null -ne $customVal -and [string]$customVal -eq $Custom) {
      return [string]$f.id
    }
  }
  return $null
}

function Get-FieldIdByName([object[]]$Fields, [string]$Name) {
  foreach ($f in $Fields) {
    $n = Get-Prop $f "name"
    if ([string]$n -eq $Name) { return [string]$f.id }
  }
  return $null
}

function Get-Prop([object]$Obj, [string]$Name) {
  if ($null -eq $Obj) { return $null }
  $p = $Obj.PSObject.Properties[$Name]
  if ($null -eq $p) { return $null }
  return $p.Value
}

function Merge-Labels([string[]]$A, [string[]]$B) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  $out = New-Object 'System.Collections.Generic.List[string]'
  foreach ($x in @($A) + @($B)) {
    if ([string]::IsNullOrWhiteSpace($x)) { continue }
    if ($set.Add([string]$x)) { [void]$out.Add([string]$x) }
  }
  return ,$out.ToArray()
}

function Get-AssigneeAccountId([string]$Owner) {
  if ($Owner -eq "partner") {
    if (-not [string]::IsNullOrWhiteSpace($PartnerAccountId)) { return $PartnerAccountId }
    return $null
  }
  # Default to tech.
  if (-not [string]::IsNullOrWhiteSpace($TechAccountId)) { return $TechAccountId }
  if (-not [string]::IsNullOrWhiteSpace($script:MyAccountId)) { return $script:MyAccountId }
  return $null
}

function Get-ProjectComponents() {
  try {
    $components = Invoke-Jira -Method "GET" -Path "/rest/api/3/project/$ProjectKey/components" -Body $null
    $map = @{}
    foreach ($c in $components) {
      if ($null -ne $c.name -and $null -ne $c.id) {
        $map[$c.name] = $c.id
      }
    }
    return $map
  } catch {
    Write-Warning "Could not list project components (continuing without components). $($_.Exception.Message)"
    return @{}
  }
}

function Ensure-ProjectComponents([string[]]$DesiredNames) {
  $existing = Get-ProjectComponents
  foreach ($name in $DesiredNames) {
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    if ($existing.ContainsKey($name)) { continue }

    try {
      $body = @{ name = $name; project = $ProjectKey }
      Invoke-Jira -Method "POST" -Path "/rest/api/3/component" -Body $body | Out-Null
    } catch {
      Write-Warning "Could not create component '$name' (continuing). $($_.Exception.Message)"
    }
  }
  return Get-ProjectComponents
}

function New-Issue(
  [string]$IssueTypeName,
  [string]$Summary,
  [string]$Description,
  [string[]]$Labels,
  [string[]]$ComponentNames,
  [hashtable]$ExtraFields
) {
  $fields = @{
    project   = @{ key = $ProjectKey }
    summary   = $Summary
    issuetype = @{ name = $IssueTypeName }
  }

  if (-not [string]::IsNullOrWhiteSpace($Description)) {
    $fields.description = Convert-TextToAdf $Description
  }

  if ($null -ne $Labels -and $Labels.Count -gt 0) {
    $fields.labels = $Labels
  }

  if ($null -ne $ComponentNames -and $ComponentNames.Count -gt 0 -and $script:ComponentNameToId.Count -gt 0) {
    $components = @()
    foreach ($cn in $ComponentNames) {
      if ($script:ComponentNameToId.ContainsKey($cn)) {
        $components += @{ id = $script:ComponentNameToId[$cn] }
      }
    }
    if ($components.Count -gt 0) {
      $fields.components = $components
    }
  }

  if ($null -ne $ExtraFields) {
    foreach ($k in $ExtraFields.Keys) {
      $fields[$k] = $ExtraFields[$k]
    }
  }

  $payload = @{ fields = $fields }

  try {
    return (Invoke-Jira -Method "POST" -Path "/rest/api/3/issue" -Body $payload)
  } catch {
    # Try a single fallback pass: remove optional fields that Jira rejects in this project/screen.
    $msg = [string]$_.Exception.Message
    $responseText = $null
    if ($msg -match 'Response:\s*(\{.*)$') { $responseText = $Matches[1] }
    $errObj = Try-ParseJson $responseText
    $badFields = @()
    if ($null -ne $errObj -and $null -ne $errObj.errors) {
      foreach ($p in $errObj.errors.PSObject.Properties) { $badFields += [string]$p.Name }
    }

    if ($badFields.Count -eq 0) {
      # If Jira didn't tell us which field, try removing common optional fields once (screens differ per issue type).
      if ($msg -notmatch 'HTTP 400') { throw }

      foreach ($bf in @("assignee", "components", "parent")) {
        if ($fields.ContainsKey($bf)) { $null = $fields.Remove($bf) }
      }
      foreach ($k in @($fields.Keys)) {
        # In classic projects, Epic Link is a custom field like customfield_10014.
        if ($k -like 'customfield_*' -and ($k -eq $script:EpicLinkFieldId)) {
          $null = $fields.Remove($k)
        }
      }

      $payload2 = @{ fields = $fields }
      return (Invoke-Jira -Method "POST" -Path "/rest/api/3/issue" -Body $payload2)
    }

    foreach ($bf in $badFields) {
      # Remove fields Jira says are invalid for this issue type/project.
      $null = $fields.Remove($bf)
    }

    $payload2 = @{ fields = $fields }
    return (Invoke-Jira -Method "POST" -Path "/rest/api/3/issue" -Body $payload2)
  }
}

function Update-IssueFields([string]$IssueKey, [hashtable]$Fields) {
  if ($DryRun) { return }
  if ([string]::IsNullOrWhiteSpace($IssueKey)) { return }
  if ($null -eq $Fields -or $Fields.Count -eq 0) { return }

  # Ensure description is ADF if someone passes plain text.
  if ($Fields.ContainsKey("description") -and ($Fields.description -is [string])) {
    $Fields.description = Convert-TextToAdf ([string]$Fields.description)
  }

  $payload = @{ fields = $Fields }
  Invoke-Jira -Method "PUT" -Path "/rest/api/3/issue/$IssueKey" -Body $payload | Out-Null
}

function Add-IssueLabels([string]$IssueKey, [string[]]$LabelsToAdd) {
  if ($DryRun) { return }
  if ([string]::IsNullOrWhiteSpace($IssueKey)) { return }
  if ($null -eq $LabelsToAdd -or $LabelsToAdd.Count -eq 0) { return }

  $ops = @()
  foreach ($l in $LabelsToAdd) {
    if ([string]::IsNullOrWhiteSpace($l)) { continue }
    $ops += @{ add = [string]$l }
  }
  if ($ops.Count -eq 0) { return }

  $payload = @{ update = @{ labels = $ops } }
  Invoke-Jira -Method "PUT" -Path "/rest/api/3/issue/$IssueKey" -Body $payload | Out-Null
}

function Link-IssuesToEpic([string]$EpicKey, [string[]]$IssueKeys) {
  if ($DryRun) { return }
  if ($IssueKeys.Count -eq 0) { return }

  # Team-managed (next-gen) projects: link via "parent".
  if ($script:ProjectStyle -eq "next-gen") {
    foreach ($k in $IssueKeys) {
      try {
        Update-IssueFields -IssueKey $k -Fields @{ parent = @{ key = $EpicKey } }
      } catch {
        Write-Warning "Failed to set parent (team-managed). Issue=$k Epic=$EpicKey. $($_.Exception.Message)"
      }
    }
    return
  }

  # Company-managed (classic): link via Epic Link field if available.
  if (-not [string]::IsNullOrWhiteSpace($script:EpicLinkFieldId)) {
    foreach ($k in $IssueKeys) {
      try {
        Update-IssueFields -IssueKey $k -Fields @{ ($script:EpicLinkFieldId) = $EpicKey }
      } catch {
        Write-Warning "Failed to set Epic Link (classic). Issue=$k Epic=$EpicKey. $($_.Exception.Message)"
      }
    }
    return
  }

  # Last resort: Agile API.
  try {
    $body = @{ issues = $IssueKeys }
    Invoke-Jira -Method "POST" -Path "/rest/agile/1.0/epic/$EpicKey/issue" -Body $body | Out-Null
  } catch {
    Write-Warning "Agile epic link failed. Epic=$EpicKey. $($_.Exception.Message)"
  }
}

# Load backlog definition.
$backlog = Get-Content -LiteralPath $BacklogPath -Raw | ConvertFrom-Json
$seedLabel = $null
$seedLabelVal = Get-Prop $backlog "seedLabel"
if ($null -ne $seedLabelVal) { $seedLabel = [string]$seedLabelVal }

Write-Host "Seeding Jira project '$ProjectKey' at $BaseUrl"
if ($DryRun) { Write-Host "DRYRUN enabled: no issues will be created." }

# Fail fast on wrong creds/project key.
Assert-JiraAuthAndProjectAccess

if ([string]::IsNullOrWhiteSpace($TechAccountId) -and -not [string]::IsNullOrWhiteSpace($script:MyAccountId)) {
  $TechAccountId = $script:MyAccountId
}

if ([string]::IsNullOrWhiteSpace($PartnerAccountId) -and -not [string]::IsNullOrWhiteSpace($PartnerQuery)) {
  $PartnerAccountId = Resolve-AccountId -Query $PartnerQuery
  if (-not [string]::IsNullOrWhiteSpace($PartnerAccountId)) {
    Write-Host "Resolved partner accountId: $PartnerAccountId"
  }
}

# Components (best effort).
$desiredComponents = @()
$componentsVal = Get-Prop $backlog "components"
if ($null -ne $componentsVal) { $desiredComponents = @($componentsVal | ForEach-Object { [string]$_ }) }
$script:ComponentNameToId = @{}
if ($desiredComponents.Count -gt 0 -and $EnsureComponents) {
  $script:ComponentNameToId = Ensure-ProjectComponents -DesiredNames $desiredComponents
} elseif ($desiredComponents.Count -gt 0) {
  # Only map existing components; do not try to create unless explicitly asked.
  $script:ComponentNameToId = Get-ProjectComponents
}

# Fields (to support Epic Name / Epic Link when available).
$allFields = Get-JiraFields
$epicNameFieldId = $null
$epicLinkFieldId = $null
$epicNameFieldId = Get-FieldIdByCustom -Fields $allFields -Custom "com.pyxis.greenhopper.jira:gh-epic-label"
if ($null -eq $epicNameFieldId) { $epicNameFieldId = Get-FieldIdByName -Fields $allFields -Name "Epic Name" }
$epicLinkFieldId = Get-FieldIdByCustom -Fields $allFields -Custom "com.pyxis.greenhopper.jira:gh-epic-link"
if ($null -eq $epicLinkFieldId) { $epicLinkFieldId = Get-FieldIdByName -Fields $allFields -Name "Epic Link" }

if ($null -ne $epicNameFieldId) { Write-Host "Found field: Epic Name -> $epicNameFieldId" }
if ($null -ne $epicLinkFieldId) { Write-Host "Found field: Epic Link -> $epicLinkFieldId" }
$script:EpicLinkFieldId = $epicLinkFieldId

# Some Jira sites don't return `style` in the project payload; infer it.
# Heuristic: if we can see an Epic Link field, it's almost certainly a classic (company-managed) project.
if ([string]::IsNullOrWhiteSpace($script:ProjectStyle)) {
  if ($script:ProjectSimplified -eq $true) {
    $script:ProjectStyle = "next-gen"
  } elseif (-not [string]::IsNullOrWhiteSpace($script:EpicLinkFieldId)) {
    $script:ProjectStyle = "classic"
  } else {
    $script:ProjectStyle = "next-gen"
  }
  Write-Host "Inferred project style: $script:ProjectStyle"
}

# Existing issues created by this seed label (for safe re-runs).
$existingSeedIssues = Get-ExistingSeedIssueMap -SeedLabel $seedLabel

# 1) Create epics first.
$epicAliasToKey = @{}
foreach ($e in $backlog.epics) {
  $aliasVal = Get-Prop $e "alias"
  $alias = if ($null -ne $aliasVal) { [string]$aliasVal } else { "" }
  $summary = [string]$e.summary
  $desc = [string]$e.description
  $labels = @()
  $labelsVal = Get-Prop $e "labels"
  if ($null -ne $labelsVal) { $labels = @($labelsVal | ForEach-Object { [string]$_ }) }
  if (-not [string]::IsNullOrWhiteSpace($seedLabel)) { $labels = Merge-Labels $labels @($seedLabel) }

  $sig = "Epic|$summary"
  if ($existingSeedIssues.ContainsKey($sig)) {
    $existingKey = [string]$existingSeedIssues[$sig]
    if (-not [string]::IsNullOrWhiteSpace($alias)) {
      $epicAliasToKey[$alias] = $existingKey
    }
    try { Add-IssueLabels -IssueKey $existingKey -LabelsToAdd $labels } catch { }
    Write-Host "Reusing Epic: $summary -> $existingKey"
    continue
  }

  $already = Find-ExistingEpicKeyBySummary -Summary $summary
  if (-not [string]::IsNullOrWhiteSpace($already)) {
    if (-not [string]::IsNullOrWhiteSpace($alias)) {
      $epicAliasToKey[$alias] = $already
    }
    try { Add-IssueLabels -IssueKey $already -LabelsToAdd $labels } catch { }
    Write-Host "Reusing existing Epic by summary: $summary -> $already"
    continue
  }

  $extra = @{}
  if ($null -ne $epicNameFieldId) {
    # Some Jira configs still require "Epic Name".
    $extra[$epicNameFieldId] = $summary
  }

  Write-Host "Creating Epic: $summary"
  try {
    $resp = New-Issue -IssueTypeName "Epic" -Summary $summary -Description $desc -Labels $labels -ComponentNames @() -ExtraFields $extra
    if ($null -ne $resp -and $null -ne $resp.key) {
      if (-not [string]::IsNullOrWhiteSpace($alias)) {
        $epicAliasToKey[$alias] = [string]$resp.key
      }
      Write-Host "  -> $($resp.key)"
    }
  } catch {
    Write-Warning "Failed to create epic '$summary'. $($_.Exception.Message)"
    if ($FailFast) { throw }
  }
}

# 2) Create remaining issues.
$epicToIssueKeys = @{}
foreach ($i in $backlog.issues) {
  $rawType = [string]$i.type
  $issueType = $rawType
  $labels = @()
  $iLabelsVal = Get-Prop $i "labels"
  if ($null -ne $iLabelsVal) { $labels = @($iLabelsVal | ForEach-Object { [string]$_ }) }
  if (-not [string]::IsNullOrWhiteSpace($seedLabel)) { $labels = Merge-Labels $labels @($seedLabel) }

  if ($rawType -eq "Spike") {
    # Jira usually doesn't have a "Spike" issue type by default.
    $issueType = "Task"
    if (-not ($labels -contains "spike")) { $labels += "spike" }
  }

  $owner = $null
  $ownerVal = Get-Prop $i "owner"
  if ($null -ne $ownerVal) { $owner = [string]$ownerVal }
  if ([string]::IsNullOrWhiteSpace($owner)) { $owner = "tech" }
  $labels = Merge-Labels $labels @("owner-$owner")
  if ($owner -eq "partner" -and [string]::IsNullOrWhiteSpace($PartnerAccountId)) {
    $labels = Merge-Labels $labels @("needs-assignee")
  }

  $summary = [string]$i.summary
  $desc = [string]$i.description
  $components = @()
  $iComponentsVal = Get-Prop $i "components"
  if ($null -ne $iComponentsVal) { $components = @($iComponentsVal | ForEach-Object { [string]$_ }) }

  $extra = @{}
  $epicAlias = $null
  $epicAliasVal = Get-Prop $i "epicAlias"
  if ($null -ne $epicAliasVal) { $epicAlias = [string]$epicAliasVal }

  # If we know the epic now, set the relationship during create/update.
  $epicKeyForIssue = $null
  if ($null -ne $epicAlias -and $epicAliasToKey.ContainsKey($epicAlias)) {
    $epicKeyForIssue = [string]$epicAliasToKey[$epicAlias]
    if ($script:ProjectStyle -eq "next-gen") {
      # Team-managed: parent links the issue to the epic.
      $extra.parent = @{ key = $epicKeyForIssue }
    } elseif (-not [string]::IsNullOrWhiteSpace($script:EpicLinkFieldId)) {
      # Classic: Epic Link custom field.
      $extra[$script:EpicLinkFieldId] = $epicKeyForIssue
    }
  }
  $assignee = Get-AssigneeAccountId -Owner $owner
  if (-not [string]::IsNullOrWhiteSpace($assignee)) {
    $extra.assignee = @{ accountId = $assignee }
  }

  $sig = "$issueType|$summary"
  if ($existingSeedIssues.ContainsKey($sig)) {
    $existingKey = [string]$existingSeedIssues[$sig]
    Write-Host "Reusing ${issueType}: $summary -> $existingKey"
    try { Add-IssueLabels -IssueKey $existingKey -LabelsToAdd $labels } catch { }
    if ($extra.Count -gt 0) {
      try { Update-IssueFields -IssueKey $existingKey -Fields $extra } catch { }
    }
    if ($null -ne $epicAlias -and $epicAliasToKey.ContainsKey($epicAlias)) {
      if (-not $epicToIssueKeys.ContainsKey($epicAlias)) { $epicToIssueKeys[$epicAlias] = @() }
      $epicToIssueKeys[$epicAlias] += $existingKey
      try { Link-IssuesToEpic -EpicKey $epicAliasToKey[$epicAlias] -IssueKeys @($existingKey) } catch { }
    }
    continue
  }

  $alreadyIssue = Find-ExistingIssueKeyByTypeAndSummary -IssueType $issueType -Summary $summary
  if (-not [string]::IsNullOrWhiteSpace($alreadyIssue)) {
    Write-Host "Reusing existing ${issueType} by summary: $summary -> $alreadyIssue"
    try { Add-IssueLabels -IssueKey $alreadyIssue -LabelsToAdd $labels } catch { }
    if ($extra.Count -gt 0) {
      try { Update-IssueFields -IssueKey $alreadyIssue -Fields $extra } catch { }
    }
    if ($null -ne $epicAlias -and $epicAliasToKey.ContainsKey($epicAlias)) {
      if (-not $epicToIssueKeys.ContainsKey($epicAlias)) { $epicToIssueKeys[$epicAlias] = @() }
      $epicToIssueKeys[$epicAlias] += $alreadyIssue
      try { Link-IssuesToEpic -EpicKey $epicAliasToKey[$epicAlias] -IssueKeys @($alreadyIssue) } catch { }
    }
    continue
  }

  Write-Host "Creating ${issueType}: $summary"
  try {
    $resp = New-Issue -IssueTypeName $issueType -Summary $summary -Description $desc -Labels $labels -ComponentNames $components -ExtraFields $extra
    if ($null -ne $resp -and $null -ne $resp.key) {
      $newKey = [string]$resp.key
      Write-Host "  -> $newKey"
      if ($null -ne $epicAlias -and $epicAliasToKey.ContainsKey($epicAlias)) {
        if (-not $epicToIssueKeys.ContainsKey($epicAlias)) { $epicToIssueKeys[$epicAlias] = @() }
        $epicToIssueKeys[$epicAlias] += $newKey
        try { Link-IssuesToEpic -EpicKey $epicAliasToKey[$epicAlias] -IssueKeys @($newKey) } catch { }
      }
    }
  } catch {
    Write-Warning "Failed to create ${issueType}: '$summary'. $($_.Exception.Message)"
    if ($FailFast) { throw }
  }
}

# 3) Link issues to epics (always) so the epic "contains" the tasks/stories in Jira UI.
foreach ($alias in $epicToIssueKeys.Keys) {
  $epicKey = $epicAliasToKey[$alias]
  $issueKeys = @($epicToIssueKeys[$alias])
  Write-Host "Linking issues to epic $epicKey"
  Link-IssuesToEpic -EpicKey $epicKey -IssueKeys $issueKeys
}

Write-Host "Done."
