#!/usr/bin/env python3
"""
Bulk-add TV shows to Sonarr from existing library.
Monitor mode: 'future' only - won't re-download existing episodes.
"""
import json, urllib.request, urllib.parse, time, sys

SONARR = "http://localhost:8989"
KEY = "e068e976a5704fd0a74a4abc7bbb393c"
ROOT = "/data/media/tv"

SHOWS = [
    "11.22.63", "16 and Pregnant", "2 Broke Girls", "24", "30 Rock",
    "3rd Rock from the Sun", "A History of Britain", "A Series of Unfortunate Events",
    "About a Boy", "Adventure Time", "Alfred Hitchcock Presents", "Alias",
    "Ally McBeal", "Alone", "America's Test Kitchen", "American Gods",
    "American Horror Story", "American Ninja Warrior", "American Pickers",
    "American Vandal", "An Idiot Abroad", "Andromeda", "Animaniacs",
    "Aqua Teen Hunger Force", "Archer", "Are You Being Served", "Arrested Development",
    "Arrow", "Ascension", "Ash vs Evil Dead", "Atlanta", "Band of Brothers",
    "Banged Up Abroad", "Banshee", "Barry", "Bates Motel", "BattleBots",
    "Battlestar Galactica", "Beforeigners", "Being Human", "Better Off Ted",
    "Big Little Lies", "Big Love", "Billions", "Black Books", "Black Mirror",
    "Black Sails", "Blindspot", "Blue Mountain State", "Boardwalk Empire",
    "Bob and Margaret", "Bob's Burgers", "BoJack Horseman", "Bored to Death",
    "Boston Legal", "Breaking Bad", "Broadchurch", "Brooklyn Nine-Nine",
    "Brotherhood", "Buck Rogers in the 25th Century", "Buffy the Vampire Slayer",
    "Burn Notice", "Californication", "Caprica", "Carnivale", "Castle",
    "Castlevania", "Casual", "Catastrophe", "Cheers", "Chernobyl", "Chopped",
    "Chuck", "Clone High", "Cobra Kai", "Community", "Corner Gas",
    "Courage the Cowardly Dog", "Cowboy Bebop", "Curb Your Enthusiasm",
    "Damages", "Danger 5", "Daria", "Dark Matter", "Dates", "Deadliest Catch",
    "Deadly Class", "Deadwood", "Death Note", "Defying Gravity", "Detectorists",
    "Dexter", "Dexter's Laboratory", "Dirk Gently's Holistic Detective Agency",
    "Doctor Who", "Dollhouse", "Doogie Howser M.D.", "Doom Patrol",
    "Doomsday Preppers", "Downton Abbey", "RuPaul's Drag Race", "Dragon's Den",
    "Drawn Together", "Drunk History", "Dungeons and Dragons", "Early Edition",
    "Eastbound and Down", "Easy", "Elementary", "Elfen Lied", "Emerald City",
    "Entourage", "Episodes", "Eureka", "Everybody Hates Chris", "Extant",
    "Extras", "Face Off", "Family Guy", "Fargo", "Farscape", "Firefly",
    "FlashForward", "Flight of the Conchords", "The Flintstones", "Forged in Fire",
    "Fortitude", "Foster's Home for Imaginary Friends", "Frasier",
    "Freaks and Geeks", "Fresh Off the Boat", "Friday Night Lights", "Friends",
    "Fringe", "Fullmetal Alchemist Brotherhood", "Futurama", "Future Man",
    "Game of Thrones", "Gargoyles", "Garth Marenghi's Darkplace", "Gavin and Stacey",
    "Girls", "Glee", "Good Omens", "Gossip Girl", "Gotham", "Grace and Frankie",
    "Gravity Falls", "Grey's Anatomy", "Grimm", "Halt and Catch Fire", "Hannibal",
    "Happy!", "Happy Endings", "Hell on Wheels", "Hell's Kitchen", "Hemlock Grove",
    "Heroes", "High Maintenance", "Hoarders", "Hogan's Heroes", "Homeland",
    "House", "House of Cards", "House of Lies", "How I Met Your Mother",
    "How to Get Away with Murder", "Humans", "Hustle", "I Am the Night",
    "I Dream of Jeannie", "I'm Sorry", "Ice Road Truckers", "In Treatment",
    "Inside No. 9", "Into the Badlands", "Invader Zim", "It's Always Sunny in Philadelphia",
    "JAG", "Jane the Virgin", "Jeeves and Wooster", "Jem and the Holograms",
    "Jericho", "Jonathan Strange and Mr Norrell", "Junkyard Wars", "Key and Peele",
    "Kyle XY", "My Brilliant Friend", "La Femme Nikita", "Law and Order",
    "Legend of the Seeker", "Leverage", "Lexx", "Life on Mars",
    "Little Dorrit", "Little House on the Prairie", "Live PD", "Lost",
    "Lost Girl", "Love", "Love Island", "Lucifer", "Luther", "M*A*S*H",
    "Mad Men", "Magic City", "Magnum P.I.", "Malcolm in the Middle",
    "Man vs. Wild", "Married at First Sight", "Marvel's Agent Carter",
    "Marvel's Agents of S.H.I.E.L.D.", "The Defenders", "Master of None",
    "MasterChef Australia", "MasterChef", "Masters of Sex", "Metalocalypse",
    "Miami Vice", "Mindhunter", "Misfits", "Modern Family", "Modern Marvels",
    "Monk", "Mr. Mercedes", "Mr. Robot", "Mushishi", "My Name Is Earl",
    "My So-Called Life", "Mystery Science Theater 3000", "MythBusters", "NCIS",
    "Naked and Afraid", "Nashville", "Nathan for You", "New Girl", "Night Court",
    "Nip/Tuck", "Anthony Bourdain: No Reservations", "Northern Exposure", "Nova",
    "Nurse Jackie", "Once Upon a Time", "One Day at a Time",
    "Orange Is the New Black", "Orphan Black", "Outlander", "Over the Garden Wall",
    "Oz", "Parenthood", "Parks and Recreation", "Party Down", "Pawn Stars",
    "Peaky Blinders", "Peep Show", "Penn and Teller: Fool Us", "Penny Dreadful",
    "Person of Interest", "Picket Fences", "The Pink Panther", "Pinky and the Brain",
    "Poldark", "Police Squad!", "Portlandia", "Pretty Little Liars", "Prison Break",
    "Project Runway", "Psych", "Psychoville", "Pushing Daisies", "QI",
    "Ray Donovan", "Reaper", "Red Dwarf", "Reno 911!", "Rescue Me", "Review",
    "Rick and Morty", "Robot Chicken", "Rome", "Salem", "Samurai Jack", "Scandal",
    "Schitt's Creek", "Scrubs", "Seinfeld", "Sex and the City", "Shameless",
    "Shark Tank", "Shaun the Sheep", "Sherlock", "Silicon Valley", "Six Feet Under",
    "Skins", "Sleeper Cell", "Smallville", "Sneaky Pete", "Sons of Anarchy",
    "Southland", "Spartacus: Blood and Sand", "SpongeBob SquarePants", "Spooks",
    "Star Trek", "Star Trek: Deep Space Nine", "Star Trek: Enterprise",
    "Star Trek: The Next Generation", "Star Trek: Voyager",
    "Star Wars: The Clone Wars", "Star Wars Rebels", "Stargate Atlantis",
    "Stargate SG-1", "Steven Universe", "Storage Wars", "Strike Back", "Suits",
    "Supergirl", "Supernatural", "Superstore", "Taboo", "That '70s Show",
    "The 100", "The 10th Kingdom", "The A-Team", "The Alienist",
    "The Amazing Race", "The Americans", "The Big Bang Theory", "The Blue Planet",
    "The Boulet Brothers' Dragula", "The Closer", "The Deuce", "The Dresden Files",
    "The Dukes of Hazzard", "The Exorcist", "The Expanse", "The Fall",
    "The Good Place", "The Good Wife", "The Great British Bake Off",
    "The Handmaid's Tale", "The Hot Zone", "The IT Crowd", "The Incredible Hulk",
    "The Jinx", "The Knick", "The Larry Sanders Show", "Avatar: The Last Airbender",
    "The Last Kingdom", "The Last Ship", "The League", "The Leftovers",
    "The Legend of Korra", "The Librarians", "The Lost Room", "The Love Boat",
    "The Magicians", "The Mandalorian", "The Marvelous Mrs. Maisel", "The Mick",
    "The Mighty Boosh", "The Newsroom", "The Night Manager", "The Office",
    "The Originals", "The Orville", "The Power Puff Girls", "The Riches",
    "Terminator: The Sarah Connor Chronicles", "The Shield", "The Simpsons",
    "The Sinner", "The Sopranos", "The Spanish Princess", "The Strain",
    "The Terror", "The Thick of It", "The Tick", "The Twilight Zone",
    "The Walking Dead", "The West Wing", "The White Princess", "The Wire",
    "The X-Files", "ThunderCats", "Titans", "Tokyo Ghoul", "Top Chef",
    "Top Gear", "Top of the Lake", "Transformers", "True Blood",
    "True Detective", "Turn: Washington's Spies", "Twin Peaks",
    "Two and a Half Men", "Ugly Betty", "Unbreakable Kimmy Schmidt",
    "Under the Dome", "Undercover Boss", "Utopia", "V", "Veep",
    "Veronica Mars", "Vice Principals", "Vikings", "WKRP in Cincinnati",
    "Warehouse 13", "Watchmen", "Wayward Pines", "Weeds", "Westworld",
    "White Collar", "White Lines", "Who Is America?", "Wilfred", "Wings",
    "Wolf Creek", "Wonder Woman", "Wonderfalls", "Workaholics", "Wynonna Earp",
    "You're the Worst", "Zoo", "iZombie", "Cobra Kai", "Scorpion",
    "Atlanta", "Barry", "Brooklyn Nine-Nine",
]

def api(path, method="GET", data=None):
    url = f"{SONARR}{path}"
    headers = {"X-Api-Key": KEY}
    if data:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    else:
        body = None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 400:
            body = e.read().decode()
            if "already" in body.lower():
                return {"_exists": True}
        raise

# Get quality profiles
profiles = api("/api/v3/qualityprofile")
profile_id = profiles[0]["id"]
print(f"Using quality profile: {profiles[0]['name']} (id={profile_id})")

added = []
skipped = []
failed = []

for i, show in enumerate(SHOWS):
    try:
        encoded = urllib.parse.quote(show)
        results = api(f"/api/v3/series/lookup?term={encoded}")
        if not results:
            print(f"  [NOT FOUND] {show}")
            failed.append(show)
            continue

        match = results[0]
        payload = {
            "tvdbId": match["tvdbId"],
            "title": match["title"],
            "qualityProfileId": profile_id,
            "rootFolderPath": ROOT,
            "monitored": True,
            "seasonFolder": True,
            "addOptions": {
                "monitor": "future",
                "searchForMissingEpisodes": False,
                "searchForCutoffUnmetEpisodes": False
            }
        }
        result = api("/api/v3/series", method="POST", data=payload)
        if result.get("_exists"):
            print(f"  [EXISTS]  {show}")
            skipped.append(show)
        else:
            print(f"  [ADDED]   {show} → {match['title']}")
            added.append(show)

        time.sleep(0.3)

    except Exception as e:
        print(f"  [ERROR]   {show}: {e}")
        failed.append(show)

print(f"\n=== Done ===")
print(f"Added:   {len(added)}")
print(f"Existed: {len(skipped)}")
print(f"Failed:  {len(failed)}")
if failed:
    print(f"\nNot found (add manually if wanted):")
    for s in failed:
        print(f"  - {s}")
