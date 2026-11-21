# ValoSpectra - Client

Spectra is your all-in-one solution for an amazing looking Valorant Tournament Overlay, enabling all Organizers to display information like held gun, available credits etc. with just a single spectator running software.
To learn more and see a live demo, visit [valospectra.com](https://www.valospectra.com/).

It is comprised of three parts:
 - [The Spectra Client](https://github.com/ValoSpectra/Spectra-Client)
   - Running this software on a single in-game observer provides the Spectra Server with all data currently provided by Overwolf.
 - [The Spectra Server](https://github.com/ValoSpectra/Spectra-Server)
   - Ingests data from the Observer Client to reproduce the games state, allowing us to have an accurate representation of the game for further use.
 - [The Spectra Frontend](https://github.com/ValoSpectra/Spectra-Frontend)
   - Receives the game state from the Server every 100 milliseconds, presenting it in a beautiful manner for viewers to enjoy.

Further updates for new features, as well as a detailed setup guide and an easy to host docker container are in the pipeline!

Spectra-Client isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

## Map pool linked to PCMT MapBan

The **Mappool** section now offers **Sync map pool from MapBan session**.
Enter the MapBan public service URL and the same session ID configured in
Production Control, then enable syncing and select **Load / reconnect**.
The default service URL is `https://pcmtmapban.ianmlxdesign.ca`, but it
can be changed. No admin token or Spectra organization code is sent.

This uses the existing read-only MapBan Socket.IO `logon {sessionId}` /
`session_data` interface. The client receives updates when the producer
changes veto picks or map scores, and also reconnects to the saved session
after a client restart. The selected teams' **tricodes must match** those
in Spectra Client, regardless of which side is Team A in MapBan.

The visible three map slots derive from *completed* map scores:

- BO1: only the left slot, as the current decider, or completed history.
- BO3: before any scores, map 1 is current on the left. After map 1,
  the last completed map is left, current map in the middle and next
  map on the right. The third-map decider moves to the right.
- BO5: the display slides to the last completed map on the left, current
  in the middle and next on the right. For map 5, the last two completed
  maps appear at left/centre and the decider at right.
- When a team wins the series early (BO3 2 wins, BO5 3 wins), unplayed
  picks do not become phantom current maps; only the latest played maps
  remain visible. Entering scores out of order produces a warning and
  retains the earliest unscored map as current.

The selected-map picker uses MapBan's `pickedBy` slot matched against
the Spectra team's **tricode**. Completed map scores are remapped into
Spectra's left/right order, even if MapBan's Team A/B order is reversed.
The final decider has no team map-pick logo.

While the client is connected, MapBan updates are delivered using the
authenticated `map_pool_update` Spectra Server event and update the
native overlay without resetting the client, round or live player data.
**This requires the companion PCMT Spectra Server update.** Older servers
will ignore the new live event, but the client still loads the map pool
when it initially connects.

The MapBan veto must be complete enough to determine all selected maps.
If the session is expired, its teams don't match, or the veto has not
selected all maps, the client warns and **retains the last valid map pool**
rather than showing incorrect maps. Disable the sync switch to edit the
three slots manually.
