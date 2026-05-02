# Information

A FiveM CarPlay style in vehicle music system with synced playback, queue handling, and persistent playlists.

## Preview
<p align="center">
  <img width="48%" alt="image" src="https://github.com/user-attachments/assets/bb8c09fe-d6e5-4e3c-823b-132bb46d02a3" />
  <img width="48%" alt="image" src="https://github.com/user-attachments/assets/f1cf7fab-a09f-476b-9027-0d779b182cf3" />  
</p>

## Features

- In-vehicle CarPlay UI (NUI) with now playing, queue, and playlist tabs.
- Synced playback for vehicle occupants using `xsound`.
- Queue support with next/restart/seek/volume controls.
- Playlist system stored in MySQL:
  - Create playlists
  - Add songs
  - Import shared playlists by code
  - Play full playlists as a queue
- Supports both `qbx_core` and `qb-core` player identity lookup.
- Automatic DB table creation for:
  - `playlists`
  - `playlist_songs`

## Dependencies

Required resources:

- [`ox_lib`](https://github.com/overextended/ox_lib)
- [`oxmysql`](https://github.com/overextended/oxmysql)
- [`xsound`](https://github.com/Xogy/xsound)
- `qbx_core` or `qb-core`

## Installation

1. Place this resource in your server resources folder.
2. Ensure dependencies are installed and started before this resource.
3. Add to your `server.cfg`:

```cfg
ensure ox_lib
ensure oxmysql
ensure xsound
ensure qbx_core   # or qb-core
ensure cad-carplay
```

4. Restart the server/resource.

## Configuration / Behavior

- **Open keybind:** `Q` (defined with `ox_lib` keybind in client script).
- **Scope:** Works when the player is inside a vehicle.
- **Audio sync:** Music is synchronized to all occupants by server relays.
- **Persistence:** Playlists and songs are persisted in MySQL tables.
- **Vehicle radio:** Native vehicle radio is disabled while inside vehicles.

## Database

No manual SQL import is required in normal usage.

On resource start, the script creates these tables if missing:

- `playlists` (`id`, `citizenid`, `label`, `share_code`)
- `playlist_songs` (`id`, `playlist`, `link`)

## Notes

- Song/title metadata in UI uses `noembed.com` lookups for URLs.
- Share code generation uses uppercase letters and numbers (excluding ambiguous characters).
- Playlists are owned by citizen ID; adding songs checks ownership.

## Troubleshooting

- If UI does not open, confirm:
  - `ox_lib` is running
  - player is in a vehicle
  - resource started successfully
- If music does not play/sync, confirm `xsound` is running and up to date.
- If playlists do not load/save, confirm `oxmysql` connection is healthy and framework (`qbx_core`/`qb-core`) is running.

## License

See `LICENSE`.
