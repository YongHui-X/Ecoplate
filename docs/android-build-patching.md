# Android Build Configuration & Patching

## ProGuard Configuration for Android Gradle Plugin 9.0+

### The Problem

Capacitor 6.x packages were designed for Android Gradle Plugin (AGP) 8.x, which used `proguard-android.txt`. Our project uses AGP 9.0+, which deprecated this file in favor of `proguard-android-optimize.txt`.

When building the Android app with Capacitor 6.x + AGP 9.0+, you would encounter this error:
```
`getDefaultProguardFile('proguard-android.txt')` is no longer supported since it includes `-dontoptimize`, which prevents R8 from performing many optimizations. Instead use `getDefaultProguardFile('proguard-android-optimize.txt')
```

### Our Solution (Hybrid Approach)

We use a **three-layer solution** for maximum reliability:

#### Layer 1: Gradle Configuration Override (Primary)
- **Location:** `frontend/android/build.gradle`
- **How it works:** Overrides ProGuard configuration at build time for all subprojects
- **Advantage:** No node_modules modification needed, survives Capacitor updates
- **Maintenance:** None required unless Gradle major version changes

#### Layer 2: patch-package (Secondary)
- **Location:** `patches/` directory (git-tracked)
- **How it works:** Applies patches to node_modules after `bun install`
- **When used:** For complex patches that can't be solved with Gradle config
- **Maintenance:** Update patches when Capacitor versions change

#### Layer 3: Fallback Script (Safety Net)
- **Location:** `scripts/fix-capacitor-proguard.sh` (macOS/Linux) or `.ps1` (Windows)
- **How it works:** Direct text replacement in node_modules
- **When used:** As a last resort if both above fail
- **Maintenance:** Should rarely need updates

### For Team Members

#### When You Clone the Repository

1. Run `bun install` - all fixes apply automatically
2. Build Android: `cd frontend/android && ./gradlew assembleDebug`
3. No manual steps required!

#### When You Update Capacitor Versions

1. Update versions in `package.json`
2. Run `bun install`
3. Test Android build
4. If build fails with ProGuard errors:
   - Check if Gradle override needs updating
   - Create new patches with `bun patch-package <package-name>`
   - Commit updated patches to git

#### Troubleshooting

**Build fails with ProGuard error:**
```bash
# Verify Gradle override is present
cat frontend/android/build.gradle | grep -A 10 "Override deprecated"

# Re-run postinstall scripts manually
bun run postinstall

# Clean and rebuild
cd frontend/android
./gradlew clean
./gradlew assembleDebug
```

**Patches not applying:**
```bash
# Check patch-package is installed
bun list | grep patch-package

# Manually apply patches
bun patch-package

# Verify patches directory exists
ls -la patches/
```

### Technical Details

- **Android Gradle Plugin:** 9.0.0
- **Gradle:** 9.1.0
- **Capacitor:** 6.2.1
- **Deprecated file:** `proguard-android.txt`
- **Correct file:** `proguard-android-optimize.txt`

### File Locations

```
ecoplate/
├── frontend/android/
│   └── build.gradle              # Primary Gradle override here
├── patches/                       # Patch files (if needed)
│   └── @capacitor+*.patch
├── scripts/
│   ├── fix-capacitor-proguard.sh # Bash fallback
│   ├── fix-capacitor-proguard.ps1 # PowerShell fallback
│   └── run-fix.js                # Cross-platform launcher
└── docs/
    └── android-build-patching.md # This file
```

### How It Works

1. **Gradle Override (Primary Solution)**
   - When you run `./gradlew assembleDebug`, Gradle evaluates all subprojects
   - The `subprojects { afterEvaluate { ... } }` block in `frontend/android/build.gradle` runs after each subproject loads
   - For any project with an `android` configuration (all Capacitor plugins), it clears the `proguardFiles` and replaces them with the correct ones
   - This happens at build time, so no file modification is needed

2. **patch-package (Secondary Solution)**
   - After `bun install`, the postinstall script runs
   - patch-package checks the `patches/` directory for `.patch` files
   - If found, it applies them to the corresponding packages in node_modules
   - Patches are git-tracked, so all team members get them automatically

3. **Fallback Script (Last Resort)**
   - If Gradle override somehow fails, the postinstall script also runs the fix script
   - The script searches for any remaining `proguard-android.txt` references in Capacitor packages
   - It replaces them with `proguard-android-optimize.txt` using sed (cross-platform compatible)

### Creating Patches (Advanced)

If you need to create a patch for a Capacitor package:

1. Make your changes to the file in `node_modules/@capacitor/<package>/`
2. Run `bun patch-package @capacitor/<package>`
3. This creates `patches/@capacitor+<package>+<version>.patch`
4. Commit the patch file to git
5. All team members will get the patch applied automatically on `bun install`

Example:
```bash
# Make manual fixes to node_modules/@capacitor/android/capacitor/build.gradle
# Then create the patch
bun patch-package @capacitor/android

# Verify patch was created
ls -la patches/

# Commit to git
git add patches/
git commit -m "Add patch for @capacitor/android ProGuard config"
```

### Why This Approach?

**Why Gradle Override is Primary:**
- Survives all `bun install` and Capacitor version updates
- No file modification needed
- Works for all team members without any action
- Reliable and maintainable

**Why patch-package as Secondary:**
- Handles complex patches that can't be solved with Gradle config
- Industry-standard tool used by thousands of projects
- Git-tracked patches are reviewable and version-controlled
- Easy to update or remove when Capacitor fixes the issue upstream

**Why Fallback Script:**
- Safety net for edge cases
- Simple to understand and debug
- Can be manually run if needed
- Cross-platform compatible

### References

- [Android Gradle Plugin 9.0 Release Notes](https://developer.android.com/build/releases/gradle-plugin)
- [patch-package GitHub](https://github.com/ds300/patch-package)
- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [ProGuard Configuration](https://developer.android.com/studio/build/shrink-code#configuration-files)
