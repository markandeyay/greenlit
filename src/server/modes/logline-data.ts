// Logline mode content (Section 5, WS9). SERVER ONLY: never import from a client component.
//
// Every logline here was written in-house for this game (Section 15). None is copied or
// paraphrased from TMDB, IMDb, Wikipedia or any other synopsis source.
//
// Keyed by film id (TMDB id, as in the library). Exactly LOGLINE.tiers (4) tiers per film, most
// vague first:
//   1. cryptic but fair: no names, no title words, no years
//   2. a bit more concrete
//   3. clearly evocative (props, set pieces)
//   4. nearly gives it away, still without any word of the title
// tests/unit/modes/logline/content.test.ts enforces the rules (tier count, title words, dashes).
import 'server-only';

export type LoglineTiers = readonly [string, string, string, string];

export const LOGLINES: Readonly<Record<number, LoglineTiers>> = {
  // Star Wars
  11: [
    'A bored farm kid on a dry world gets a message that was never meant for him.',
    'A runaway royal, a pair of bickering machines and an old hermit pull a desert orphan into a rebellion.',
    'A hotshot smuggler, his towering furry co-pilot and a farm boy try to rescue a princess from a battle station the size of a moon.',
    'An old knight hands a farm boy his father\'s lightsaber, and a planet-killing space station must be stopped with one torpedo down an exhaust port.',
  ],
  // Finding Nemo
  12: [
    'A nervous father who never takes risks must cross a vast, hostile expanse to bring his only child home.',
    'After his son is snatched by a diver, a worried dad teams with a cheerful stranger who forgets everything within seconds.',
    'Sharks in a support group, surfer turtles riding a current and a dentist\'s aquarium full of schemers stand between a clownfish and his boy.',
    'A clownfish swims from the reef to Sydney harbor with a forgetful blue tang to rescue his son with the lucky fin.',
  ],
  // Forrest Gump
  13: [
    'A kind man with a simple outlook stumbles through decades of history without ever quite noticing.',
    'Sitting at a bus stop, a gentle Southerner tells strangers about his life: football, war, ping pong and the girl he has loved since childhood.',
    'He teaches a young singer a famous hip shake, jogs across the country more than once and starts a shrimp company with his old army lieutenant.',
    'Life is like a box of chocolates, says a slow-talking Alabama man whom everyone keeps telling to run.',
  ],
  // Kill Bill: Vol. 1
  24: [
    'A woman wakes from a very long sleep with a list of names and a very sharp grudge.',
    'Left for dead at her own wedding rehearsal, a former assassin hunts the team that betrayed her, one name at a time.',
    'A yellow tracksuit, a sword forged by a retired master in Okinawa and a showdown against a small army in a Tokyo restaurant.',
    'The Bride carves through the Crazy 88 and a Tokyo crime queen in the first half of a two-part revenge saga.',
  ],
  // Raiders of the Lost Ark
  85: [
    'A professor with a side job keeps getting into trouble far from the lecture hall.',
    'An archaeologist races a rival and a squad of soldiers across continents for a relic said to hold unthinkable power.',
    'A rolling boulder, a pit full of snakes, a bullwhip, a fedora and a truck chase through the Egyptian desert.',
    'A professor in a fedora races the Nazis for the chest that held the Ten Commandments, and is warned not to look when it opens.',
  ],
  // Gladiator
  98: [
    'A trusted soldier loses everything in one night and vows to settle the account in public.',
    'Betrayed by a jealous heir and sold into slavery, a decorated general fights his way back toward the man who murdered his family.',
    'Sand, swords and tigers in the Colosseum, where a masked fighter wins over the crowd and terrifies a young emperor.',
    'A Roman general turned arena fighter asks the crowd whether they are entertained and promises vengeance in this life or the next.',
  ],
  // Taxi Driver
  103: [
    'A lonely man who cannot sleep spends his nights watching a city he despises.',
    'A sleepless veteran working the night shift grows obsessed with cleaning up the streets he roams looking for fares.',
    'He takes a campaign worker to a dirty movie, buys a stack of handguns and decides to rescue a young runaway.',
    'A mohawked New York cabbie talks to his mirror and asks whether you are talking to him.',
  ],
  // Back to the Future
  105: [
    'A teenager takes a wrong turn and nearly erases himself.',
    'Accidentally sent decades into the past, a high schooler must make sure his own parents fall in love or he will never be born.',
    'A plutonium-powered sports car, a skateboard chase and a lightning bolt striking a clock tower at exactly the right moment.',
    'A DeLorean has to hit 88 miles per hour to send a teen and his wild-haired scientist friend home to the eighties.',
  ],
  // The Big Lebowski
  115: [
    'A man who wants nothing more than a quiet evening is dragged into somebody else\'s mess over a rug.',
    'Mistaken for a millionaire with the same name, a laid-back slacker is tangled up in a bungled kidnapping and a briefcase full of dirty laundry.',
    'White Russians, bowling league grudges, German nihilists and a rug that really tied the room together.',
    'The Dude abides through a botched ransom, a severed toe and a bowling tournament in Los Angeles.',
  ],
  // The Lord of the Rings: The Fellowship of the Ring
  120: [
    'Someone small inherits something small that turns out to be the most dangerous object in the world.',
    'A homebody leaves his village carrying a cursed heirloom, joined by friends, a wizard and warriors who do not trust each other.',
    'Hooded riders on black horses, a fiery demon on a crumbling bridge in the mines and a wizard who declares that nobody shall pass.',
    'Nine companions set out from an elven haven to carry a hobbit\'s golden burden toward the volcano in Mordor, the first chapter of a trilogy.',
  ],
  // The Dark Knight
  155: [
    'A city\'s protector meets someone who only wants to watch everything burn.',
    'A masked vigilante, a principled district attorney and a police lieutenant face a criminal with no plan, no motive and no fear.',
    'A pencil trick, a hospital in flames, two ferries rigged with explosives and a scarred prosecutor flipping a coin.',
    'The caped crusader of Gotham faces a grinning anarchist in clown makeup who asks why he is so serious.',
  ],
  // Ocean's Eleven
  161: [
    'A man fresh out of prison already has a plan, and he needs a crew.',
    'A smooth thief recruits a team of specialists to rob three casinos at once, all owned by the man now dating his ex-wife.',
    'A pickpocket, an acrobat, a pair of bickering brothers and a fake SWAT team descend on a Las Vegas vault during a boxing match.',
    'A slick ex-con assembles a crew of a dozen minus one to empty the vault beneath the Bellagio.',
  ],
  // The Godfather
  238: [
    'A son who wanted no part of the family business discovers he is very good at it.',
    'After an attempt on the life of an aging crime patriarch, his war hero youngest son steps in and changes everything.',
    'A severed horse head in a bed, a pistol hidden behind a restaurant toilet and a baptism intercut with a string of murders.',
    'A Sicilian-American crime dynasty in New York makes offers that cannot be refused, as the Don hands his empire to his youngest son.',
  ],
  // Batman Begins
  272: [
    'A rich orphan travels the world to learn how to master fear, then comes home.',
    'A billionaire whose parents were murdered trains with a secret society in the mountains before returning to protect his corrupt city.',
    'A cave full of bats, a car built like a tank, a fear toxin in the water supply and a burlap scarecrow mask.',
    'The origin of Gotham\'s caped vigilante, from the death of his parents to his first clash with the League of Shadows.',
  ],
  // The Silence of the Lambs
  274: [
    'A student is sent to ask a dangerous expert for advice, and he wants something personal in return.',
    'An FBI trainee interviews an imprisoned psychiatrist and cannibal to catch a serial killer who is still out there.',
    'A glass cell, a face mask strapped on for transport, a moth in a victim\'s throat and quid pro quo questions about childhood.',
    'A young FBI agent trades memories with a brilliant cannibal who once ate a census taker\'s liver with fava beans.',
  ],
  // Fargo
  275: [
    'A man in serious debt decides the solution is to have his own wife kidnapped.',
    'A desperate car salesman\'s fake kidnapping spirals into bloodshed, and a very pregnant police chief starts asking polite questions.',
    'Snowbound highways, a tan sedan, a lot of folksy small talk and a wood chipper in the backyard.',
    'A small-town Minnesota police chief, seven months pregnant, investigates a botched ransom scheme in the frozen north.',
  ],
  // The Shawshank Redemption
  278: [
    'A quiet man is convicted of a crime he says he did not commit, and he is very patient.',
    'A banker sentenced to life for killing his wife befriends an inmate who can get anything and slowly earns the warden\'s trust.',
    'A rock hammer, a poster on a cell wall, a library built from scratch and a crawl through a sewer pipe to freedom.',
    'Two lifers in a Maine prison hold on to hope for decades, until one escapes through a tunnel hidden behind a pin-up poster.',
  ],
  // Terminator 2: Judgment Day
  280: [
    'Someone sent from far ahead to destroy a child faces someone sent to protect him.',
    'A boy destined to lead humanity\'s resistance is hunted by a liquid metal assassin and guarded by a reprogrammed killing machine.',
    'A shotgun twirled on a motorcycle, a molten pursuer who walks through prison bars and a thumbs up while sinking into molten steel.',
    'The cyborg from the first film returns as a bodyguard who says hasta la vista, baby, to stop the robot apocalypse.',
  ],
  // Jurassic Park
  329: [
    'A billionaire invites experts to approve his new attraction, and the attraction has opinions.',
    'A paleontologist, a mathematician and two kids are trapped at an island resort when the power fails and the exhibits escape.',
    'A ripple in a cup of water, raptors in a kitchen and a goat that vanishes from its pen.',
    'Cloned dinosaurs break loose on a tropical island resort, and life, uh, finds a way.',
  ],
  // Schindler's List
  424: [
    'A man who came to make money ends up spending it to save lives.',
    'A war profiteer and party member in occupied Poland quietly turns his factory into a refuge for his Jewish workers.',
    'Shot in black and white except for a little girl in a red coat, among the ghettos and camps around Krakow.',
    'A German industrialist saves more than a thousand Jews by writing their names on a factory roster, and weeps that he could have saved more.',
  ],
  // Good Will Hunting
  489: [
    'A young man with a gift nobody asked for prefers to keep mopping floors.',
    'A South Boston janitor at a famous university solves impossible math problems in secret, and only a therapist can get through to him.',
    'Anonymous proofs on a hallway chalkboard, a park bench monologue and a best friend who hopes one morning his buddy is simply gone.',
    'A math genius from Southie learns it is not his fault, with help from a widowed therapist and his friends from the neighborhood.',
  ],
  // Fight Club
  550: [
    'A man who cannot sleep finds an unusual cure in the basement of a bar.',
    'An insomniac office worker meets a charismatic soap salesman, and their after-hours brawling society grows into something far more dangerous.',
    'Support groups for diseases he does not have, a burned-out condo, homemade soap and a set of rules you are not supposed to talk about.',
    'The first rule is that you do not talk about it, says a soap maker as a narrator\'s bare-knuckle society turns into an anarchist army.',
  ],
  // Jaws
  578: [
    'A beach town would rather keep its summer season than its swimmers.',
    'A new police chief who hates the water joins a scientist and a salty fisherman to hunt the predator terrorizing his island.',
    'Two notes of music, yellow barrels, a sinking boat and a tank of compressed air.',
    'A great white shark stalks Amity Island, and the chief decides they are going to need a bigger boat.',
  ],
  // Titanic
  597: [
    'An elderly woman tells the story of the week that changed her life, and of a necklace.',
    'A penniless artist and an engaged aristocrat fall for each other aboard a luxury liner on its maiden voyage.',
    'A sketch of a woman wearing a blue diamond, a car in the cargo hold, a door floating in freezing water and a promise to never let go.',
    'On the unsinkable ship, a steerage artist stands at the bow and shouts that he is king of the world, days before an iceberg.',
  ],
  // E.T. the Extra-Terrestrial
  601: [
    'A lonely kid finds someone in the backyard who is even further from home.',
    'A boy in the suburbs hides a stranded visitor from another planet in his closet while government agents close in.',
    'A trail of candy, a glowing fingertip, a wilted flower brought back to life and a disguise on Halloween.',
    'A gentle alien wants to phone home, and a boy\'s bicycle flies across the moon to help him escape.',
  ],
  // The Matrix
  603: [
    'A man who works at a desk by day suspects the world itself is a lie.',
    'A hacker is offered a choice between two pills and learns that humanity is trapped in a simulation run by machines.',
    'Bullets that slow down, a lobby shootout, a spoon that does not exist and green code raining down the screens.',
    'Take the red pill, says a man in tiny sunglasses, and a hacker learns kung fu in seconds and dodges bullets on a rooftop.',
  ],
  // Catch Me If You Can
  640: [
    'A teenager discovers that confidence opens doors that credentials never could.',
    'A runaway teen poses as a pilot, a doctor and a lawyer while writing millions in bogus checks, with a dogged FBI agent on his trail.',
    'Pan Am uniforms, forged paychecks, a phone call every Christmas Eve and an agent who keeps missing his man by minutes.',
    'The true story of a young forger who impersonated an airline pilot, until the FBI agent chasing him hired him instead.',
  ],
  // Aliens
  679: [
    'The sole survivor of a nightmare is asked to go back, and this time she brings company.',
    'After decades adrift, a warrant officer returns to a colonized moon with a squad of space marines to learn why the colonists went silent.',
    'A power loader, motion trackers beeping faster, a little girl hiding in the vents and a queen laying eggs.',
    'A survivor straps into a robotic cargo loader to battle the hive queen while colonial marines are torn apart by acid-blooded xenomorphs.',
  ],
  // Pulp Fiction
  680: [
    'A few bad days in one city, told out of order.',
    'Two philosophical hitmen, a boxer who refuses to throw a match and a gangster\'s wife cross paths in a tangle of crime stories.',
    'A twist contest at a retro diner, an adrenaline shot to the heart, a gold watch and a briefcase that glows.',
    'A Royale with cheese, a Bible verse recited before a shooting and a dance contest in a set of Los Angeles crime vignettes.',
  ],
  // The Shining
  694: [
    'A writer takes a quiet job to get some work done, and the job is very quiet.',
    'A struggling author becomes the winter caretaker of an isolated mountain hotel with his wife and son, who has psychic visions.',
    'Twin girls in a hallway, a tricycle on patterned carpet, a hedge maze and elevator doors pouring blood.',
    'All work and no play makes a caretaker go mad at the Overlook Hotel, where he smashes through a bathroom door with an axe.',
  ],
  // GoodFellas
  769: [
    'A boy decides early that being a gangster is better than being anybody else.',
    'A half-Irish kid from Brooklyn rises through the mob, but cocaine and paranoia threaten everything he has built.',
    'A long tracking shot through a nightclub kitchen, a man asking whether he is funny and helicopters overhead during a frantic day of errands.',
    'Based on a real informant, a wiseguy recounts three decades with the New York mob, from an airport heist to witness protection.',
  ],
  // Se7en
  807: [
    'A detective a week from retirement gets one last case, and it has a pattern.',
    'A weary veteran and a hotheaded rookie track a killer who stages each murder as a lesson about a deadly sin.',
    'Endless rain, notebooks filled with tiny handwriting, a man fed until he bursts and a cardboard box in the desert.',
    'Two detectives chase a killer who punishes gluttony, greed, sloth, lust, pride, envy and wrath, ending with the question of what is in the box.',
  ],
  // Saving Private Ryan
  857: [
    'A small group is ordered to risk everything to bring one man home.',
    'After the Normandy landings, a captain leads a squad through occupied France to find a paratrooper whose brothers have all been killed.',
    'A brutal opening on Omaha Beach, a sniper in a bell tower and a final stand at a bridge in a ruined town.',
    'Earn this, a dying captain tells the soldier his squad crossed France to send home to his grieving mother.',
  ],
  // Toy Story
  862: [
    'A favorite is threatened by the arrival of someone newer and shinier.',
    'A pull-string cowboy doll fears being replaced when his kid gets a space ranger action figure for his birthday.',
    'Green army men on a recon mission, a claw machine worshipped by little aliens and a cruel neighbor who blows up playthings.',
    'To infinity and beyond, says a space ranger who does not know he is a plaything, while a cowboy sheriff tries to get them both home.',
  ],
  // The Prestige
  1124: [
    'Two rivals in the same profession will do anything to beat each other.',
    'In Victorian London, two stage magicians feud for years after a trick goes fatally wrong, each trying to steal the other\'s secrets.',
    'A canary in a cage, a diary written in code, an inventor in Colorado and a machine that crackles with electricity.',
    'Are you watching closely? Two Victorian illusionists obsess over a vanishing man trick, with help from a famous electrical inventor.',
  ],
  // Rocky
  1366: [
    'A nobody gets a shot that nobody expected him to take seriously.',
    'A small-time Philadelphia boxer who collects debts for a loan shark is picked to face the heavyweight champion as a publicity stunt.',
    'Raw eggs for breakfast, punching sides of beef in a meat locker and a run up the art museum steps.',
    'A southpaw underdog nicknamed the Italian Stallion goes the distance with the champ and yells for his girlfriend in the ring.',
  ],
  // The Departed
  1422: [
    'Two men pretend to be what they are not, on opposite sides of the same war.',
    'A cop goes undercover inside a Boston gang while a gangster\'s protege rises inside the state police, and each is hunting the other.',
    'An elevator, a dropped envelope, a rat crawling across a balcony and a mob boss who quotes his own philosophy.',
    'A remake of a Hong Kong thriller about moles in the Massachusetts police and the Irish mob, where nearly everyone ends up dead.',
  ],
  // Iron Man
  1726: [
    'A wealthy inventor learns what his products do when they are pointed at him.',
    'A billionaire weapons maker is kidnapped by insurgents and builds a powered suit to escape, then decides to change his business.',
    'A cave workshop, a glowing reactor in his chest, a hot rod red and gold suit and a press conference confession.',
    'A genius playboy philanthropist in red and gold armor tells reporters that he is the hero, kicking off a superhero universe.',
  ],
  // No Country for Old Men
  6977: [
    'A hunter finds money that does not belong to him and decides to keep it.',
    'A welder stumbles on a drug deal gone wrong and takes the cash, putting a relentless killer and a weary sheriff on his trail.',
    'A coin toss at a gas station, a captive bolt pistol, a terrible haircut and a briefcase in an air vent.',
    'Call it, says a hitman with a cattle gun and a pageboy bob, as an aging Texas sheriff reflects on a world turning savage.',
  ],
  // The Lion King
  8587: [
    'A young heir runs from the place he belongs after being told a terrible lie.',
    'After his father is murdered by a jealous uncle, an exiled cub grows up carefree in the jungle before returning to claim his throne.',
    'A wildebeest stampede, a carefree warthog and meerkat, a baboon holding a newborn over a cliff and hyenas in a graveyard.',
    'Hakuna matata, sing two friends to a cub destined to rule Pride Rock, until his father\'s ghost tells him to remember who he is.',
  ],
  // Shutter Island
  11324: [
    'A lawman arrives to find someone who is missing, and the place does not want to let him leave.',
    'A US marshal investigates the disappearance of a patient from a hospital for the criminally insane as a storm cuts off any way home.',
    'Secrets in a lighthouse, migraine flashbacks to a liberated camp, a burning match and a note asking about patient sixty-seven.',
    'In the fifties, a federal marshal hunting a vanished murderess at a Boston Harbor asylum starts to question his own sanity.',
  ],
  // Up
  14160: [
    'A grumpy widower finally keeps a promise, and an uninvited guest comes along.',
    'A retired balloon seller floats his home toward South America, with an eager young scout stuck on the porch.',
    'Thousands of balloons, a talking dog with a special collar, a giant colorful bird and an adventure book with blank pages.',
    'A widower ties countless balloons to his house to reach Paradise Falls, with a wilderness scout earning his badge for assisting the elderly.',
  ],
  // Inglourious Basterds
  16869: [
    'Several plans to end a war converge on one night at the movies.',
    'A squad of Jewish-American soldiers hunts occupation troops in France while a cinema owner plots her own revenge.',
    'A dairy farmer hiding a family beneath his floor, a card game in a basement tavern, a carved forehead and a premiere that ends in flames.',
    'A smiling SS colonel nicknamed the Jew Hunter, a scalp-collecting lieutenant from Tennessee and a theater full of Nazi leaders.',
  ],
  // Avatar
  19995: [
    'A man who cannot walk is given a new body and starts to prefer it.',
    'A paralyzed marine controls a lab-grown alien body on a distant moon and falls for the people he was sent to displace.',
    'Floating mountains, glowing forests, winged beasts tamed in midair and a sacred tree sitting on a fortune in rare ore.',
    'On the jungle moon Pandora, tall blue natives fight off a mining corporation after a marine switches sides.',
  ],
  // The Avengers
  24428: [
    'A group of very large personalities is forced to share a room, and a threat arrives before they can stop arguing.',
    'A spy agency director assembles a team of heroes to stop a trickster god and an alien army pouring through a portal over New York.',
    'A flying aircraft carrier, a green rage monster, a shawarma lunch and a battle above Manhattan.',
    'A billionaire in armor, a super soldier, a thunder god, two assassins and a giant green scientist team up for the first time.',
  ],
  // Inception
  27205: [
    'A thief who steals from a very private place is asked to leave something behind instead.',
    'A specialist who invades dreams leads a team on a job to plant an idea deep in an heir\'s mind, layers below the surface.',
    'A spinning top, a hallway fight with no gravity, a city folding over itself and a train crashing down a busy street.',
    'Dreams within dreams within dreams, a totem that may never stop spinning and a thief haunted by his late wife.',
  ],
  // The Truman Show
  37165: [
    'A cheerful man\'s life is perfect, perhaps a little too perfect.',
    'An insurance salesman slowly realizes his entire life is a television program watched by millions.',
    'A stage light falling from a clear sky, product placement in the middle of conversations, a sailboat and a wall painted like the sky.',
    'In case I do not see you, good afternoon, good evening and good night, says a man raised on a giant reality TV set.',
  ],
  // The Social Network
  37799: [
    'A brilliant student gets dumped and builds something that changes how everyone talks to each other.',
    'A Harvard undergrad creates a website that becomes a billion-dollar company, then gets sued by his best friend and a pair of rowing twins.',
    'Deposition rooms, a rowing race at Henley, a hacked dorm night and a business card that says he is the CEO.',
    'The creation story of a famous friend-collecting website, told through the lawsuits against its awkward young founder.',
  ],
  // 21 Jump Street
  64688: [
    'Two former classmates get a second chance at school, this time with badges.',
    'Two bumbling rookie cops go undercover as high schoolers to bust a synthetic drug ring and swap social roles along the way.',
    'A prom night shootout, a car chase past tankers that refuse to explode and a drug that makes you laugh before it wrecks you.',
    'A buddy cop comedy remake of an old TV show about youthful-looking officers working undercover in a high school.',
  ],
  // Django Unchained
  68718: [
    'A freed man and an unlikely partner set out to rescue someone very dear.',
    'A German bounty hunter frees an enslaved man, and together they ride to a Mississippi plantation to rescue his wife.',
    'A giant tooth bobbing on a dentist\'s wagon, a dinner lecture with a skull, a handshake that goes wrong and a mansion blown sky high.',
    'A former slave turned bounty hunter takes on a cruel plantation owner in a bloody antebellum Western.',
  ],
  // Mad Max: Fury Road
  76341: [
    'A drifter is captured and ends up helping a group escape across a wasteland.',
    'A one-armed truck driver smuggles five captive wives out of a tyrant\'s citadel with a war party in pursuit.',
    'A flamethrower guitar on a speaker truck, war boys spraying chrome on their mouths, polecats on swaying poles and a sandstorm.',
    'Witness me, cry the war boys as a lone ex-cop and an imperator flee a water tyrant in a post-apocalyptic desert chase.',
  ],
  // The Wolf of Wall Street
  106646: [
    'A young man discovers he can sell anything to anyone and keeps going far past where he should stop.',
    'A stockbroker builds a penny stock empire on fraud, excess and drugs, until the FBI starts paying attention.',
    'Sell me this pen, a yacht caught in a storm, quaaludes on a country club floor and a chest-thumping chant at lunch.',
    'The memoir of a Long Island broker whose firm swindles investors to pay for a life of total decadence in the financial district.',
  ],
  // The Grand Budapest Hotel
  120467: [
    'A man devoted to his work and his guests is suddenly accused of murder.',
    'A legendary concierge and his loyal lobby boy are framed for killing a wealthy widow and fight to clear their names.',
    'A stolen painting of a boy with an apple, pastry boxes hiding tools, a ski chase and a prison break.',
    'In a fictional mountain republic, a perfumed concierge and his lobby boy race through a pink pastel caper framed in perfect symmetry.',
  ],
  // The Lego Movie
  137106: [
    'An ordinary worker who follows every instruction is mistaken for the most important person alive.',
    'A cheerful construction worker is believed to be the chosen one destined to stop a tyrant from gluing his world in place.',
    'The piece of resistance, master builders, a cowboy town, a land of rainbow nonsense and a superglue weapon called the Kragle.',
    'Everything is awesome for a little yellow minifigure who teams with a brooding caped hero to save a world of plastic bricks.',
  ],
  // Interstellar
  157336: [
    'A father leaves to save his children\'s future, not knowing how long he will be gone.',
    'As crops fail on a dying Earth, a former pilot leads a mission through a wormhole to find a new home for humanity.',
    'A water planet with mountainous waves, a robot shaped like a monolith, a bookshelf that sends messages and a spinning docking maneuver.',
    'A space traveler watches his daughter age decades while he spends hours near a black hole, and becomes the ghost in her bedroom.',
  ],
  // Gone Girl
  210577: [
    'On their anniversary, a man\'s wife disappears, and he does not seem upset enough.',
    'When his wife vanishes, a Missouri husband becomes the prime suspect, but her diary tells a very different story.',
    'Treasure hunt clues, a box cutter, a monologue about pretending to be effortlessly easygoing and a press conference that goes badly.',
    'A missing wife is presumed murdered and the media turn on her husband, until it emerges that she planned everything.',
  ],
  // Whiplash
  244786: [
    'A young musician wants greatness, and his teacher is willing to break him to get it.',
    'An ambitious jazz drummer at an elite conservatory is pushed to the brink by a brutal bandleader.',
    'Bleeding hands, a thrown chair, a car crash on the way to a concert and the question of whether he was rushing or dragging.',
    'Not quite my tempo, screams a terrifying conductor at a student drummer, ending in a solo of pure defiance.',
  ],
  // The Revenant
  281957: [
    'A man left for dead crawls back toward the people who left him.',
    'On the frozen American frontier, a fur trapper mauled by a bear seeks revenge on the man who killed his son.',
    'A grizzly attack, a night spent inside a dead horse, a raw fish snatched from a river and a long trek through snow.',
    'Mauled by a bear and buried alive, a frontiersman drags himself hundreds of miles across the wilderness to avenge his son.',
  ],
  // Black Panther
  284054: [
    'A new ruler of a hidden place must decide whether to keep its secrets.',
    'A young king of a secretly advanced African nation faces a challenger who wants to share its technology with the world.',
    'Vibranium, ritual combat at a waterfall, a casino in Busan and a sister who designs every gadget.',
    'Wakanda forever, salute the people of a hidden kingdom as their king in a feline suit fights his own cousin for the throne.',
  ],
  // Avengers: Endgame
  299534: [
    'After losing, the survivors find one more chance to undo the worst moment in history.',
    'Five years after half of all life vanished, a team of heroes plans a heist through the past to set things right.',
    'Quantum suits, a return trip to an old battle in New York, a giant field battle and one more snap of the fingers.',
    'Earth\'s mightiest heroes reverse a purple titan\'s snap, and a genius in armor makes the final sacrifice.',
  ],
  // La La Land
  313369: [
    'Two dreamers meet in a city full of dreamers and must choose between love and ambition.',
    'An aspiring actress and a jazz pianist fall in love in Los Angeles while chasing careers that pull them apart.',
    'A traffic jam dance number, a tap dance on a hillside at dusk, an observatory and an epilogue imagining what might have been.',
    'City of stars, sing a struggling actress and a stubborn jazz purist in a modern Hollywood musical.',
  ],
  // Arrival
  329865: [
    'A specialist is asked to talk with visitors, and it changes how she remembers everything.',
    'When mysterious ships touch down across the world, a linguist races to decode their language before nations go to war.',
    'Ink circles on glass, seven-limbed beings behind a screen, a phone call to a Chinese general and a daughter with a palindrome for a name.',
    'A linguist learns a language that lets her see the future, as twelve shell-shaped alien craft hover over Earth.',
  ],
  // Little Women
  331482: [
    'Four sisters grow up, apart and back together.',
    'A writer remembers growing up with her three sisters in Massachusetts during and after the Civil War.',
    'A burned manuscript, skating on thin ice, a neighbor boy proposing on a hillside and a publisher haggling over royalties.',
    'The March sisters of Concord grow into artists, wives and writers in a fresh take on a beloved novel.',
  ],
  // Blade Runner 2049
  335984: [
    'An officer who hunts his own kind finds evidence of something that should be impossible.',
    'A synthetic police officer uncovers a buried secret about a child born to an android and searches for a long-missing former agent.',
    'A holographic girlfriend, a carved wooden horse, an orange irradiated Las Vegas and a giant naked advertisement.',
    'Decades after the first film, a new LAPD replicant hunter tracks down the old one in the ruins of Las Vegas.',
  ],
  // Barbie
  346698: [
    'Every day is the best day ever, until one morning it is not.',
    'A doll living in a perfect pastel world starts having thoughts about death and travels to the real world to find out why.',
    'Flat feet, a dreamhouse with no walls, a man whose job is just beach and a rival on rollerblades.',
    'A fashion doll and her beach-obsessed boyfriend leave their plastic paradise, and he comes back with ideas about patriarchy.',
  ],
  // Top Gun: Maverick
  361743: [
    'An old hand is called back to train the young, and he is not ready to retire.',
    'A veteran navy test pilot returns to an elite school to train graduates for a near-impossible strike mission.',
    'A beach football game, a hypersonic jet pushed past mach ten, a canyon run and a stolen enemy fighter.',
    'Decades later, a cocky naval aviator returns to the elite flight school to train the son of his late wingman.',
  ],
  // Dunkirk
  374720: [
    'Thousands of people are stuck in one place with nowhere to go but the water.',
    'Soldiers trapped on a beach, civilian sailors crossing the sea and fighter pilots in the sky race to survive a desperate evacuation.',
    'A ticking watch in the score, small pleasure boats heading out, a Spitfire gliding with no fuel and a pier called the mole.',
    'One week on land, one day at sea and one hour in the air, as Allied troops are rescued from a French beach in the Second World War.',
  ],
  // Moonlight
  376867: [
    'A boy grows into a man in three chapters, trying to figure out who he is allowed to be.',
    'A quiet kid in Miami, raised by a struggling mother and taken in by a drug dealer, comes of age through three stages of his life.',
    'A swimming lesson in the ocean, a schoolyard beating, gold fronts and a diner reunion with a jukebox.',
    'Told in three parts named for a boy\'s nicknames, a gay Black kid from Miami grows into a hardened man who reunites with his childhood friend.',
  ],
  // Lady Bird
  391713: [
    'A teenager with a self-chosen name wants to be anywhere but home.',
    'A Catholic high school senior in Sacramento clashes with her loving, exhausting mother while dreaming of college on the East Coast.',
    'Jumping from a moving car, a school musical, a prom ditched for a party and a thrift store dress.',
    'A Sacramento teen insists everyone use a name she gave herself, while she fights with her mom about colleges in New York.',
  ],
  // Get Out
  419430: [
    'A young man visits his girlfriend\'s parents for the weekend, and they are very welcoming.',
    'A Black photographer meets his white girlfriend\'s family at their country estate and senses something deeply wrong.',
    'A teacup and silver spoon, a groundskeeper sprinting at night, a silent bingo auction and a deer on the road.',
    'Hypnotized into the sunken place, a man discovers that his girlfriend\'s family steals Black bodies for their own minds.',
  ],
  // Dune
  438631: [
    'A young heir moves to a dangerous new home, and someone has already planned his family\'s fall.',
    'A noble family takes over a desert planet that produces the most valuable substance in the universe, and is betrayed.',
    'Giant sandworms, stillsuits, a box of pain and ornithopters with dragonfly wings.',
    'The spice must flow on Arrakis, where a ducal son with prophetic dreams flees into the desert with a native girl.',
  ],
  // Once Upon a Time... in Hollywood
  466272: [
    'A fading performer and his loyal friend drift through a city that is changing around them.',
    'In late sixties Los Angeles, a declining TV cowboy and his stunt double cross paths with a cult and a famous neighbor.',
    'A flamethrower by a pool, a fight with a martial arts legend on a film set and a pit bull trained to attack on command.',
    'A has-been western actor and his stuntman live next door to a rising starlet on Cielo Drive in a revisionist fairy tale.',
  ],
  // Joker
  475557: [
    'A man who wants to make people laugh finds the world is not laughing with him.',
    'A struggling party clown with a condition that makes him laugh uncontrollably descends into violence in a decaying city.',
    'A subway shooting, a talk show appearance, a dance down a long flight of stairs and a hiding place inside a fridge.',
    'A failed comedian in Gotham becomes the clown prince of crime, dancing down the Bronx stairs.',
  ],
  // Parasite
  496243: [
    'A family with nothing finds a way into a family with everything.',
    'An unemployed family cons its way, one job at a time, into the household of a wealthy Seoul couple.',
    'A peach allergy, a scholar\'s rock, a flooded semi-basement and a secret bunker beneath a modern house.',
    'A poor Korean family poses as a tutor, an art therapist, a driver and a housekeeper for the rich, until a basement secret surfaces.',
  ],
  // Everything Everywhere All at Once
  545611: [
    'A tired woman doing her taxes learns she could have been many other people.',
    'A Chinese American laundromat owner being audited discovers she can borrow the skills of her other selves across the multiverse.',
    'Hot dog fingers, a raccoon chef, googly eyes, two talking rocks and a bagel holding the despair of the universe.',
    'Mid tax audit, a laundromat owner leaps between parallel universes to face her daughter\'s nihilistic alternate self.',
  ],
  // Knives Out
  546554: [
    'A wealthy patriarch dies the night of his birthday, and everyone in the house had a reason.',
    'A Southern detective investigates the death of a rich crime novelist whose greedy family is fighting over his will.',
    'A sunburst of blades, a nurse who vomits whenever she lies, a cable knit sweater and a mug that claims the house.',
    'A drawling gentleman sleuth solves the death of a mystery writer whose entitled heirs live off his money.',
  ],
  // Oppenheimer
  872585: [
    'A brilliant scientist builds something that he can never take back.',
    'A theoretical physicist leads a secret wartime program in the New Mexico desert, then faces a hearing that questions his loyalty.',
    'A test blast that blinds the desert, marbles dropping into bowls, a closed-door security hearing and a poisoned apple.',
    'The father of the atomic bomb watches his creation explode and recalls that he has become death, destroyer of worlds.',
  ],
};

export const LOGLINE_FILM_IDS: readonly number[] = Object.keys(LOGLINES)
  .map(Number)
  .sort((a, b) => a - b);

export function loglineFor(filmId: number): LoglineTiers | null {
  return Object.prototype.hasOwnProperty.call(LOGLINES, filmId) ? LOGLINES[filmId]! : null;
}
