# GCPad Linux Integration

This document describes the Linux controller support integration for UnionCrax.Direct.

## Architecture

```
Electron Renderer (React)
    ↓ (window.ucController API)
Main Process (Node.js)
    ↓ (N-API)
uc_overlay_native.node (native addon)
    ↓ (dlopen)
libgcpad.so (GCPad library)
    ↓ (SDL2/HID/evdev)
Controller Hardware
```

## Required Libraries

Place the following in `gcpad-lib/`:
- `libgcpad.so` - GCPad library built from UnionCrax-Team/GCPad_API
- `libSDL2-2.0.so.0` - SDL2 runtime (symlink ok)

### Building libgcpad.so

```bash
# Clone the upstream repo
git clone https://github.com/UnionCrax-Team/GCPad_API.git
cd GCPad_API

# Build with CMake
mkdir build && cd build
cmake .. -DGCPAD_BUILD_FRONTEND=OFF -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

# Copy the library
mkdir -p /path/to/unioncrax-direct/gcpad-lib
cp libgcpad.so /path/to/unioncrax-direct/gcpad-lib/
```

### Installing SDL2

On Ubuntu/Debian:
```bash
sudo apt install libsdl2-2.0-0
# Create symlink
ln -s /usr/lib/x86_64-linux-gnu/libSDL2-2.0.so.0 \
      gcpad-lib/libSDL2-2.0.so.0
```

## Native Addon Build

```bash
# Install dependencies
pnpm install

# Rebuild native addon against Electron headers
node scripts/rebuild-native.cjs
```

The addon is built with:
- `gcpad_bridge_posix.cpp` - POSIX dlopen/dlsym bridge
- Links: X11, XTest, dl, pthread

## Controller Navigation

The `use-controller-navigation` hook enables D-pad / stick navigation:

```tsx
const { enabled, setEnabled } = useControllerNavigation({
  onNavigateUp: () => focusNext('up'),
  onNavigateDown: () => focusNext('down'),
  onNavigateLeft: () => focusNext('left'),
  onNavigateRight: () => focusNext('right'),
  onConfirm: () => activateFocused(),
  onCancel: () => goBack(),
})
```

Wire up focusables with `tabIndex={0} onKeyDown={handleKeyDown}` and they'll participate in roving focus.

## API Endpoints

### Main Process

```javascript
// Get library path (cross-platform)
const libPath = getGCPadLibPath()  // gcpad.dll or libgcpad.so

// Load library
nativeOverlay.gcpadLoad(libPath)

// Poll for input
nativeOverlay.gcpadUpdateAll()
const states = nativeOverlay.gcpadGetStates()

// Haptics
nativeOverlay.gcpadSetRumble(slot, left, right)
nativeOverlay.gcpadSetLed(slot, r, g, b)

// Callbacks
nativeOverlay.gcpadOnConnect(cb)  // ({ controllerId, controllerName, controllerType })
nativeOverlay.gcpadOnDisconnect(cb)
```

### Renderer Process

```javascript
// Access via window.ucController
window.ucController.getStates?.()
window.ucController.onControllerInput?.(callback)
window.ucController.getConnected?.()
```

## Differences from Windows

| Feature | Windows | Linux |
|---------|---------|-------|
| Input injection | SendInput | XTest (via remapper) |
| Overlay injection | Supported | Not implemented |
| Shared memory frame | Supported | Not implemented |
| Pipe server | Supported | Not implemented |
| Raw HID access | Windows HID API | evdev (via SDL2) |

## Troubleshooting

**Library not found:**
- Check `gcpad-lib/` contains `libgcpad.so`
- Run `ldd gcpad-lib/libgcpad.so` to verify SDL2 linkage
- Set `LD_LIBRARY_PATH=gcpad-lib:$LD_LIBRARY_PATH` if needed

**Controller not detected:**
- Run `ls /dev/input/event*` - controllers appear here
- Check `libSDL2-2.0.so.0` is readable
- Verify user is in `input` group: `sudo usermod -a -G input $USER`