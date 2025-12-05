# App Icons

Ce dossier contient les icônes de l'application Through.

## Tailles requises par plateforme

### 🍎 macOS (.icns)

| Taille    | Nom du fichier      | Description             |
| --------- | ------------------- | ----------------------- |
| 16x16     | icon_16x16.png      | Menu bar, Dock minimal  |
| 32x32     | icon_16x16@2x.png   | Retina 16pt             |
| 32x32     | icon_32x32.png      | Finder liste            |
| 64x64     | icon_32x32@2x.png   | Retina 32pt             |
| 128x128   | icon_128x128.png    | Finder icônes           |
| 256x256   | icon_128x128@2x.png | Retina 128pt            |
| 256x256   | icon_256x256.png    | Finder grand            |
| 512x512   | icon_256x256@2x.png | Retina 256pt            |
| 512x512   | icon_512x512.png    | App Store, Launchpad    |
| 1024x1024 | icon_512x512@2x.png | Retina 512pt, App Store |

### 🪟 Windows (.ico)

Un fichier `.ico` contient plusieurs tailles intégrées :

| Taille  | Usage                            |
| ------- | -------------------------------- |
| 16x16   | Barre des tâches (petite), menus |
| 24x24   | Barre des tâches                 |
| 32x32   | Bureau, Explorateur liste        |
| 48x48   | Explorateur icônes moyennes      |
| 64x64   | Explorateur grandes icônes       |
| 128x128 | Très grandes icônes              |
| 256x256 | Extra large, vignettes           |

### 🐧 Linux (PNG)

| Taille  | Usage                        |
| ------- | ---------------------------- |
| 16x16   | Systray, menus               |
| 22x22   | Barre d'outils (certains DE) |
| 24x24   | Barre d'outils, panneaux     |
| 32x32   | Menus, dock                  |
| 48x48   | Lanceurs d'applications      |
| 64x64   | Icônes moyennes              |
| 128x128 | Grandes icônes               |
| 256x256 | Très grandes icônes          |
| 512x512 | Vignettes, stores            |

## Image source requise

**Format**: PNG avec transparence (alpha channel)  
**Taille minimale**: **1024x1024 pixels**  
**Recommandé**: Image carrée, centrée, avec marge de ~10%

## Comment générer les icônes

### 1. Prérequis

Installer ImageMagick :

```bash
brew install imagemagick
```

### 2. Ajouter ton image source

Place ton image d'icône dans ce dossier avec le nom :

```
icon-source.png
```

### 3. Exécuter le script de conversion

```bash
cd apps/electron/assets
./convert-icons.sh
```

## Structure finale

```
assets/
├── icon-source.png       # Ton image source (1024x1024 PNG)
├── convert-icons.sh      # Script de conversion
├── README.md
└── icons/
    ├── icon.icns         # macOS (contient toutes les tailles)
    ├── icon.ico          # Windows (contient toutes les tailles)
    ├── icon-16.png       # 16x16
    ├── icon-32.png       # 32x32
    ├── icon-48.png       # 48x48
    ├── icon-64.png       # 64x64
    ├── icon-128.png      # 128x128
    ├── icon-256.png      # 256x256
    ├── icon-512.png      # 512x512
    └── icon-1024.png     # 1024x1024
```

## Configuration Electron

Une fois les icônes générées, ajouter dans `apps/electron/package.json` ou la config electron-builder :

```json
{
  "build": {
    "mac": {
      "icon": "assets/icons/icon.icns"
    },
    "win": {
      "icon": "assets/icons/icon.ico"
    },
    "linux": {
      "icon": "assets/icons"
    }
  }
}
```
