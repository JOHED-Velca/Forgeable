# Forgeable Automatic Updates Setup

This document explains how to set up automatic updates for your Forgeable Tauri application.

## Overview

Your Forgeable app now supports **two types of automatic updates**:

1. **MSI In-Place Upgrades**: Users can double-click a new MSI to automatically replace the old version
2. **In-App Updates**: The app can check for and install updates automatically on startup

## What Was Configured

### 1. MSI Major Upgrades (`tauri.conf.json`)

- **Stable upgradeCode**: `{CB194B3F-8F6F-422B-8C07-FD60516DEB75}`
  - ⚠️ **NEVER CHANGE THIS GUID** - it's what Windows uses to identify your app for upgrades
- **MSI-only builds**: Only builds MSI installers (not other formats) for consistent upgrade behavior
- **Version management**: Each release gets a new version number that Windows recognizes as "newer"

### 2. In-App Auto-Updates (Tauri Updater)

- **Silent updates**: Updates download and install without user interaction
- **Secure signing**: Updates are cryptographically signed to prevent tampering
- **GitHub releases integration**: Automatically checks your GitHub releases for new versions

### 3. Enhanced GitHub Actions Workflow

- **Automatic versioning**: Uses git tags to set the app version (e.g., `v1.2.3` → version `1.2.3`)
- **Signed releases**: Creates signed update packages
- **GitHub releases**: Automatically creates releases with MSI files and update metadata

## Required Setup Steps

### Step 1: Add Repository Secrets

You need to add the updater signing keys to your GitHub repository secrets:

1. Go to your GitHub repository: `https://github.com/JOHED-Velca/Forgeable`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets:

   - **`TAURI_SIGNING_PRIVATE_KEY`**:

     ```bash
     # Copy the content of this file:
     cat ~/.tauri/forgeable-updater.key
     ```

   - **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**:
     ```
     # The password you entered when generating the key
     your_chosen_password_here
     ```

### Step 2: Test MSI Upgrades

1. **Create v1.0.1 release**:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **Install on test machine**: Download and install the MSI from the GitHub release

3. **Create v1.0.2 release**:

   ```bash
   # Update version in tauri.conf.json if needed
   git tag v1.0.2
   git push origin v1.0.2
   ```

4. **Test upgrade**: Download the v1.0.2 MSI and double-click it
   - Expected: Windows automatically removes v1.0.1 and installs v1.0.2
   - No manual uninstall required
   - User data preserved (stored in `%APPDATA%\\Forgeable`)

### Step 3: Enable In-App Updates (Optional)

To make the app check for updates on startup, add this to your React app:

```typescript
// In your main App.tsx or a startup component
import { check } from "@tauri-apps/plugin-updater";

useEffect(() => {
  async function checkForUpdates() {
    try {
      const update = await check();
      if (update?.available) {
        console.log("Update available:", update.version);
        await update.downloadAndInstall();
        // App will restart automatically after update
      }
    } catch (error) {
      console.error("Update check failed:", error);
    }
  }

  checkForUpdates();
}, []);
```

## Release Workflow

### For Regular Updates:

1. **Make your changes** to the codebase
2. **Bump version** in `apps/ui/src-tauri/tauri.conf.json`:
   ```json
   {
     "version": "1.0.2" // Increment from previous version
   }
   ```
3. **Create and push tag**:
   ```bash
   git add .
   git commit -m "Release v1.0.2"
   git tag v1.0.2
   git push origin main
   git push origin v1.0.2
   ```
4. **GitHub Actions runs automatically**:
   - Builds MSI with version 1.0.2
   - Creates GitHub release
   - Users get notified of update (if in-app updater enabled)

### For Work PC Deployment:

Since you mentioned the main goal is automatic updates on work PCs, you have several options:

#### Option A: MSI Network Deployment

```powershell
# IT can deploy new versions silently via Group Policy or scripts
msiexec /i "\\network\path\Forgeable_1.0.2.msi" /qn /norestart
```

#### Option B: In-App Updates (Recommended)

- Users just open the app
- App checks GitHub releases automatically
- Downloads and installs update silently
- App restarts with new version

#### Option C: Scheduled Updates

Create a simple PowerShell script for IT:

```powershell
# check-forgeable-updates.ps1
$latest = Invoke-RestMethod "https://api.github.com/repos/JOHED-Velca/Forgeable/releases/latest"
$downloadUrl = $latest.assets | Where-Object { $_.name -like "*.msi" } | Select-Object -First 1 -ExpandProperty browser_download_url
$tempFile = "$env:TEMP\\forgeable-update.msi"
Invoke-WebRequest $downloadUrl -OutFile $tempFile
Start-Process msiexec -ArgumentList "/i", $tempFile, "/qn", "/norestart" -Wait
Remove-Item $tempFile
```

## Important Notes

### Version Management Rules:

- ✅ **Always increment version**: `1.0.1` → `1.0.2` → `1.0.3`
- ✅ **Keep upgradeCode unchanged**: `{CB194B3F-8F6F-422B-8C07-FD60516DEB75}`
- ⚠️ **Never downgrade version numbers**: Windows will reject the install

### User Data:

- User configurations saved to: `%APPDATA%\\Forgeable`
- Data files preserved during upgrades
- No manual backup needed

### Security:

- All updates are cryptographically signed
- In-app updater only accepts signed updates
- MSI files are signed by GitHub Actions

## Troubleshooting

### "Cannot install because newer version exists"

- Version in `tauri.conf.json` is lower than installed version
- Increment the version number and rebuild

### "Update check fails"

- Check network connectivity
- Verify GitHub repository is public or token has access
- Check repository secrets are correctly set

### "MSI doesn't upgrade in-place"

- Verify upgradeCode hasn't changed
- Ensure version is higher than current
- Check that targets is set to `["msi"]` only

### "App doesn't detect updates"

- Verify the updater plugin is properly initialized
- Check the endpoint URL in `tauri.conf.json`
- Ensure GitHub releases contain the required files

## Next Steps

1. **Add the repository secrets** (Step 1 above)
2. **Test with a v1.0.1 release** to verify MSI upgrades work
3. **Implement in-app update UI** if desired (Step 3 above)
4. **Set up deployment process** for your work environment

Your Forgeable app is now ready for seamless automatic updates! 🚀
