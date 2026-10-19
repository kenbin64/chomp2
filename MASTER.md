# Chomp 3D: the master design

What every area is for, how Wally gets out of it, and what he must carry into the next one.
Owner and director: Ken Bingham. Started 2026-10-18; replaces DESIGN-flow.md.

Every line is marked:

- **Decided**: Ken has agreed to it.
- **Proposed**: suggested, waiting for Ken.
- **Open**: not decided yet.
- **Built** / **Not built**: what the code does today, checked against the code on 2026-10-18.

Side-game detail for the golf course is in `DESIGN-golf-course.md`. How to run and test the game is in `WORKING.md`.

---

## The story (Decided)

Wally is an excitable croc in the spirit of a wildlife lover who wants to meet everyone. He was born in
captivity at a croc sanctuary near Cairns, Far North Queensland, and people have always been around him.
Visitors feed him even though the sign says not to. He has learned that if he gets just close enough they
throw him food, and if he gets too close they run away.

He loves food and he wants to get to know people, so he leaves on an adventure. People throw food at him,
hoping he will pay attention to the food and not to them. Some are not afraid, and offer to trade for the
things he has gathered, most of all at the Kuranda markets.

**The core rule** is the sweet spot: close enough to be fed, not so close that people run. **Built**
(`clusterStep` in `js/rules.js`: they notice, throw, give handouts up close, get nervous, flee; the park
sign "Please DON'T feed the croc." in `js/textures.js`).

---

## The ultimate point and the reward (Ken, 2026-10-18)

**The reward is points for a leaderboard: see how far you can go with 3 lives per area.**
- **Built:** 3 lives (`LIVES` in `js/rules.js`); a leaderboard for each area, top 10, with name and score
  checks (`js/leaderboard-rules.js`, covering park, Esplanade, reef and Kuranda).
- **Not built:** a score for the whole trip (how far he got, plus points), and a board for it.
- **Decided:** when the 3 lives in an area are gone, the player retries that same area (a retry, never
  being sent back to an earlier one).
- **Decided:** failing out of an area costs the points and the items obtained in that area on that
  attempt only. What was banked earlier (other areas, earlier finished visits) is kept. This replaces
  Ken's earlier rule "keep what was found, finished or not", which the code still follows: on a failed run
  `bankFinds` keeps the finds (`js/main.js:792`, `js/levels/esplanade.js:712`, `js/levels/reef.js:595`),
  and traders bank mid-run (`bank:` in `js/main.js:169`, `js/levels/esplanade.js:243`).
- **Decided (Ken, 2026-10-18): to keep anything (points, items, things) you must complete the area.**
  Nothing from an attempt is kept until the area is completed, so a trade made during a failed attempt is
  undone too. This applies to everything gained on an attempt: finds, trades, treasure, sidequest gifts,
  stamps and tokens. Return visits follow the same rule.
- **Decided, the exception:** anything earned in another area can never be taken away. Ken's example: the
  Kuranda trader will trade for shells, so Wally goes to the reef and comes back with shells. If he then
  fails Kuranda, the trade is undone, but he does not lose the shells, because they were earned at the
  reef; he gets them back and still has them to trade with. Only what came from the trade is lost.
- **Why, in the story (Ken):** crocs like to hide things. Completing an area is Wally hiding what he
  found there, so it is safe; what he is still carrying in an unfinished area is not hidden yet.
- **Decided, follows from the rule:** going back for something means completing that area again (a
  return-visit challenge) before it counts, and leaving an area partway ends that attempt, so it starts
  fresh when he comes back.
- **Open:** one trip board, the area boards, or both.
- **Decided (Ken, 2026-10-19): leaderboards are available to anyone with a connection.** Today the board
  is kept by the local server (`serve.mjs`, `scores.json`), so only people on Ken's machine share it. Going
  online needs a small hosted service using the same rules (`js/leaderboard-rules.js`). Note: it holds
  players' chosen names and scores, an exception to the server-holds-nothing rule, as KensGames' online
  play already is.
- **Decided (Ken, 2026-10-19):** a failed attempt is not a revisit: trying again is at the same level;
  only a completed return is one level harder. Failure is never punished twice (`failAttempt` in
  `js/trip-rules.js`, tested).

---

## The trip map: how he goes back (Decided, Built)

The map shows a lock on every area not yet reached and an open pin on every area he has been to, plus the
next one once it is earned (`js/mapmodal.js`, `js/tripmap.js`). To go back, the player clicks an open area
on the map; locked areas cannot be entered.
- **Decided (Ken, 2026-10-18):** the next area stays locked until Wally completes all the challenges of
  the area he is in and gets that area's main item. Today `completeArea` opens the next area on finishing
  the area's goal alone (`js/progress.js`). **Open:** what "all the challenges" covers (see below).
- **Corrected 2026-10-19:** an earlier note here said `OPEN_ALL = true` opened every area; nothing read it,
  and it is removed. The map has always locked by real progress; `?all` in the address opens everything,
  for testing only.
- **Built (2026-10-19):** a padlock on the map pin of every place not open yet, and on locked adventure
  markers; on an area's end screen, once it is done and the next is open, "On to <next area>" goes straight
  there (`addNextStop` in `js/mapmodal.js`, for every level).

## The rules of the trip (Decided)

1. **Linear unlock.** Finish an area to open the next.
2. **Open inside.** Once in, an area is free to explore.
3. **Carry forward.** What Wally finds in an area is the most useful thing in the next one.
4. **The market is the exception.** The Kuranda markets take anything he has gathered, if he has enough.
5. **Fibonacci.** Area n needs its main thing from area n-1, plus a smaller thing from area n-2, so every
   area has two roots. A rule the tests can check.
6. **Going back is earned.** Every area he has been to stays open on the map. He goes back only to collect
   what he needs, and a return visit always has a challenge: the items are the reward for meeting it,
   never an easy pick-up.
7. **Each revisit is played one difficulty level higher than the visit before** (Ken, 2026-10-18): from
   easy, visit 2 is intermediate and visit 3 hard. Past hard, the added conditions below (Proposed). Each
   area counts its own visits (Decided): a third reef visit makes the reef hard, not the Esplanade.
   **Challenges keep getting harder** on every return, with no repeats. A count cannot grow past what the
   area holds, so harder also has to come from other conditions (**Proposed:** add one condition per visit:
   count, then clean, then a time limit, then at night, then without gear).
8. **Nobody dies** (Ken, 2026-10-18). No animal dies or is harmed in the game, and neither does Wally: out
   of puff, he lies down in exhaustion until Kenny revives him with Vegemite from his jar, which gives him
   his energy back (**Built**). The jar's label is yellow with red bands and a big red "V" (Ken;
   `tools/jar-label.py`, on `models/jar.glb`); the brand name itself is never shown (MODELS.md). Living animals are never
   collected or traded.
8b. **No circular game.** Wally is never sent back as a punishment. A failure costs a life and Kenny brings
   his jar.
9. **Every area's special main item is in a treasure chest** (Ken, 2026-10-18). One shared chest is
   **Built** (`js/chest.js`: timber, gold bands, a lid that opens, a glow inside), used today in the Croc
   Park lagoon and the reef's coral cave.
    **And every area needs the special item from the area before to enter it the first time** (Ken,
    2026-10-18). After that it is open on the map. Today entry is checked by `entryNeeds` in
    `js/progress.js` (Esplanade: the badge; reef: a pearl; Kuranda: the Skyrail pass; Daintree: the
    river-boat ticket).
10. **Side games are optional.** Nothing on the main chain may need what a side game gives; their rewards
   are bonuses.
11. **The area test.** A main area needs people and food, the two things Wally wants. The cane fields
    failed this and were dropped, along with the croc catchers.
12. **Played if playable, cinema if not** (Ken, 2026-10-19). Anything the player can do, the player does.
    A cinematic is only for what cannot be played: words, feelings, choices made by the story, the
    celebration.

**Difficulty** (Decided in principle): easy, intermediate and hard. Area and difficulty are separate
choices, so they multiply: `meter drain = area ramp x difficulty`, for every life meter (energy and air).
The area ramp is **Built** (`LEVEL_DRAIN` in `js/rules.js`, 0.6 at the park to 1.2 at Mossman); the
difficulty choice is **Not built**.
- Easy: meters run slow in the first few areas (example: half speed for areas 1 to 3, then three quarters).
- Intermediate: the game as it plays now. Hard: faster.
- **Decided:** difficulty also sets collection targets, the same everywhere: any "collect enough" goal in
  any area needs **50% (easy), 70% (intermediate) or 90% (hard)** of what that area holds on that visit,
  rounded up and shown on screen.
- **Open:** whether difficulty also changes how close people let him come and how many thieves there are.

---

## The trip at a glance

| # | Area | Uses from n-1 | Uses from n-2 | Gives the next areas |
|---|---|---|---|---|
| 1 | Croc Park | | | the gate key (from the lagoon chest); Golden Mangoes (found round the park) |
| 2 | The Esplanade | mangoes open the pier | | **the Big Golden Mango**; mangoes (their home) |
| 3 | Great Barrier Reef | the Big Golden Mango pays the giant clam | mangoes pay the boat (Proposed) | **the Skyrail pass** (pirate chest); seashells |
| 4 | Kuranda | seashells and pearls | mangoes | Mossman's item (Open); the river-boat ticket |
| 5 | Mossman Gorge | the Kuranda item (Open) | the snorkel (Proposed) | vine skill, rope (Proposed) |
| 6 | Daintree River, the finale | vine skill (Proposed) | the river-boat ticket | the end of the game |

Side games: the boomerang (Kuranda) and the golf course (in the valley by the Skyrail's lower station). The Barron Falls bungee is on the main path (Kuranda's goal); the zip line is Open.

---

## 1. Croc Park

**Where:** the croc sanctuary on the Northern Beaches, north of Cairns. **Built, playable** (`index.html`, `js/main.js`, `js/world.js`).

**The point (Decided):** home. Where Wally learned the sweet spot, so it is where the player learns it.

**What is here (Built):** groups of visitors round the lagoon who throw food from the boardwalk. Thieves:
pelicans, flying foxes, cane toads and other crocs. Box jellyfish sting. Kenny brings his jar when Wally
runs out of puff. Golden Mangoes to find, some up high. The lagoon chest. Sidequests and traders.

**The goal to get out (Decided):** open the treasure chest on the bottom of the lagoon. Inside is **the
key to the gate** (the park's main item, Ken 2026-10-18), and with it Wally opens the gate and goes out to
the Esplanade. The key replaces the earlier "gate left open".
- **Built today:** the chest opens once every lost thing round it is found (`chestOpens` in
  `js/treasure-rules.js`) and pays 10 Golden Mangoes (`findTreasure` in `js/progress.js`); the gate opens
  on feeding every group and a full meter (`js/quests.js`).
- **Not built:** the key in the chest, and the key opening the gate. The ranger badge (`badge` in
  `js/progress.js`) is replaced by the key.
- **Open:** does the key alone open the gate, or the key plus feeding every group?

**Must collect for what comes next:** the Golden Mangoes found round the park (8 today, some up high).
They open the Esplanade pier (n-1; it costs 8, `PIER_PRICE`, so every one of them) and pay the boat to
Green Island (n-2, Proposed).

---

## 2. The Esplanade

**Where:** the Cairns waterfront. **Built, playable** (`esplanade.html`, `js/levels/esplanade*.js`).

**The point (Proposed):** Wally's first time in the city, among crowds. The sweet spot with many groups along one boardwalk.

**What is here (Built):** a boardwalk course with picnic groups who throw food, Golden Mangoes along it,
the pier (opened with mangoes), swimming under water beside the boardwalk, crawling out, box jellyfish at
the surface and deep. Random every visit.

**The goal to get out (Built):** feed every picnic group, fill the feed-o-meter, reach the Lagoon pool.

**The main item (Decided, Ken 2026-10-18): the Big Golden Mango**, in a treasure chest at the end of the
Esplanade (the Lagoon pool), which opens for collecting the mangoes along the Esplanade walk. It is what pays the giant clam at the
reef (n-1).
- **Built today:** picking up every mango gives a 40-point bonus the moment the last one is caught
  (`MANGO_SET_BONUS` in `js/levels/esplanade-rules.js`, awarded in `js/levels/esplanade.js:524`), not an
  item, and not at the end.
- **How many (Decided, Ken 2026-10-18):** a share of the mangoes on that visit's course, by difficulty:
  **easy half (50%), intermediate 70%, hard 90%.** A share rather than a number, because the course is
  random and its mango count changes every visit (rounded up, and shown on screen as a target). The big mango model sits in the reef's pirate chest
  (`js/levels/reef.js`); it moves here.

**Must collect for what comes next:**
- **The Big Golden Mango** for the reef clam (n-1). **Not built.**
- **Mangoes** for the Kuranda markets (n-2).
- **Pearls no longer come from the Esplanade** (Decided: their home is the reef). Today each group fed out
  to the last bite leaves a pearl, there are more on the pier, and two stamps ask for pearls ("String of
  pearls", "Pearl diver" in `js/book-rules.js`); all of these change.
- **Mangoes:** the Esplanade is their home (Decided), where Wally goes back for them, for the Kuranda markets.
  The trader's go-back button still points at Croc Park (`SOURCE.mangoes` in `js/trade-rules.js`).

---

## 3. The Great Barrier Reef

**Where:** Green Island, off Cairns. **Built, playable** (`reef.html`, `js/levels/reef*.js`).

**The point (Proposed):** the world under the water. The feed-o-meter becomes an air meter.

**What is here (Built):** the Green Island jetty, the dive (Dive and Up buttons), a guide fish and arrow,
a coral maze on the reef, the coral cave with its own maze, the pirate chest, pearls and 32 reef
treasures (starfish, cowries, conch), bubble vents, box jellyfish.

**The goal to get out:**
- **Decided (Ken, 2026-10-18):** a giant clam opens the reef maze, and Wally pays it the Big Golden Mango
  from the Esplanade. The clam needs a proper model (`clam.glb`, to be made; it must open and shut, so it
  is made half open and split into its two shells in Blender). **Open:** a plain clam or a character.
- **Decided (Ken, 2026-10-18):** paid the Big Golden Mango, the giant clam gives Wally **a pearl key**, and
  the pearl key opens the pirate chest at the end of the maze. (A small model, Open: built in code or Meshy.)
  The clam does not block the maze: without the key the chest cannot be opened, so blocking is not needed.
  **Where (Ken, 2026-10-18):** the giant clam sits in one of the maze's dead ends, holding the pearl key;
  then Wally has to find the chest and open it with the key. Model: Ken's Meshy giant clam (2026-10-18).
- **Decided (Ken, 2026-10-18):** Wally can go back to the reef to collect pearls in the maze (for the
  Kuranda markets), under the return-visit rules. **Pearls' home is the reef only** (Decided), so there is
  one source, and it gets harder on every return. **Built:** pearls sit in the cave maze's dead ends
  (`pearlCells` in `js/levels/reef-rules.js`) and in clams across the open reef. The trader's go-back
  button for pearls points at the Esplanade today (`SOURCE.pearls` in `js/trade-rules.js`).
- **Proposed:** remove the second clam at the cave mouth (it shuts behind him and takes a pearl today). With
  one clam, one key and one chest, the swim back out against the air meter is the challenge.
- **Decided (Ken, 2026-10-18):** the pirate chest at the end of the maze holds **the Skyrail pass**, the
  reef's special item and the way into Kuranda. Earned in the maze. Today the pass is given for clearing
  the reef (`completeArea` in `js/progress.js`); there is no fare (`payEntry` does nothing; the comment
  above it in `js/levels/kuranda.js:102` still says a fare is paid and is out of date).
- **Built today:** a pearl is needed to start the dive (`entryNeeds`). The giant clam is at the cave mouth:
  it snaps shut when he takes the pirate chest, and a pearl opens it to get out. Out of the cave and up to
  the surface wins.
- **Open, against the area test:** under the water there are no people throwing food. Do people on the
  jetty or the boat feed him before the dive, or is the reef the one exception to the test?

**Reef treasures (Built, `js/levels/reef-rules.js`):** starfish (near the top, 2 points), cowrie shells
(the middle, 3 points, the most common), conch shells (the bottom, 5 points). Cowries and conches count as
seashells for the Kuranda markets; starfish are points only.
- **Decided (Ken, 2026-10-18): starfish are not a trade item.** They are living animals, and in this game
  no animal dies or is harmed. **Decided (Ken, 2026-10-18):** Wally just touches a starfish, he does not
  take it. It stays where it is, his touch makes it glow, and touching it counts (points, the Tourist Book),
once per starfish per dive. **Not built:** today
  touching one picks it up and it vanishes (`js/levels/reef.js`).

**Must collect for what comes next:** **seashells** for the Kuranda markets (n-1). Clearing the reef
earns the **Skyrail pass** up to Kuranda. **Built.** The snorkel for Mossman (n-2) is **Proposed**.

---

## 4. Kuranda

**Where:** the village in the rainforest, up the range from Cairns by the Skyrail. **Built, playable**
(`kuranda.html`, `js/levels/kuranda*.js`).

**The point (Proposed):** the people axis at its height. The bravest people are here: traders, stallholders, the market.

**What is here (Built):** the market and the street of shops, Ken's art hut and canopy, rainforest all
round. A vendor buys mangoes and shells for gold. The outfit shop, gear, vitamins, the river-boat ticket.

**The goal to get out (Decided, Ken 2026-10-18):** trade at the markets for what he needs to buy a ride
at Barron Falls, then do the **bungee jump**: at the bottom is the item that takes him to the next area,
and he has to grab it. That takes skill: he controls Wally through the jump to get the right angle.
- **The zip line** (Ken): Wally positions his body to collect things as he zips down. **Built**
  (`zipline.html`, steering to catch food as it flies past).
- **The bungee** is **Not built**. Its description is already in `ACTIVITIES` (`js/progress.js`): "snatch
  the prize at the very bottom of the jump".
- **Built today, to change:** the goal is to feed through the markets, fill the meter and reach the Barron
  Falls trail; the rides need stars and a ticket.
- **Changes an earlier decision:** the bungee now gives the main item, so it is on the main path, not an
  optional side game (rule 10). It cannot be opened by stars, or a player short of stars would be stuck.
- **Open:** is the zip line a second way to the item, or an optional ride for collecting things to trade?
- **Open:** is the item at the bottom in a treasure chest (rule 9), and what is it?
- **Open:** do the markets still need feeding (the area test: people and food)?

**Must collect for what comes next:**
- **Mossman's main item**, grabbed at the bottom of the bungee (n-1). **Open:** what it is.
- **The river-boat ticket** for the Daintree (n-2), bought with gold. **Built.** (Proposed instead: the
  ticket goes in Mossman's chest, earned like the Skyrail pass.)

**Activities that earn items (Ken, 2026-10-18):** the boomerang throw is for items. Ken's idea: each
area's own activities (Kuranda: boomerang, zip line, bungee; Mossman: the river rapids; the Daintree: the
river cruise, where passengers throw things, not just food) let Wally get what he needs without always
going back to earlier areas. **Open:** how this sits with rule 6 (going back) and rule 5 (Fibonacci).

**Side games (optional, bonus rewards only):**
- **Boomerang**, taught respectfully by a local guide; Kuranda is Djabugay country (**Built**, `boomerang.html`). Earns items.
- **The golf course**, in the valley below the Tableland next to Cairns, reached by the Skyrail: a buggy
  race and a round of golf (**Not built**, see `DESIGN-golf-course.md`).

---

## 5. Mossman Gorge

**Where:** the gorge in the rainforest above Mossman, north of Cairns. **Not built.**

**The point:** **Open.**

**What is here (notes so far):** river rafts, climbing vines and cliffs, a vine-swinging challenge, a line
across the gorge catching food along it, swimming holes with visitors. The rapids and the line traverse are
listed as star-opened activities today (`ACTIVITIES` in `js/progress.js`). **Open:** main area goals or side games?

**The goal to get out:** **Open.**

**Must collect for what comes next:** the vine skill and rope for the Daintree (n-1). **Proposed.**

---

## 6. Daintree River (the finale)

**Where:** the Daintree, the far north of the trip, rainforest down to the water. **Not built.**

**The point (Decided, Ken 2026-10-19):** the end of Wally's story. He set out loving food and wanting
people to like him; he ends knowing who he is.

**The finale (Decided, Ken 2026-10-19):**
1. **The challenge:** a storm on the river; a cruise boat runs aground and is stuck. Nobody is harmed.
   Wally swings on the vines through the rainforest and runs back home to Croc Park to fetch the crocs,
   bringing what he has learned on the trip, which is what persuades them to come; he shares his stash
   with them (everything collected and not spent; not enough: go back for more), and all the crocs, his old
   rivals from Croc Park, push the boat back to shore. (Ken, 2026-10-19. Not circular: he chooses to go
   back, for others; the story ends forward.) **Decided (Ken, 2026-10-19):** the run back to the park is
   a playable race against time to save the boat (swinging the vines, through the rainforest); Wally
   bringing his new wisdom to the crocs is a cinematic. **Everything up to the rescue is playable** (Ken,
   2026-10-19), by rule 12: the race, sharing the stash with the crocs, leading them to the boat, and the
   push itself (Proposed: the push is playable, it is something to do). Cinema only where nothing can be
   played: the wisdom told to the crocs, the passengers' cheer, Wally's choice, the celebration. (Crocs sharing with crocs: the game's
   never-feed-a-crocodile message is about people.)
2. **The turn (a cinematic):** the passengers, people who threw food to keep him away all game, cheer him.
3. **The choice (a cinematic, Ken 2026-10-19):** with the boat saved, Wally decides not to go back to Croc Park. He realises he is happy
   to be a crocodile and goes into the Daintree River as a wild croc.
4. **The celebration (a cinematic, Ken 2026-10-19):** everyone cheers and celebrates, the cast from the whole trip on the bank.
5. **The last message (Proposed):** Crocwise. "Wally's wild now. If you see a croc in the Daintree, give it
   room. That might be him."
- **It uses everything still in his stash (Decided):** all that was collected and not spent on other
  requirements goes into the finale (Proposed: mangoes for a feast, pearls as gifts, shells as necklaces,
  gold for the party boat), and every leftover adds to the trip score. **Decided (Ken, 2026-10-19):** it
  uses what is left, but if there is not enough, Wally goes back for more (under the going-back rules).
- **Open:** Kenny's farewell (a koala cannot follow Wally into the river).

**What is here (notes so far):** tourists on river boats, swimming, swinging on vines, jumping rock to
rock, running the beach, mangroves.

**The goal to get out:** the end of the game: the boat rescue, then Wally's choice.

**Needs:** the vine skill from Mossman (n-1, Proposed) and the river-boat ticket from Kuranda (n-2).

---

## Build order (Proposed, 2026-10-18)

Each step is tested, and played in a browser where it shows, before the next starts.

0. **Housekeeping:** commit the uncommitted Kuranda forest work and this document, as found, on a branch.
1. **One rules module for the trip** (pure, tested, no drawing): the chain (main items, n-1 and n-2 needs,
   unlock on goal plus main item), difficulty (meter speed, 50/70/90 targets, revisit one level up), and
   keeping things (pending during an attempt, hidden on completing the area, other areas' items never lost,
   trades undone on failure). Every area reads its objectives from it.
2. **One save point:** replace the scattered saves (on failure, mid-trade) with saving on completing the area.
3. **The areas, in order:** Croc Park (key, gate, no badge), the Esplanade (Big Golden Mango, pier price,
   mango button), the reef (the clam takes the Big Golden Mango, the new chest find; needs `clam.glb`),
   Kuranda (pearls and shells into the market, Mossman's item, one gate for the side games).
4. **The difficulty choice** when starting a game.
5. **The leaderboard.**

Then Mossman and the Daintree, once their point and goal are decided.

**Models to make:** `clam.glb` (prompt in MODELS.md); the gate key (Open: built in code or a Meshy prop).

## Release (notes, 2026-10-18)

- **Platforms, in order (Proposed):** itch.io and web game portals from the current code (the portals need
  the model reduction: small, fast-loading files); then Steam and Epic as a desktop build (Electron or
  Tauri) from the same code; consoles only if the game takes off, which needs a port to a game engine.
- **Meshy models:** Ken is on a paid Meshy plan (2026-10-18), which covers commercial use of models made
  while on it. Check that no model in the game was made before the plan started.
- **Names to check before selling:** "Skyrail" (a real company's cableway, used as the ride's name) and the
  V jar (yellow label, red band). Real place names (Cairns, Kuranda, Mossman) are fine.
- **Showing it to Cairns (Ken, 2026-10-18):** the trip is a real itinerary (a croc park, the Esplanade,
  Green Island and the reef, the Skyrail, the Kuranda markets, Barron Falls, Mossman Gorge, a Daintree river
  cruise) and it promotes tourism, shopping in Kuranda included. Prepare: a croc-safety ("Be Crocwise")
  message, since the hero is a croc people feed; respectful portrayals (the boomerang taught by a Djabugay
  guide); a clean demo link and a one-page summary.
- **Cultural review (Ken, 2026-10-18):** Ken will run the characters past a friend in Cairns who is a Torres
  Strait Islander. If Cairns is interested, they are told they can change any character, add characters,
  and make sure cultural sensitivities are observed. tourist-4 (Torres Strait auntie) is right as she is:
  a true representation of people like those Ken knows, not a likeness of any real person (2026-10-18). Characters to review first: tourist-11 (young Aboriginal woman; her dress print looks like Aboriginal art), and the
  Djabugay guide who teaches the boomerang (ask the Djabugay community how they wish to be shown).
- **No real people's likenesses (Ken, 2026-10-18):** Ken checks that Meshy is not giving him faces of
  actual people. Prompts never name a real person; a reverse image search of a character's picture (Google
  Lens, TinEye) is a quick check.
- **The people's style (Ken, 2026-10-18):** every person has a cartoon, animated-feature look, which keeps
  them clear of real likenesses; but they are respectful, never comical. Stylised, not caricatured.
- **Show culture, don't hide it (Ken, 2026-10-18):** people should not be made so generic that their culture
  disappears. The aim is culture shown truly and specifically, with the community's say, rather than
  removed to be safe. What to avoid is stereotypes and AI-made imitations of traditional art; what to seek
  is real detail, for example a print licensed from an Indigenous designer and credited. This replaces the
  older MODELS.md wording "nothing meant to signal a culture".
- **Clean:** sky and surface pictures are CC0 (Poly Haven, ambientCG); three.js is MIT.

## Open decisions, in order

0. The reward: a trip board, area boards, or both.
1. Croc Park: does the key alone open the gate, or the key plus feeding every group?
2. Reef: the clam plain or a character; remove the cave-mouth clam (Proposed).
3. Reef: people feeding him at the jetty, or the reef as the one exception to the area test.
4. Kuranda: the item grabbed at the bottom of the bungee (in a chest?); the zip line a second way or optional; do the markets still need feeding.
5. Rides at Barron Falls: bought with a ticket (no stars on the main path); the boomerang and golf gates.
6. Return challenges: add one condition per visit (Proposed), and do rewards grow with the challenge?
7. Difficulty: also how close people let him come and the number of thieves?
8. Mossman and the Daintree: the point and the goal of each.
