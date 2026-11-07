# Rocket League — Fan Remake (browser)

Fan-made car-soccer game that runs in a web browser, including old Chromebooks. Not affiliated with Psyonix or Epic Games.

## Play
- **Easiest:** double-click `index.html`. No installs and no internet needed to start (the 3D engine is in `js/vendor`, the fonts in `css/fonts.css`; online play still needs internet). Models load from the packed copies in `js/embedded-models.js` and `js/embedded-hq.js`.
- **Chromebook or Mac:** run `python tools/make-play.py`. It builds `dist/RocketLeague-Play.zip` (just the game, plus `HOW TO PLAY.txt`). Copy the zip over (Google Drive, USB stick or email).
  - **Chromebook:** open the zip in the Files app, copy the `RocketLeague-Play` folder into My files, then right-click `index.html` > Open with > Chrome. Don't play it from inside the zip or from Google Drive.
  - **Mac:** double-click the zip, then open `index.html` with Chrome or Safari (in Safari, click once if there's no sound).
- **With the dedicated server (parties, matchmaking):** install Node 18+, then in this folder run:
  ```
  npm install
  npm start
  ```
  Open http://localhost:3000 (or pick a port: `node server/server.js --port 8124`). Friends on the same Wi-Fi open `http://<your-computer-ip>:3000`.

## Updates
- **Copies update themselves.** A copy built from `dist/RocketLeague-Play.zip` checks `version.json` at the address in `update-url.txt` (https://dandan4-max.github.io/rocket-league/) when it opens and every 20 minutes in the menus. A newer build installs straight away if you're still on the opening screens (a quick restart), otherwise **UPDATE NOW** shows on the main menu. Settings → Interface shows the version and has **CHECK FOR UPDATES**.
- **Where the new code comes from:** GitHub Pages first; if Pages doesn't answer, the same files raw from the repository (`raw.githubusercontent.com`, fetched and run because raw serves them as plain text); offline, the copy's own files. Only files that changed are downloaded (they're fetched by content hash). How it works: the loader in `tools/make-play.py` and `js/updater.js`.
- **Publishing an update:** `python tools/publish.py` builds the zip (new build number) and pushes it to github.com/DanDan4-max/rocket-league as one fresh commit (the repository only ever holds the newest build). Copies made before update-url.txt existed can't update; share the new zip.

## Online
- **Quick Play (no setup):** Play → Online → SEARCH. You join an open match or host one automatically (peer-to-peer via PeerJS). Bots fill empty seats after 15s.
- **Dedicated server:** when the page is served by `npm start`, it connects automatically. Parties, casual/competitive queues and private matches all run on the server.
- **Always-on public server:** deploy this folder to any Node host (Render, Railway, Fly.io). Use start command `npm start`; the host sets `PORT`. Players then just open your URL, with no setup.

- **Parties:** Create Party (bottom left) makes a party in the background. Friends join from an invite or the party code; their cars stand beside yours. The leader (crown) picks the playlist and searches, and the whole party joins the match on one team. The leader can hand over the crown or kick; there's party chat in the friends panel and **T** chats in a match.
- **Local Link (no internet):** Private Match → Local Link, or the friends panel. Both devices only need the same Wi-Fi or phone hotspot (the hotspot needs no data). The host shows an invite QR / code, the friend scans or types it and shows a reply, the host scans or types that. QR scanning needs a browser with a barcode reader (Chrome on Chromebooks, Android and Macs); otherwise type the codes.
- **Accounts:** Settings → Account. Accounts live on the dedicated server (`npm start`; passwords are salted scrypt hashes in `server/data/accounts.json`) and sync your progress after each save. Without a server, use **Save Backup File / Load Backup File** there (works offline); the browser also keeps a daily snapshot. Names can be changed once every 2 weeks.

- **Matchmaking:** searching a playlist online also looks for real players searching the same one; if someone is found you play together (bots fill the rest), otherwise it's a match with bots.
- **Leaving matches:** in matchmade games the pause menu has FORFEIT (every real player on your team has to vote yes) and ABANDON MATCH (leaves and locks matchmaking for 7 minutes). Leaving never takes you out of your party.

## Graphics
Settings → Graphics: **Very Low (old Chromebook)**, Low, Medium, High. Auto picks one for you and drops lower if FPS stays under 30.

## Controls
W/S drive and pitch, A/D steer, Space jump (press again with a direction to flip), Shift or left mouse to boost, X/Ctrl powerslide and free air roll, Q/E air roll, C ball cam. Gamepads work. Rebind everything in Settings → Configure Controls.

## Cars
The built-in bodies (Striker, Bulldog, Viper, Scarab, Razor, Mammoth, Phantom, Hornet, Nova GT, Titan X, Cyber Bolt, Apex F1) are original placeholder models generated in code (`js/rlcars.js`). They are meant to be replaced or joined by real downloaded models.

## Built-in assets (all CC0, free for any use)
- Cars: Kenney Car Kit — `assets/kenney-cars`
- Trees/rocks: Kenney Nature Kit — `assets/kenney-nature`
- Houses/buildings: Kenney City Kits — `assets/kenney-city`
- Particles: Kenney Particle Pack — `assets/kenney-particles`
- Grass: ambientCG Grass004 — `assets/textures`

## Adding downloaded assets
Downloaded models and textures show on **Medium** and **High** graphics only. Low and Very Low always keep the light built-in placeholders, so old Chromebooks stay smooth.

1. Put the files in the right folder (each folder has a `README.txt`):

   | Folder | What goes in it |
   |---|---|
   | `assets/custom-cars/` | Car models, `.glb` or `.gltf`. A `.gltf` keeps its `.bin` and `textures` in its own folder, and the car is named after that folder (`octane/scene.gltf` becomes "Octane"). |
   | `assets/hq/sky/` | One 360° sky picture (2:1 JPG, e.g. a Poly Haven HDRI's "Tonemapped JPG"). |
   | `assets/hq/ground-outside/` | One seamless ground texture for the land around the stadium (+ optional `*NormalGL*` map). |
   | `assets/hq/field-grass/` | One seamless grass texture for the pitch. |
   | `assets/hq/people/` | Low-poly people for the stands (under ~3,000 triangles each). |
   | `assets/hq/boost/` | Particle sprites (PNG with transparency) named `flame`, `smoke`, `spark` or `fire`. |
   | `assets/hq/scenery/` | Trees, buildings and rocks placed around the outside of the stadium. |

   Not sure where something goes? Unzip the pack into `incoming/` and ask Claude to sort it.
2. Open `tools/pack-assets.html` (double-click it), click **Choose the game folder** and pick the folder with `index.html` in it. It writes `js/asset-list.js`, `js/embedded-models.js` and `js/embedded-hq.js`. No installs needed. (`python tools/embed-models.py` does the same thing.)
3. Reload the game. New cars appear in Garage → Body, already unlocked.

Use only models whose license allows it (CC0, or CC-BY with credit below). To tweak a car (hitbox, rotation, size, which material takes the team colour, wheel node names), add a line to `BL.CUSTOM_CARS` in `js/assets.js`. To replace a built-in body instead, add it to `BL.ASSETS.cars` there (e.g. `body_striker: { url: 'assets/cars/striker.glb' }`).

## Credits
- Fonts: Rajdhani (Indian Type Foundry) and Russo One (Jovanny Lemonad), SIL Open Font License 1.1, packed in `css/fonts.css`.
- This work is based on "Octane - Rocket League Car" (https://sketchfab.com/3d-models/octane-rocket-league-car-9910f0a5d158425bbc7deb60c7a81f69) by Jako (https://sketchfab.com/fairlight51) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- "Fennec - Rocket League Car", "Dominus - Rocket League Car" and "Ball - Rocket League" by Jako (https://sketchfab.com/fairlight51), CC-BY-4.0.
- "2018 Ford Mustang Cobra Jet" (https://sketchfab.com/3d-models/2018-ford-mustang-cobra-jet-e1166c8d0ee14ebba685584941c56461) by Ddiaz Design (https://sketchfab.com/ddiaz-design), CC-BY-NC-SA-4.0 (non-commercial; modified: fitted to a hitbox, recoloured with team paint).
- "Guardian | Rocket League Car" (https://sketchfab.com/3d-models/guardian-rocket-league-car-7f5dabfc148d4370b0dba4f36aac7114) by Prabhu Ram (https://sketchfab.com/virtualmakes), CC-BY-4.0.
- "Rocket League Samus Gunship 3D Model (Switch)" (https://sketchfab.com/3d-models/rocket-league-samus-gunship-3d-model-switch-966268f464574a7caa023bfee9e797cf) by Techo (https://sketchfab.com/TheSkyMiners), CC-BY-NC-4.0 (non-commercial).
- "Tesla Roadster 2.0" (https://sketchfab.com/3d-models/tesla-roadster-20-will-be-enchanced-soon-8d5da3904e434fc3830edf558cb9014d) by Michael (https://sketchfab.com/gmmichaelonearth), CC-BY-4.0.
- "Boost Pads / Pills Template" by rocketleaguemapmaking (https://sketchfab.com/rocketleaguemapmaking), CC-BY-4.0 (one small pad cut from it).
- "layered explosion as solid" by saeed khalili (https://sketchfab.com/saeedkhalili.ir), CC-BY-4.0 (simplified).
- "Modern Night Building (Game-ready)" by Ishxxn (https://sketchfab.com/1shxxn), CC-BY-4.0.
- "(FREE) Wheels - Lamborghini SC20 - SDC" by SDC PERFORMANCE (https://sketchfab.com/3Duae), CC-BY-4.0 (simplified, logo removed).
- "Hat" by Thunk3D scanner (https://sketchfab.com/Diana123456), CC-BY-4.0 (simplified).
- "Rocket League - Puck" by ROCKET LABS (https://sketchfab.com/vrajesh.gopigari), CC-BY-4.0.
- "Rocket League Diamond 3", "Rocket League Grandchampion 3", "Rocket League Supersonic Legend" by delta203 (https://sketchfab.com/delta203), CC-BY-4.0 (rendered to PNG).
- "Rocket League logotype" by False_idol (https://sketchfab.com/falseidol), CC-BY-4.0 (rendered to PNG).
- "Gargantua the Black Hole" by Bl@ke (https://sketchfab.com/Bl_at_ke), Sketchfab Standard license (used in the game only; the model file itself may not be redistributed on its own).
- Grass001, Grass004, Grass005, Ground048, Ground097, Metal032, DaySkyHDRI066B, NightSkyHDRI007, NightSkyHDRI008, IndoorEnvironmentHDRI005 from ambientCG (https://ambientcg.com), CC0.
- Music and sound effects in assets/audio were supplied by the project owner.
- Rumble item icons (`assets/rumble/`, inlined in `js/rumble-icons.js`) were cut from the Rocket League Rumble icon sheet the project owner supplied; they are Psyonix artwork, used here in a non-commercial fan project.

## Dev tools
- `tools/physics-test.js`: headless physics scenarios (paste into the browser console on the game page).
- After editing files in `js/` or `css/`, bump the `?v=` number on the script tags in `index.html` so browsers don't keep old copies.
- Sound effects in `assets/audio/sfx/rl/`: Rocket League game audio (Psyonix) from the RocketLeague-Audio pack, converted to WAV. They're Psyonix's sounds, so keep this copy to your own computers rather than posting it publicly. Settings -> Audio -> Sound Test picks which recording plays for what.
