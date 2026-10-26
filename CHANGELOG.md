# Changelog

What changed in each published version of Chomp 3D: Wally's Cairns Adventure. Newest first. The version
playing shows on the About page. How to publish and roll back: RELEASING.md.

## Unreleased

## v1.0.0-beta.16 (2026-10-26)

- Easier to steer on the keyboard: a tap turns Wally a little and a hold swings him round faster; the turn
  eases as he comes onto food close by, so he stops on it instead of spinning past; and while he runs he
  leans gently toward food landing close ahead. In a controlled test he caught 87.5% of food, up from 64.6%.
- Down turns Wally round to face you, in a smooth half-second turn, and the camera stays put so you can play
  him from the front; Up turns him back round.
- A calmer camera: it follows Wally but only turns once he heads well off to the side, and then gently.
- A camera button beside the speaker (or V, or the pause screen): Auto follows Wally; Manual turns only when
  you turn it, for anyone the moving camera bothers.
- Croc Park runs lighter: about a quarter less work for the computer each frame (the scene is worked out once
  a frame, the water's reflection no longer makes every material be re-checked, and flat rings are drawn
  once). Smoother on phones and older laptops; nothing looks different.

## v1.0.0-beta.15 (2026-10-25)

- The title banner says it plainly: free for anyone to play, no ads, no cookies, no sign-in, a personal
  portfolio piece, and a link to butterflyfx.us for employers and recruiters.

## v1.0.0-beta.14 (2026-10-23)

- Every page, the install details, the Paws card, the About page and the playbutterflyfx.com front
  card now say plainly: "Personal portfolio / skills demonstration: not a commercial product."

## v1.0.0-beta.13 (2026-10-23)

- VR headsets (WebXR, such as the Meta Quest Browser): a VR button appears when a headset is there.
  You stand behind Wally and look around with your head; the view turns in steps for comfort. The
  VR controllers work as a game controller (left stick move, A jump, B duck or dive, right stick
  press turn round, X Paws). A small panel shows the score, feed-o-meter and latest message. Flat
  cards (map, shop, level end) close VR while they are open. Every level.

## v1.0.0-beta.12 (2026-10-23)

## v1.0.0-beta.11 (2026-10-23)

- The title screen and credits no longer lead with the AI tools; how the game was made, and with
  what, is on the About page under How it was made.

- Phones and tablets: the diamond's bottom button now turns Wally right round, quickly. Dive and Up
  (in water) and Duck (on land) moved beside the backpack, out of the way of the diamond, and the Cam
  button is gone (drag the screen to look round).

- Croc Park is gentle the first time through (a tester found level 1 too hard): six groups to feed
  instead of eight, the feed-o-meter empties at 40% speed, visitors are calmer, the throws ramp up
  more slowly, and the food thieves arrive one kind at a time as Wally feeds out each group
  (pelicans, then flying foxes and a croc, then cane toads). A return visit plays as before.

## v1.0.0-beta.10 (2026-10-23)

- Fixed: Wally could get stuck for good beside a rock in the water (once inside its edge, every way out
  counted as blocked). A step out of a rock is now always allowed, everywhere.

- Phones and tablets: a diamond of round buttons replaces the orb (Ken's design): top forward, left and
  right turn, between them forward and turn together, the gold middle jumps, the blue bottom (an arrow under a
  wave) dives or ducks. Hold to keep going; slide between buttons.
- Steadier steering everywhere: the sides turn Wally himself and the camera follows, at a gentler rate. The
  orb's arrows no longer turn with Wally, which made a held push spin him.

## v1.0.0-beta.9 (2026-10-23)

- Fixed: pushing forward on the green orb covered it with a big gold disc and made it unusable (its arrow
  picked up the gold button style). Now only the up arrow lights.

## v1.0.0-beta.8 (2026-10-22)

- Every level explains itself: the first time in each, its purpose and the controls for the device show
  for a few seconds as play begins (no pause; a tap clears it). The touch controls on every level's card
  now describe the green orb.

## v1.0.0-beta.7 (2026-10-21)

- The guide's reef picture is Ken's own screenshot of Green Island and the jetty at dusk.

## v1.0.0-beta.6 (2026-10-21)

- The guide's reef picture shows Wally on the Green Island jetty with the island behind, and the reef's
  entry names Green Island.

## v1.0.0-beta.5 (2026-10-21)

- Green Island at the reef: a long rainforest island with a white beach behind the jetty, and "Green
  Island, Great Barrier Reef" as Wally steps onto the pier.
- The guide (every level, talisman and screenshot) is a Guide button at the top in play, on the title
  screen and at the top of How to play.
- The trailer preview sits top right on the title screen, clear of the buttons.

## v1.0.0-beta.4 (2026-10-21)

- No landing page: the game opens straight on the Wally title screen, whose one Play button starts the
  game. Install the app sits beside Play where the device can install it.

- How to play is its own page (how-to-play.html), opened from the landing page and the title screen,
  with the controls for phones and tablets, computers and controllers, and how the game starts.

- The Esplanade's joggers are real people now (they were the early stand-in figures), running at their
  own heights.
- Tips and notes sit below the buttons on a computer, never over them.

## v1.0.0-beta.3 (2026-10-21)

- The first task is clear from the start: a big gold arrow bobs above the pond over the sceptre, and the
  on-screen arrow points to it with the distance, until Wally finds it.
- As the opening ends: "This is Wally the crocodile, at Croc Park in Cairns, Australia, Far North
  Queensland. Find the sceptre at the bottom of the pond." The objective and the tip name the sceptre.

## v1.0.0-beta.2 (2026-10-21)

- Beta testers page: also look for clunkiness and slow animation or movement, and report any bug, with
  a button straight to the form.

## v1.0.0-beta.1 (2026-10-21)

The official beta release, for the first testers. Expect frequent updates: the game asks to update when
one is out.

- **The trip:** seven levels from Croc Park to the Daintree, the rescue and the ending; six talismans set
  in the King's sceptre; going back to a level makes it harder.
- **Points:** ground catch 1, air catch 2, pickups 1, talismans 3; each level keeps its best completed
  run; return visits count; a personal best and leaderboards for the whole game and each level, without
  ever needing to finish the game.
- **Controls:** the green orb (touch: drag to go and turn, tap to jump; desktop: hover to steer, click to
  jump), the mouse (hold left to go, click to jump, hold right to look), keys, and game controllers.
- **Screens kept clear:** one Play button, then the game; a landing page in the browser; install as an
  app; a menu on phones and tablets; slim tips; the objective tucks away; cards close with Esc or a tap
  outside; Paws.
- **Wardrobe:** outfits for Wally and Kenny, twelve hats (two won, not bought), one currency (Golden
  Mangoes).
- **Respect and safety:** Acknowledgement of Country, a Be Crocwise line, a feedback and takedown form,
  privacy (nothing sold, saved on the device), free to play, PolyForm Strict licence.
- **Updates:** an open game tells the player when a newer version is out, with an Update button.
- **Feedback:** a form for feedback, problems and takedown notices, from the landing page, the title
  screen and any pause; it reaches Ken by email without showing his address. A page for beta testers
  (beta.html): installing, updates, what to try, known rough edges.
- **Tests:** 27 unit suites and a browser suite run against the local and live sites.
