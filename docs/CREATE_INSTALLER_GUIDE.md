# Creating Professional Installers - For Non-Technical Users

This guide shows how to create **professional, double-click installers** that work like any normal software (Microsoft Office, Adobe, etc.).

---

## What Gets Created

After following this guide, you'll have:

### Windows
**`SSMC EMR Setup 1.0.0.exe`** - 150-200 MB installer
- Double-click to install
- Installs to `C:\Program Files\SSMC EMR\`
- Creates Start Menu shortcut
- Creates Desktop icon
- Includes automatic updates
- Can be uninstalled from Control Panel

### macOS
**`SSMC EMR-1.0.0.dmg`** - 150-200 MB disk image
- Double-click to open
- Drag app to Applications folder
- Includes automatic updates

### Linux
**`SSMC EMR-1.0.0.AppImage`** - 150-200 MB portable app
- Double-click to run (no installation needed)
- Or install using package manager

---

## Prerequisites

Before creating installers:

```bash
# 1. Ensure all code is working
npm run dev:backend    # Test backend
npm run dev:frontend   # Test frontend

# 2. Ensure all dependencies installed
npm install

# 3. Build production bundles
npm run build:all
```

---

## Step 1: Prepare for Production

### Update package.json

Your `package.json` already has the build configuration, but let's enhance it:

```json
{
  "name": "ssmc-emr",
  "version": "1.0.0",
  "description": "SSMC EMR - Electronic Medical Records System",
  "main": "dist/electron/main.js",
  "author": "Your Clinic Name",
  "license": "PROPRIETARY",

  "build": {
    "appId": "com.yourcompany.ssmcemr",
    "productName": "SSMC EMR",
    "copyright": "Copyright © 2026 Your Company",

    "directories": {
      "output": "dist-electron"
    },

    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],

    "win": {
      "target": ["nsis"],
      "icon": "assets/icon.ico",
      "publisherName": "Your Company Name",
      "verifyUpdateCodeSignature": false
    },

    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "SSMC EMR",
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico",
      "license": "LICENSE.txt"
    },

    "mac": {
      "target": ["dmg"],
      "icon": "assets/icon.icns",
      "category": "public.app-category.healthcare-fitness"
    },

    "dmg": {
      "background": "assets/dmg-background.png",
      "icon": "assets/icon.icns",
      "iconSize": 100,
      "contents": [
        {
          "x": 410,
          "y": 150,
          "type": "link",
          "path": "/Applications"
        },
        {
          "x": 130,
          "y": 150,
          "type": "file"
        }
      ]
    },

    "linux": {
      "target": ["AppImage"],
      "icon": "assets/icon.png",
      "category": "Office"
    }
  }
}
```

---

## Step 2: Create Application Icons

Create icons in the `assets` folder:

### Windows Icon (`assets/icon.ico`)
- Size: 256x256 pixels
- Format: ICO file with multiple sizes (16, 32, 48, 256)
- Create using: https://icoconvert.com/ or Photoshop

### macOS Icon (`assets/icon.icns`)
- Size: 512x512 pixels minimum
- Format: ICNS file
- Create using: `iconutil` on Mac or https://cloudconvert.com/png-to-icns

### Linux Icon (`assets/icon.png`)
- Size: 512x512 pixels
- Format: PNG with transparency

**Quick icon generation**:
```bash
# If you have ImageMagick installed
convert yourlogo.png -resize 256x256 assets/icon.png

# For Windows ICO (requires ImageMagick on Windows)
magick convert assets/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 assets/icon.ico
```

---

## Step 3: Bundle the Backend Server

The installer needs to include the backend server. Create a startup script:

### For Windows: `start.bat`
```bat
@echo off
REM SSMC EMR Launcher
cd /d "%~dp0"

REM Start backend server
start /B npm run start:backend

REM Wait 3 seconds for backend to start
timeout /t 3 /nobreak > nul

REM Start Electron app
npm run start:electron
```

### For macOS/Linux: `start.sh`
```bash
#!/bin/bash
# SSMC EMR Launcher

# Get script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Start backend server in background
npm run start:backend &

# Wait for backend to start
sleep 3

# Start Electron app
npm run start:electron
```

Make executable:
```bash
chmod +x start.sh
```

---

## Step 4: Build the Installers

### Build for Current Platform

```bash
# Build installer for your current operating system
npm run build:electron

# Output will be in: dist-electron/
```

### Build for All Platforms (requires Docker or VM)

**On Windows** (to build for Windows):
```bash
npm run build:electron
```

**On macOS** (to build for Mac):
```bash
npm run build:electron
```

**On Linux** (to build for Linux):
```bash
npm run build:electron
```

**Cross-platform build (advanced)**:
```bash
# Install electron-builder
npm install --save-dev electron-builder

# Build for all platforms (requires proper setup)
npx electron-builder --win --mac --linux
```

---

## Step 5: Test the Installer

### Windows
1. Double-click `SSMC EMR Setup 1.0.0.exe`
2. Follow installation wizard
3. Choose installation folder
4. Installer creates shortcuts
5. Launch from Start Menu or Desktop

### macOS
1. Double-click `SSMC EMR-1.0.0.dmg`
2. Drag app to Applications folder
3. Launch from Applications or Launchpad

### Linux
1. Make AppImage executable: `chmod +x SSMC-EMR-1.0.0.AppImage`
2. Double-click to run
3. Or run from terminal: `./SSMC-EMR-1.0.0.AppImage`

---

## Step 6: Distribution

### For Single Clinic (Internal Use)

**Option 1: USB Drive**
1. Copy installer to USB drive
2. Give to clinic staff
3. They double-click to install

**Option 2: Email** (if file < 25 MB)
1. Zip the installer
2. Email to clinic
3. Unzip and double-click to install

**Option 3: Cloud Storage**
1. Upload to Google Drive / Dropbox / OneDrive
2. Share link with clinic
3. They download and install

### For Multiple Clinics (SaaS Distribution)

**Option 1: Website Download**
Create a simple download page:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Download SSMC EMR</title>
</head>
<body>
  <h1>Download SSMC EMR</h1>
  <p>Choose your operating system:</p>

  <a href="downloads/SSMC-EMR-Setup-1.0.0.exe">
    <button>Download for Windows</button>
  </a>

  <a href="downloads/SSMC-EMR-1.0.0.dmg">
    <button>Download for macOS</button>
  </a>

  <a href="downloads/SSMC-EMR-1.0.0.AppImage">
    <button>Download for Linux</button>
  </a>

  <h2>Installation Instructions</h2>
  <ol>
    <li>Download the installer for your operating system</li>
    <li>Double-click the downloaded file</li>
    <li>Follow the on-screen instructions</li>
    <li>Launch SSMC EMR from your applications</li>
  </ol>
</body>
</html>
```

**Option 2: Auto-Updates**
Configure automatic updates in your Electron app (already in package.json):
- App checks for updates on launch
- Notifies user when update available
- One-click update installation

---

## For Non-Technical Users: Installation Instructions

Create a simple PDF guide with screenshots:

### Windows Installation
```
1. Download the file: SSMC EMR Setup.exe
2. Double-click the downloaded file
3. Click "Yes" if Windows asks permission
4. Click "Next" through the installation wizard
5. Choose where to install (default is fine)
6. Click "Install"
7. Click "Finish" when done
8. Find "SSMC EMR" icon on your desktop or Start Menu
9. Double-click to launch
```

### macOS Installation
```
1. Download the file: SSMC EMR.dmg
2. Double-click the downloaded file
3. Drag the SSMC EMR icon to the Applications folder
4. Open Applications folder (Command+Shift+A)
5. Double-click SSMC EMR
6. Click "Open" if Mac asks permission
```

### First Launch Setup
```
1. App opens automatically
2. Enter login credentials:
   - Email: admin@clinic.com
   - Password: (provided by administrator)
3. Click "Login"
4. Complete clinic setup:
   - Upload clinic logo
   - Enter clinic name and address
5. Start using the application
```

---

## Troubleshooting Installer Issues

### Windows: "Windows protected your PC"
**Solution**: Click "More info" → "Run anyway"
- To avoid this, get a code signing certificate ($50-300/year)

### macOS: "App can't be opened because it's from an unidentified developer"
**Solution**: Right-click app → "Open" → Click "Open" again
- To avoid this, get an Apple Developer certificate ($99/year)

### Linux: "Permission denied"
**Solution**: `chmod +x SSMC-EMR.AppImage`

---

## Code Signing (Optional but Recommended)

For professional distribution:

### Windows Code Signing
1. Purchase code signing certificate ($50-$300/year)
   - DigiCert, Sectigo, or Comodo
2. Install certificate on build machine
3. electron-builder will auto-sign during build

### macOS Code Signing
1. Enroll in Apple Developer Program ($99/year)
2. Create Developer ID certificate in Xcode
3. electron-builder will auto-sign during build

### Benefits
- No security warnings during installation
- Looks more professional
- Required for auto-updates to work properly

---

## Simplified Build Script

Add to `package.json`:

```json
{
  "scripts": {
    "dist": "npm run build:all && electron-builder",
    "dist:win": "npm run build:all && electron-builder --win",
    "dist:mac": "npm run build:all && electron-builder --mac",
    "dist:linux": "npm run build:all && electron-builder --linux"
  }
}
```

Then just run:
```bash
npm run dist        # Build for current OS
npm run dist:win    # Build Windows installer
npm run dist:mac    # Build Mac installer
npm run dist:linux  # Build Linux installer
```

---

## Final Checklist

Before distributing:

- [ ] App tested on fresh machine
- [ ] Icons included and displaying correctly
- [ ] Backend server starts automatically
- [ ] Database connects successfully
- [ ] Installer tested on target OS
- [ ] Uninstaller works correctly
- [ ] Desktop shortcut created
- [ ] Start menu entry created (Windows)
- [ ] App launches without errors
- [ ] Installation instructions written
- [ ] Support contact provided

---

## Distribution Package

Create a folder for clinic staff:

```
SSMC_EMR_Installation/
├── SSMC EMR Setup.exe (or .dmg or .AppImage)
├── Installation Guide.pdf
├── Quick Start Guide.pdf
├── Login Credentials.txt
└── Support Contact.txt
```

---

**That's it!** Now you have professional installers that anyone can use, just like Microsoft Office or any other standard software.

**No command line needed. No technical knowledge required. Just double-click and install!**

---

**Document Version**: 1.0
**Last Updated**: January 27, 2026
**For SSMC EMR v1.0.0**
