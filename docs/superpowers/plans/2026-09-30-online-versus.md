# Online versus and sharing

Execute inline with executing-plans. Requirements: share card, Colyseus rooms, create/join/wait/kick, real multiplayer combat, persistent victory/perfect ranking.

1. Publish the generated 1200×630 cover and absolute OG/Twitter metadata.
2. Share the existing combat simulation with the server in headless mode. Authoritative ticks determine damage, rounds and match winners; clients send only actions.
3. Add persistent SQLite guest identities and rankings. Wins count completed best-of-three matches; a perfect win means no damage during that match. Disconnects during a match forfeit without perfect credit. Lobby expulsions award nothing.
4. Colyseus rooms support host ownership, two seats, character selection, ready state, host stage selection, kick/ban, start, return to lobby, timeouts and room closure.
5. Integrate an online lobby and leaderboard into the mode screen. Use existing keyboard/gamepad/touch settings, server snapshots and Phaser presentation.
6. Exercise two real clients, room permissions/lifecycle, ranking persistence, perfect accounting, invalid input, OG metadata, responsive UI and offline regressions. Review, commit, push and deploy the Git stack with a persistent data volume.
