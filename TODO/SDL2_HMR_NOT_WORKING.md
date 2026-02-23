# SDL2 HMR Not Working

## Status
Confirmed broken on 2026-02-23

## Description
Hot Module Replacement (HMR) is not functioning in the SDL2 dev target. Changes to React component files do not automatically reload in the running storybook without manual restart.

## Testing
Tested with MultiWindowStory.tsx — changed title text and saved. No hot reload occurred.

## Impact
- Development workflow requires manual restart/rebuild for every change
- Slows iteration on SDL2 target features

## Related
- SDL2 target is primary renderer for ReactJIT
- Love2D target HMR status working
