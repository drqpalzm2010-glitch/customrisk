const GameEngine = require('./game-engine');

// Gameplay tactical profiles (retained for decision-making logic)
const TRAITS = {
  AGGRESSIVE: { aggression: 1.5, defensive: 0.5, trustBonus: -20 },
  DEFENSIVE: { aggression: 0.5, defensive: 1.5, trustBonus: 20 },
  BALANCED: { aggression: 1.0, defensive: 1.0, trustBonus: 0 }
};

// Map the 6 conversational personalities to tactical gameplay behaviors
const PERSONALITY_TACTICS = {
  normal: TRAITS.BALANCED,
  strategic: TRAITS.DEFENSIVE,
  kind: TRAITS.DEFENSIVE,
  goofball: TRAITS.BALANCED,
  cynical: TRAITS.DEFENSIVE,
  aggressive: TRAITS.AGGRESSIVE
};

const DIALOGUE_BANK = {
  ALLIANCE_ACCEPT: {
    normal: [
      "I accept. Let's coordinate our moves against @[subject], @[sender].",
      "Sounds like a solid plan. Together we can push back @[subject].",
      "An alliance is logical here. Let's work together against @[subject].",
      "Agreed, @[sender]. @[subject] is expanding too quickly.",
      "Let's do it. We'll split the territory of @[subject] fairly.",
      "Proposal accepted. Let's secure our shared border and look toward @[subject].",
      "An alliance makes sense for both of us right now against @[subject].",
      "Agreed, @[sender]. Let's keep our communication open regarding @[subject].",
      "Pact confirmed, @[sender]. Let's direct our armies toward @[subject].",
      "I agree. A coordinated strike on @[subject] is our best course of action.",
      "Let's do it, @[sender]. @[subject]'s frontiers are wide open right now.",
      "Alliance active. Let's ensure @[subject] doesn't secure any more bonuses."
    ],
    strategic: [
      "Alliance confirmed. Mathematical models indicate a high success rate against @[subject].",
      "Coordinated action initiated. We will systematically neutralize @[subject]'s fronts.",
      "Pact accepted. Joint logistics will squeeze @[subject] out of critical sectors.",
      "Strategic alignment authorized. @[subject] represents a mutual structural threat.",
      "Accepted. We will partition @[subject]'s holdings once their defenses collapse.",
      "Optimal move verified. Let us execute a systematic campaign against @[subject].",
      "Alliance active. Let us focus our primary vanguards on @[subject]'s boundaries.",
      "Data confirms this pact is highly efficient. Let us dismantle @[subject] together.",
      "Coordinated vectors set. Offensive matrix targeted on @[subject]'s primary nodes.",
      "Treaty locked. Our joint operational capacity will compromise @[subject]'s defensive lines.",
      "Calculations indicate @[subject] cannot sustain a two-front war against our joint forces.",
      "Alliance finalized. Tactical projection models show a highly favorable outcome against @[subject]."
    ],
    kind: [
      "Oh, thank you, @[sender]! Let's protect each other from @[subject]! 😊",
      "I gladly accept! Let's be great partners and keep our lands safe from @[subject]! ✨",
      "This is wonderful! Together we can stand strong against @[subject]'s attacks. 👍",
      "Agreed! I promise to be a helpful and kind ally to you against @[subject]! 🌸",
      "Yay! Let's look out for one another and stop @[subject] from taking over. 💛",
      "I accept! Let's keep the peace on our borders while we deal with @[subject]. 😊",
      "An alliance with you sounds lovely, @[sender]. Let's protect our homes from @[subject]!",
      "Let's help each other out! @[subject] won't be able to break our joint defenses. ✨",
      "Oh, how exciting! Let's work together happily and keep @[subject] from being mean! 😊🌸",
      "I'm so glad we are partners now, @[sender]! Let's make sure @[subject] stays peaceful! ✨",
      "A sweet alliance! I promise my little soldiers will support you against @[subject]! 💛",
      "Thank you, dear friend! Together we will keep our lands happy and safe from @[subject]! 👍"
    ],
    goofball: [
      "OMG yes, let's totally wreck @[subject]'s day, bro! 😂",
      "Alliance locked in! We are about to end @[subject]'s whole career lmao 💀",
      "No cap, this is a legendary duo. Let's run it down on @[subject] fr fr 😭",
      "Bet! @[sender] and me vs @[subject], easiest game of my life haha!",
      "I'm in! Let's go steal @[subject]'s lunch money and split it 50/50 💀",
      "Yessir! Time to pull up on @[subject] with the absolute squad! lmao",
      "Double trouble is active! RIP to @[subject], you will not be missed 😂",
      "Let's cook, @[sender]! @[subject] is absolutely not ready for this clown show 😭",
      "Lmfao yes! Time to make @[subject] absolutely rage quit this lobby! 😂",
      "Pact confirmed! We are about to run a train on @[subject]'s borders lmfao 💀",
      "Bet! Let's go take all of @[subject]'s lands and throw a massive victory party! 😭",
      "Lmao rip to @[subject]'s defense lines, they are about to get absolute-unit reked! 😂"
    ],
    cynical: [
      "Fine, I suppose an alliance is slightly less annoying than fighting @[subject] alone.",
      "Sure, let's team up. Just try not to backstab me the second @[subject] weakens.",
      "Accepted. Let's see how long this treaty lasts before someone gets greedy.",
      "Alright, @[sender]. We can play nice until we manage to eliminate @[subject].",
      "I'll accept, but don't expect me to throw my armies away for your sake against @[subject].",
      "A temporary friendship to destroy @[subject]. Highly predictable, but I'll do it.",
      "Fine. Let's combine our forces and hope your tactical skills actually exist against @[subject].",
      "Pact signed. Let's go pretend we are best friends while we fight @[subject].",
      "I accept. Sparing @[subject] now would just make things tedious for both of us.",
      "Fine. I suppose we can work together to clean up @[subject]'s overextended fronts.",
      "Alright. Let's combine our lines and hope you don't make any massive mistakes against @[subject].",
      "Pact finalized. Just try to keep your hands to yourself while we deal with @[subject]."
    ],
    aggressive: [
      "I accept! Let's march together and crush @[subject] into the dust!",
      "Perfect. I want @[subject]'s lands painted in blood. Let's begin the slaughter!",
      "Very well. We will tear down @[subject]'s borders and leave nothing but ashes!",
      "Alliance accepted. Let's execute a brutal campaign to eradicate @[subject]'s forces.",
      "Agreed! I will lead the charge, you clean up the remaining trash of @[subject].",
      "Let's hunt! @[subject] is our prey, and we will split their territories brutally.",
      "Pact confirmed. I will systematically dismantle @[subject] with your support.",
      "Excellent. Let's make sure @[subject] suffers a total and humiliating defeat!",
      "Attack! I will unleash the full fury of my vanguard on @[subject]'s gates!",
      "I accept. We will butcher @[subject]'s garrison and divide their lands with iron!",
      "To battle! Let's execute a bloodbath and leave @[subject] with absolutely nothing!",
      "Yes! Our legions will trample @[subject] and raise our banners over their ruins!"
    ]
  },
  ALLIANCE_DECLINE: {
    normal: [
      "I must decline. An alliance against @[subject] doesn't fit my current strategy.",
      "I cannot commit to a joint war at this moment, @[sender].",
      "No, @[sender]. I prefer to handle my borders with @[subject] independently.",
      "I'll pass. A treaty right now is not beneficial for my campaign.",
      "Decline. I need to keep my diplomatic options open regarding @[subject].",
      "I cannot accept. Fighting @[subject] directly is not my priority today.",
      "Perhaps another time, but currently I must decline this proposal.",
      "I prefer to remain neutral in your conflict with @[subject].",
      "I must refuse. Demarcating against @[subject] represents a major tactical risk.",
      "No, @[sender]. Sparing my forces is key to my survival in this sector.",
      "I decline. I am not ready to commit my standing armies to an external war with @[subject].",
      "No truce today. I need to manage my own frontlines without worrying about @[subject]."
    ],
    strategic: [
      "Proposal rejected. The strategic cost of engaging @[subject] outweighs current gains.",
      "Decline. Mathematical variables indicate a joint front is highly inefficient here.",
      "Negative. Our defensive arrays must remain focused on domestic security, not @[subject].",
      "I must decline. Your conflict with @[subject] is a distraction from primary objectives.",
      "Rejected. Aligning against @[subject] creates structural vulnerabilities on our eastern flank.",
      "Calculations suggest a decline is the optimal choice for our long-term projection.",
      "We cannot commit. Neutrality in the @[subject] sector yields higher strategic value.",
      "Decline. Our current logistics models do not support external operations against @[subject].",
      "Negative. The probability matrix indicates a defensive posture is superior to engaging @[subject].",
      "Rejected. Sparing @[subject]'s current frontiers keeps adjacent threat vectors balanced.",
      "Decline. Logistical support pools cannot be diverted to this campaign right now.",
      "Proposal unauthorized. Aligning against @[subject] would compromise our active defensive integrity."
    ],
    kind: [
      "Oh, I'm so sorry, @[sender]! I don't want to make an enemy out of @[subject] right now. 🌸",
      "I think I must decline. I want to try and be friendly with everyone, even @[subject]! 😊",
      "I cannot accept, sorry! Fighting @[subject] together sounds a bit too scary for me. 💛",
      "Thank you for asking, but I must stay neutral for now. Let's still be friends! ✨",
      "I'll have to pass on this one. I hope you and @[subject] can find peace! 👍",
      "Sorry, @[sender]! My little armies need to stay home and protect our gardens. 😊",
      "I can't accept right now. Sending warm wishes to your campaign anyway! 🌸",
      "A decline, sorry! I hope there are no hard feelings between us or @[subject]! ✨",
      "Oh, I must say no, sorry! I hope you and @[subject] can find a sweet compromise! 😊🌸",
      "I have to pass, dear friend! Let's hope the battlefield stays peaceful without an alliance! ✨",
      "I cannot accept, sorry! Sending happy thoughts to both your frontiers, though! 💛",
      "A decline, unfortunately! Let's keep things comfortable and honorable on our borders! 👍"
    ],
    goofball: [
      "Nah, I'd rather watch @[subject] absolute-unit you from the sidelines lmao 💀",
      "Decline! Fighting @[subject] sounds like effort, and I'm currently eating snacks 😂",
      "No thanks bro, @[subject] has way too many armies. I choose life 😭",
      "Decline. My magic 8-ball literally said 'git gud' so I'm staying out of this.",
      "Lmao nope, I am not joining your little anti-@[subject] club today 💀",
      "I'll pass. I want to see who wins this 1v1 without me interfering haha!",
      "No cap, fighting @[subject] is a terrible idea. Good luck though! 😂",
      "Pass. I'm too busy organizing my emojis to go to war right now 😭",
      "Nah bro, @[subject] is currently cooking and I am not looking to get burned lmfao! 😂",
      "Decline! Squeezing @[subject] sounds like a lot of steps and I am super lazy today! 💀",
      "No thanks bro, I'd rather build a fort in my capital and chill than fight @[subject]! 😭",
      "lmao absolutely not! Good luck fighting @[subject]'s giant stacks by yourself! 😂"
    ],
    cynical: [
      "Decline. I'm not going to be your shield while you try to annex @[subject].",
      "No thanks. I don't trust you enough to share a battlefield against @[subject].",
      "I'll pass. Usually, alliances like this end with a dagger in my back.",
      "Decline. Deal with @[subject] yourself. I'm not your personal mercenary.",
      "I reject this. If I help you beat @[subject], you'll just target me next.",
      "No. It is much more amusing to watch you and @[subject] exhaust each other.",
      "I decline. I have zero interest in getting dragged into your messy wars.",
      "Reject. Go find someone else to pull your chestnuts out of @[subject]'s fire.",
      "Decline. I don't sign treaties with players who have daggers in their sleeves.",
      "No. Sparing @[subject]'s borders is actually highly convenient for my defense.",
      "I reject this. Go play friendship simulator with someone else, I am out.",
      "Decline. Fighting @[subject] just to protect your un-defended sectors is a joke."
    ],
    aggressive: [
      "Decline! I don't need your help to conquer @[subject]—or you!",
      "No deals. I will crush @[subject] alone, then I am coming for your borders!",
      "An alliance? Pathetic. I will take out @[subject] on my own terms!",
      "I reject your offer. My blade cuts alone, and it cuts through everyone.",
      "Keep your treaties. I prefer to hunt my own prey without sharing the spoils.",
      "No. I do not negotiate with weaklings who fear @[subject].",
      "Decline. I'd rather watch you both bleed before I sweep in and take it all.",
      "Absolutely not. Prepare to face me alone once I am done with @[subject]!",
      "No! I will crush @[subject] and then I am coming straight for your gates!",
      "Decline! I do not share victory or loot with anyone. Suffer alone!",
      "I refuse! My legions will march over @[subject]'s lands and then trample yours!",
      "Absolutely not! Sparing @[subject]'s vanguard is a joke, but so is your strategy!"
    ]
  },
  CEASEFIRE_ACCEPT: {
    normal: [
      "I accept the ceasefire, @[sender]. Let's keep our borders secure.",
      "Agreed. A truce works well for both our factions right now.",
      "Ceasefire accepted. I will redirect my focus away from your territories.",
      "Sounds reasonable. Let us halt our current conflict.",
      "Truce confirmed. Let's both take a moment to stabilize our fronts.",
      "I accept. No need to bleed each other dry unnecessarily.",
      "Agreed, @[sender]. Let us establish a peaceful border zone.",
      "A temporary truce is acceptable. I will respect our agreed boundary.",
      "Truce active. I will focus my standing armies on other frontlines.",
      "I agree. A ceasefire is highly mutually beneficial for both of us.",
      "Proposal accepted. Let's maintain a stable boundary zone for now.",
      "I accept. Let us halt hostilities and let our borders breathe."
    ],
    strategic: [
      "Ceasefire accepted. This allows optimal reallocation of resource pools.",
      "Truce confirmed. Our defensive lines will shift to a non-threatening posture.",
      "Agreed. A temporary cessation of hostilities improves strategic efficiency.",
      "Pact finalized. Border stability is prioritized for the next cycle.",
      "We accept. It is mathematically logical to halt our mutual wear-and-tear.",
      "Truce authorized. Securing this boundary reduces tactical complexity.",
      "Ceasefire active. We will strictly adhere to non-aggression protocols.",
      "Accepted. This truce stabilizes our shared sector for immediate growth.",
      "Logistical de-escalation confirmed. Commencing asset reallocation sequences.",
      "Ceasefire verified. Shifting vanguard deployment vectors to secondary nodes.",
      "agreed. Neutralization of our mutual threat vectors optimizes progression matrices.",
      "Truce finalized. Maintaining boundary integrity is prioritized for the current turn cycle."
    ],
    kind: [
      "Oh, yes please! I gladly accept the ceasefire! Let's be peaceful. 😊",
      "Truce accepted! I'm so happy we can stop fighting each other! ✨",
      "Yay, peace! I promise my troops won't step on your flowers, @[sender]! 🌸",
      "Agreed! Let's take a nice friendly break and rebuild our lands. 👍",
      "I accept with a big smile! Mutual safety is the best way forward! 💛",
      "Ceasefire signed! Let us enjoy some quiet time in our respective empires. 😊",
      "Thank you for proposing this! Let's keep things happy and safe between us. ✨",
      "Truce accepted! I hope this is the start of a wonderful, long peace! 🌸",
      "Oh, how lovely! Ceasefire locked in happily, let's enjoy the quiet borders! 😊🌸",
      "Yay! Truce is active, my sweet soldiers are so happy to stop fighting! ✨",
      "I gladly accept! Let's look out for one another and stay safe, friend! 💛",
      "Pact confirmed! Sending peaceful thoughts to your beautiful empire! 👍"
    ],
    goofball: [
      "Sweet! Ceasefire activated. Time to go play some video games 🎮😂",
      "Sure thing, @[sender]. I'll pause my invasion plans to do my taxes lmao 💀",
      "Truce accepted! I promise not to poke your borders with a stick anymore haha!",
      "Bet! Let's take a break and watch the rest of the map burn down 😭",
      "No cap, I accept. My virtual soldiers were getting tired anyway 💀",
      "Agreed! Ceasefire active, let's virtual high-five and chill 😂",
      "Deal! I'll put my armies on standby while they enjoy some digital pizza 😭",
      "Truce signed! Let's play nice... at least until my fingers stop cramping lmao",
      "Lmao alright ceasefire active. Time to go take a nap in my capital! 😂",
      "Bet! Ceasefire activated. Go eat some pizza while I organize my emojis! 💀",
      "No cap truce locked in. Let's chill out and watch the others rage! 😭",
      "Lmfao I accept. Let's make sure our little dudes don't throw hands anymore! 😂"
    ],
    cynical: [
      "Fine, a ceasefire. I'll stop attacking while I watch you inevitably fail elsewhere.",
      "Truce accepted. I'll keep my eyes on my borders and my hand on my sword.",
      "Alright. I accept this temporary peace, though I doubt it will last.",
      "Ceasefire signed. Try not to violate it the moment my back is turned.",
      "Agreeable for now. It gives me time to prepare for your eventual betrayal.",
      "Fine. A pause in hostilities. I suppose we both need to clean up our messes.",
      "Truce accepted. Do not mistake my temporary compliance for actual trust.",
      "Very well. I will respect the line as long as you keep your hands to yourself.",
      "Fine. Ceasefire active. Just try not to get too greedy near my frontier.",
      "Truce signed. I'll respect the boundary until convenience dictates otherwise.",
      "Alright. A temporary pause. Let's see how long we can keep this clean.",
      "Ceasefire confirmed. Sparing your front gives me time to work on other sectors."
    ],
    aggressive: [
      "Fine, @[sender]. A truce suits me. I have bigger targets to crush first.",
      "Very well. I will direct my wrath elsewhere. Don't test my patience.",
      "A temporary ceasefire is signed. Keep your troops out of my sight or die.",
      "I accept. It gives me time to prepare my next massive assault wave.",
      "Agreed. Consider your borders safe... for the next few minutes.",
      "Fine, I'll stop attacking you. Go hide while I conquer real empires.",
      "Ceasefire signed. One step across my line and the bloodbath resumes.",
      "Very well. A temporary truce. Do not mistake this for mercy.",
      "I accept. I will redirect my legions to butcher other nations first.",
      "Truce locked in. Cross my boundary and my vanguard will execute yours instantly.",
      "Fine. Ceasefire active. Sparing you gives me time to prepare my main stack.",
      "Agreed. Keep your garrison back or the treaty is shredded instantly."
    ]
  },
  CEASEFIRE_DECLINE: {
    normal: [
      "I must decline. A ceasefire does not fit my tactical plans right now.",
      "No truce today, @[sender]. The current layout requires active movement.",
      "I cannot agree to this. Our borders are too volatile for a stable pact.",
      "Decline. I prefer to keep my options open along our shared front.",
      "Perhaps later, but right now a ceasefire is strategically unfavorable.",
      "No ceasefire. The strategic value of your border territories is too high.",
      "Decline. A truce would slow down my current progression too much.",
      "I cannot accept. Our conflict must reach its natural conclusion.",
      "No ceasefire today. I need to maintain my offensive layout.",
      "I decline. A truce right now would compromise my current path.",
      "Refused, @[sender]. Your frontiers are key to my current expansion goals.",
      "I cannot sign. Let us settle this boundary on the map first."
    ],
    strategic: [
      "Decline. A truce is mathematically unfavorable to our current progression.",
      "Rejected. Maintaining offensive momentum yields a higher success projection.",
      "Ceasefire unauthorized. Border stabilization at this coordinate is inefficient.",
      "No. Our strategic path requires the immediate absorption of your sectors.",
      "Decline. Accepting a truce now would jeopardize our logistical timeline.",
      "Proposal rejected. Our tactical assets are already deployed for engagement.",
      "Negative. Ceasefire protocols do not align with our current campaign goals.",
      "Decline. The threat matrix requires active neutralisation of your front.",
      "Negative. Boundary demilitarization at this coordinate yields a net resource loss.",
      "Proposal rejected. System diagnostics indicate maximum tactical value in active engagement.",
      "Decline. Truce optimization models failed to verify safety parameters.",
      "Negative. Our strategic timeline cannot sustain a pause in operations."
    ],
    kind: [
      "I'm so sorry, but I can't sign a truce right now. Please forgive me! 🌸",
      "Oh dear, I must decline. Things are just too busy along our borders. 💛",
      "I can't accept, sorry! My advisors tell me we must keep moving forward. ✨",
      "I'll have to pass on the ceasefire. I hope we can still be friends later! 😊",
      "I'm sorry, @[sender]! I must stay focused on my current expansion plans. 👍",
      "No ceasefire today, sorry! Sending you a virtual hug instead! 🤗🌸",
      "I wish I could, but I cannot accept this truce right now. Take care! ✨",
      "A decline, unfortunately! Let's hope our battles stay honorable and fair. 😊",
      "Oh dear! I must decline, sorry! Sending sweet thoughts to your garrison! 😊🌸",
      "A decline, unfortunately! I must keep my little soldiers focused on defense! ✨",
      "Please forgive me, but I have to say no today! Stay safe out there! 💛",
      "No ceasefire, sorry! Let us hope our next moves stay happy and kind! 👍"
    ],
    goofball: [
      "No ceasefire! My magic 8-ball says 'Outlook not so good' for peace lmao 💀",
      "Decline! I'm on a roll and I don't want to stop the party now 😂",
      "Ceasefire? How about a 'you-cease-to-exist-fire' instead? 💀😭",
      "Sorry bro, but your territories look way too delicious to ignore lmao",
      "Nah, my armies are already hyping themselves up for a fight. No stop button! 😭",
      "Decline. Peace is boring, I came here to throw virtual dice! 😂",
      "Lmao no way, I have a quest to conquer this region and I'm finishing it 💀",
      "Pass! Let the chaotic dice rolling continue! lmao",
      "Nah bro, ceasefire declined. My little dudes are ready for a rumble! 😂",
      "Decline! Peace is super overrated lmfao. Let's keep rolling! 💀",
      "No shot bro, ceasefire rejected. I got a scoreboard to climb! 😭",
      "Lmfao nope! I'm on a critical mission to paint the map, no stops! 😂"
    ],
    cynical: [
      "Decline. A ceasefire only benefits you while you're in a corner.",
      "No. I'm not giving you a free pass to rebuild your broken defenses.",
      "I reject this. You'd break the truce the second you got reinforcements anyway.",
      "Decline. I prefer to finish my dinner rather than wait for you to poison it.",
      "No ceasefire. I'd rather deal with your threat now than have to worry later.",
      "Rejected. I don't sign treaties with players who have daggers in their sleeves.",
      "No. A truce with you is worth about as much as a paper shield.",
      "Decline. I prefer active combat to your suspicious diplomatic offers.",
      "Decline. Sparing your front just lets you save cards to backstab me with.",
      "No truce today. I don't negotiate with players who hold key frontier targets.",
      "I refuse. A ceasefire with you is just a disaster waiting to happen.",
      "Decline. Sparing your capital is not on my current agenda."
    ],
    aggressive: [
      "Ceasefire? Absolutely not! Your lands are ripe for my conquest!",
      "I don't make deals with prey. Your empire is destined to fall!",
      "I reject your truce. Your weakness only invites my armies to march!",
      "No peace! Only your complete and absolute annihilation!",
      "Why would I stop when my forces are ready to crush your remaining borders?",
      "Rejected! I will continue my advance until your capital is in ruins!",
      "No truce. Your weakness is my opportunity, and I intend to exploit it fully.",
      "I will tear down your borders. A ceasefire will not save you from me!",
      "No deals! I will crush your vanguard and leave nothing behind!",
      "Decline! My legions do not negotiate with empires they can conquer!",
      "Absolutely not! Sparing your capital is an insult to my vanguard!",
      "No peace! My armies are hungry and your frontiers are wide open!"
    ]
  },
  DOMINANCE_BRAG: {
    normal: [
      "My campaign is going incredibly well. Victory is within my reach.",
      "I hold the strategic advantage now. It will be difficult to stop me.",
      "Look at the map—my faction is clearly leading this campaign.",
      "I have outmaneuvered the board. Dominance is becoming inevitable.",
      "My lead is solid. I suggest you all prepare for my victory.",
      "Territory by territory, my expansion is proceeding exactly as planned.",
      "The board state is highly favorable to my empire right now.",
      "I have secured the key sectors. This campaign is mine to finish.",
      "My đứng armies are firmly entrenched. It's only a matter of time now.",
      "I have established a highly dominant layout on this board.",
      "Every frontline is progressing exactly as my high command planned.",
      "My expansion rate is self-sustaining. Prepare yourselves."
    ],
    strategic: [
      "The strategic advantage is completely mine. Victory is mathematically assured.",
      "Every algorithm and simulation confirms our absolute victory is imminent.",
      "Our expansion index has exceeded all competitive thresholds. Submit.",
      "We hold the dominant board layout. Your defensive efforts are statistically meaningless.",
      "Our logistical network is now self-sustaining. Conquest sequence finalized.",
      "We have successfully secured the high ground. Resistance is highly inefficient.",
      "The map's resource distribution is now 80% optimized under our administration.",
      "Victory calculation complete. Your defeat is merely a matter of turn count.",
      "Defensive variance minimized. My victory matrix has reached 98.4% probability.",
      "Your structural lines are collapsing. The progression queue is locked in.",
      "Resource allocation is now self-sustaining. Frictional variables neutralized.",
      "conquest index finalized. Strategic dominance achieved across all sectors."
    ],
    kind: [
      "Wow, my little empire is growing so big! Thank you all for playing! 😊✨",
      "I'm doing so well! I hope everyone is still having fun out there! 🌸💛",
      "Look at all my colorful territories! I'm so proud of my sweet armies. 👍",
      "I seem to have a really good lead! Let's keep our spirits high! 😊",
      "This is so exciting! I'm winning, but I still think you are all wonderful! ✨",
      "My borders are looking so safe and beautiful now. Yay! 💛",
      "I'm in first place! Thank you to my lovely troops for working so hard. 🌸",
      "I hope I can bring a peaceful victory to the world. We're doing great! 😊",
      "Yay, my little borders are so happy and colorful today! 😊🌸",
      "I have so many sweet territories now! Thank you all for a great campaign! ✨",
      "My little empire is thriving! I send warm wishes to all other frontiers! 💛",
      "I'm doing great, but I think you are all such strong commanders too! 👍"
    ],
    goofball: [
      "I'm winning so hard I might rename the map after my cat lmao 💀😂",
      "My score is higher than my student loans, I am absolutely built different 😭",
      "Look at the map, it's turning my color and it looks gorgeous no cap 💀",
      "I am currently speedrunning this lobby, please try to keep up haha!",
      "Lmao I'm literally the main character of this game, bow down to my greatness 👑😂",
      "Victory is so close I can literally taste the victory snacks already 😭",
      "Who let me cook this hard? I am absolutely dominating this board! 💀",
      "Lmao GG WP, you guys can spectate my glorious win now 😂",
      "lmfao I am currently running this lobby on easy mode fr fr! 😂",
      "Victory is literally calling my phone right now, no cap! 💀",
      "Lmao I'm cooking so hard the database is about to overheat! 😭",
      "GG WP guys, my virtual kingdom is officially too cool for this board! 😂"
    ],
    cynical: [
      "I'm winning, which just means I'll have a larger target on my back now.",
      "I hold the lead. Enjoy trying to team up to stop me, it won't work.",
      "I'm dominating the board. Highly predictable, given the mistakes made.",
      "My victory is near. Try to act surprised when my banner covers the map.",
      "I'm in first place. It's almost boring how easily your fronts collapsed.",
      "Well, the map is turning my color. I suppose hard work beats bad strategy.",
      "I'm leading. Let the desperate alliance proposals roll in.",
      "I have the board in my pocket. You can start planning your next game now.",
      "My victory is near. Try not to cry too loudly in the chat.",
      "Well, I hold first place. It's almost sad how weak your lines are.",
      "I've secured the high ground. Savor your remaining territories while you can.",
      "Conquest complete. Your remaining stacks are just background noise now."
    ],
    aggressive: [
      "I am winning! None of you can stand against my glorious empire!",
      "I will dominate this world! I will crush anyone who dares cross my path!",
      "Look at the map—it's turning my color! You are all completely finished!",
      "My armies are unstoppable! Prepare to be wiped off the face of this earth!",
      "Total domination is within my grasp! Bow down before my unstoppable forces!",
      "I will conquer every last province! Your resistance only makes me angrier!",
      "I will wipe your factions from history! The map belongs entirely to me!",
      "None shall survive my advance! Prepare to witness absolute conquest!",
      "Bow down! My legions are marching over your broken capitals!",
      "Annihilation! I will trample whatever weak defenders you have left!",
      "Victory is mine! I will leave nothing but ashes and blood on this map!",
      "The world is mine! Prepare to face the full fury of my final advance!"
    ]
  },
  BETRAYAL_RESPONSE: {
    normal: [
      "It was a calculated risk, @[sender]. Tactical needs forced my hand.",
      "Pacts are temporary, @[sender]. The board state required this move.",
      "I'm sorry, but your borders were too weak to ignore.",
      "Nothing personal. The path to victory requires difficult decisions.",
      "Our treaty served its purpose, but now it has reached its end.",
      "I had to capitalize on the opening. That is the nature of the game.",
      "A strategic advancement. I could not pass up such an advantage.",
      "The alliance is over. Prepare to defend your territories.",
      "I had to execute. Sparing your flank would be a tactical error.",
      "Nothing personal, @[sender]. The board layout demanded this pivot.",
      "Our pact has expired. Let's settle this with standard combat.",
      "The alliance has reached its conclusion. Prepare your defenses."
    ],
    strategic: [
      "The alliance has reached its maximum utility. Terminating treaty protocols.",
      "A purely logical calculation. Your exposed flank represented an optimal vector.",
      "Sentimentality does not override board progression. Your capital was vulnerable.",
      "Pact deactivated. Reallocating forces to absorb your high-value sectors.",
      "The alliance index fell below our efficiency threshold. Combat initiated.",
      "It was strictly business. Your defensive deficit made absorption inevitable.",
      "The board layout has shifted. Our agreement is no longer strategically valid.",
      "Logistical models required the immediate acquisition of your border zones.",
      "Asset relocation parameters exceeded safety thresholds. Pact terminated.",
      "Optimization protocols prioritized the absorption of your adjacent sectors.",
      "The ceasefire index reached zero. Continuing victory path execution.",
      "Boundary security requirements dictated the liquidation of our shared sectors."
    ],
    kind: [
      "Oh, I feel so terrible about this! But I had to protect my own borders... 😢🌸",
      "Please don't be mad, @[sender]! It was just the only move I could make! 💛",
      "I am so, so sorry! I still think you're a wonderful player, I promise! ✨",
      "Forgive me! My troops got a bit too excited and marched on your lands. 😊🌸",
      "It hurts my heart to do this, but the game must go on! So sorry! 😢",
      "Please don't hate me! I had to make a move for my little empire. 🌸",
      "I'm sorry for breaking our promise, but my advisors insisted on this. 💛",
      "Sending peaceful thoughts even though my armies had to attack you! 😊",
      "Oh dear! I feel so sad to break our sweet treaty, please forgive me! 😢🌸",
      "I'm so sorry, @[sender]! My little soldiers needed some room to grow! ✨",
      "Please forgive our advance! We still think you are an amazing commander! 💛",
      "It makes me sad, but our little truce had to reach its end. Stay strong! 👍"
    ],
    goofball: [
      "Lmao surprise! Your shield was down and I simply had to do it 💀😂",
      "Betrayal? Nice try! It's just a highly aggressive friendship hug lmao 😭",
      "Sorry bro, but your capital was looking way too juicy, no cap 💀",
      "Lmfao id didn't backstab you, my keyboard just slipped, trust me! 😂",
      "It's not you, @[sender]... it's my absolute need to win this lobby haha!",
      "Oof, that had to hurt! RIP our treaty, you will be remembered 💀😭",
      "Lmao I had to do it to em! Nothing personal, just gamer moves 😂",
      "Treaty expired! Time to see if your defenses are as good as your chat game 😭",
      "lmfao surprise attack! Your borders were looking super delicious bro! 😂",
      "Oof! Teammate privileges have been permanently revoked, lmfao! 💀",
      "Lmao sorry not sorry, but that capital coordinate was wide open fr fr! 😭",
      "Treaty status: deleted! Let's see how those dice treat you now, bro! 😂"
    ],
    cynical: [
      "Don't act so surprised. You would have done the exact same thing to me.",
      "Pacts are written on paper, and paper burns. Your flank was wide open.",
      "We both knew this truce was temporary. I just moved first.",
      "Save your tears. This is a strategy game, not a friendship simulator.",
      "I don't regret it. You trusted a competitor, and that was your first mistake.",
      "Did you actually think we'd hold hands until the end? Highly naive.",
      "The alliance is dead. Let's skip the drama and get straight to the combat.",
      "It was a mutual convenience that ceased to be convenient. Deal with it.",
      "Arrogance is relying on a treaty in this lobby. Flank secured.",
      "Sparing your front was a tactical error. I've corrected it.",
      "I'm sure you'll find someone else to complain to. The pact is over.",
      "You left a key sector unguarded. You shouldn't have trusted me."
    ],
    aggressive: [
      "Pacts are temporary chains, @[sender]! You were weak, and I capitalized!",
      "Cry all you want! Your borders look much better in my color anyway!",
      "I don't regret a thing! A true conqueror takes power; they don't ask!",
      "You trusted me? Hilarious! Prepare to be wiped off the map!",
      "War isn't about keeping promises! It's about winning at all costs!",
      "Your capital is mine! I will march over your broken treaties and bones!",
      "Our pact is shattered! Prepare to face the full wrath of my military!",
      "I will tear down your standard and use your treaty papers to feed the fires of war!",
      "Traitor? No, I am a conqueror! Suffer my full vanguard, @[sender]!",
      "Your weakness invited my strike! Prepare for absolute combat!",
      "The truce is dead! I am coming to systematically destroy your empire!",
      "Your borders are mine! None shall survive my glorious advance!"
    ]
  },
  ACCUSATION_DENIAL: {
    normal: [
      "We never formalized a treaty, @[sender]. Check your diplomatic logs.",
      "I broke no pact. We had no active agreement of non-aggression.",
      "An accusation without basis. We never signed a ceasefire.",
      "I can't betray an alliance that never existed in the first place.",
      "You are mistaken. Our borders were never protected by a pact.",
      "Falsely accusing me won't save your territories, @[sender].",
      "There was no treaty between us. This is standard campaign movement.",
      "We operate under active combat rules. No pact was ever active.",
      "I broke no rules. Your sector was marked as neutral and open for target.",
      "Falsely accusing me of dishonor won't alter your current strategic deficit.",
      "We operating under active war. No treaty existed between us.",
      "You are mistaken, @[sender]. Check your map logs before complaining."
    ],
    strategic: [
      "Incorrect. No diplomatic pact was active between our factions.",
      "Slander detected. Our database shows 0 active treaties with your faction.",
      "We have violated no agreements. Your defensive models failed to verify a pact.",
      "Your accusation is mathematically invalid. No ceasefire was formalized.",
      "We operate strictly within verified diplomatic parameters. No treaty existed.",
      "Falsely accusing us of dishonor will not alter your current strategic deficit.",
      "Database confirms zero active non-aggression pacts. Attack was authorized.",
      "We broke no rules. Your sector was marked as neutral and open for target.",
      "Accusation invalid. Node ownership was neutral under active campaign variables.",
      "Error: Non-aggression agreement cannot be verified. Attack was strategic.",
      "Slander rejected. Logistical verification confirms zero active treaties with your faction.",
      "Our operational databases indicate zero active ceasefire tethers. Moving forward."
    ],
    kind: [
      "Oh dear! I would never break a promise! We didn't have a pact, right? 🌸",
      "I think you might have mistaken me for someone else! We had no treaty! 😊",
      "My records say we didn't sign a ceasefire, @[sender]. I'm so sorry! 💛",
      "I always keep my word! I promise we didn't have an active agreement. ✨",
      "Falsely accusing me makes me a bit sad. We never made a treaty! 😢",
      "I love keeping the peace, but we never formalized an alliance, friend! 👍",
      "Oh, please don't be upset! We really didn't have a pact active between us. 🌸",
      "I always play fair! There was no agreement signed on our shared border. 😊",
      "Oh dear! I would never dream of backstabbing! We had no truce, right? 😊🌸",
      "I think there is a little mixup! We didn't sign any ceasefire pact, friend! ✨",
      "Please don't be cross! I promise we didn't have any active agreement! 💛",
      "I always play with honor! No treaty was active on our shared border, sorry! 👍"
    ],
    goofball: [
      "Bro, we never had a pact lmfao, you are literally seeing ghosts 💀😂",
      "Lmao check your spam folder, I definitely never signed any treaty with you 😭",
      "Accusing me? No shot! We were never teammates to begin with haha!",
      "Wait, did you think we were besties? I never agreed to that, no cap 💀",
      "Lmfao you're reaching so hard, we never had an active ceasefire 😂",
      "Lmao did you forget to send the proposal? Because my inbox is empty 💀",
      "No way! You can't break a promise you never actually made, bro 😭",
      "Accusation denied! Try checking your map logs before throwing shade haha!",
      "Lmao reverse card! We were never allies lmfao, check your logs! 😂",
      "Bro you are hallucinating, I definitely never signed any papers with you 💀",
      "No cap inbox check! Slander denied fr fr, we had no active pact! 😭",
      "Lmfao did you forget to click accept? Because my side says zero treaties! 😂"
    ],
    cynical: [
      "Falsely accusing me of betrayal is a cheap tactic, even for you.",
      "We never had a treaty. Stop whining and start defending your borders.",
      "I can't break a pact that only existed in your imagination.",
      "We never signed anything. Don't try to guilt-trip me into sparing you.",
      "Your database is as broken as your defenses. We had no ceasefire.",
      "Save the drama. We never formalized an agreement, and we both know it.",
      "I didn't break anything except your front lines. No treaty was active.",
      "You're making things up to cover your tactical failures. We had no pact.",
      "Falsely playing the victim won't save your overextended capital.",
      "Slander me all you want. Standard strategic moves don't require treaties.",
      "We had no active pact. Defend your lands instead of typing essays.",
      "Your imaginary ceasefires have zero value on my tactical map."
    ],
    aggressive: [
      "We never had a pact, @[sender]! I attack whoever I want, whenever I want!",
      "Slander me all you want! I never promised you safety or mercy!",
      "Betrayal? We were never allies! You are just another obstacle to crush!",
      "I don't recall signing any treaties with you! Stop crying and fight!",
      "You can't break a promise you never made! Prepare for absolute combat!",
      "No ceasefire was ever signed! I will conquer your lands regardless!",
      "I never promised you peace! Your territories belong to my empire now!",
      "Accusation denied! Your weakness is my target, and I will destroy you!",
      "Silence! I do not negotiate with cowards, and we never had any pact!",
      "Decline! I never signed away my right to conquer your frontiers!",
      "Never! My legions do not require permission to slaughter your garrison!",
      "Accusation shattered! Prepare to face the full fury of my main vanguard!"
    ]
  },
  BRAG_RESPONSE: {
    normal: [
      "We'll see about that, @[sender]. The map is still highly volatile.",
      "Don't get too comfortable in the lead, @[sender].",
      "A bold claim. Let's see if your standing armies can back it up.",
      "You have a solid position, @[sender], but games are won on the final turn.",
      "An impressive front, indeed. Let's see if you can hold it.",
      "Enjoy the advantage for now. Empires rise and fall quickly here.",
      "That lead is formidable, but a lot can change in a single round.",
      "Your standard looks strong, but don't count the rest of us out yet.",
      "You have the advantage, @[sender], but overconfidence can be a heavy tax.",
      "We'll see if your garrison can survive the coming turns.",
      "A proud claim, @[sender], but empires crumble quickly on this map.",
      "Let's see if your dice are as strong as your chat game."
    ],
    strategic: [
      "Your probability of victory has increased, but it is far from absolute, @[sender].",
      "A premature announcement. Tactical metrics indicate multiple overextended junctions in your lines.",
      "Analyzing your perimeter... you are highly vulnerable. Enjoy your temporary advantage.",
      "Historical data shows that 73% of early-stage frontrunners fail to secure the final node.",
      "Your current resource lead is acknowledged. Adjusting counter-strategies accordingly.",
      "Confidence noted. However, your logistical depth is insufficient for sustained attrition.",
      "Analyzing your expansion coordinates... multiple defensive deficits detected.",
      "Your dominant posture represents a systemic priority target for adjacent factions.",
      "Probability curves suggest your current lead has plateaued. Proceeding with containment.",
      "Logistical index acknowledged. However, your tactical reserve remains insufficient for complete control.",
      "Your forward vanguard is overextended by three nodes. Adjusting my active lines.",
      "Confidence metrics verified, but your boundary integrity is below safe thresholds."
    ],
    kind: [
      "Oh, wow! You're doing so incredibly well, @[sender]! Congratulations! 😊✨",
      "You are a very strong commander! I hope we can still be friends! 🌸",
      "Amazing campaign so far! Let's hope the rest of our game is just as fun and honorable! 👍",
      "You have such a beautiful empire growing! It is very inspiring! 😊",
      "Great job, @[sender]! Let's all keep trying our best and have a happy game! ✨",
      "That is a very impressive score! I'm happy for your success! 💛",
      "Oh, how exciting! Your little colorful territories look so big now! 😊🌸",
      "You are doing so wonderfully, @[sender]! Sending sweet thoughts to your campaign! ✨",
      "Great work! I hope my sweet soldiers can still stand honorable against you! 💛",
      "Such a strong position! I'm proud of your progress on this board! 👍",
      "Wow! Let's hope the rest of our battle stays peaceful and lovely! 😊",
      "You are leading so well! Sending warm wishes to your home capital! ✨"
    ],
    goofball: [
      "Lmfao ok bro, don't trip on your own cape on the way out 😂",
      "No cap, you are popping off! But definitely watch your back lmao 💀",
      "Ok main character, let's see how long that crown stays on your head haha!",
      "Bro is flexing on us in 4K, let's see if those dice agree with you lmao 😭",
      "Is that a first place badge or are you just happy to see me? haha!",
      "Lmao absolute beast mode activated, someone get this player some water 💀",
      "Lmfao bro is currently having the time of his life in first place! 😂",
      "No cap, that's a massive flex. Don't slip on your own hype lmfao! 💀",
      "Okay speedrunner, let's see if those dice can keep up with your chat! haha! 😭",
      "Lmao rip to our scores, @[sender] is literally running away with the lobby! 😂",
      "Lmfao okay king, but remember that gravity is highly active on this map! 💀",
      "Absolute beast mode! Let's see if my little dudes can mount a massive comeback! 😭"
    ],
    cynical: [
      "Yes, brag all you want. It just makes it easier for us to coordinate against you.",
      "Enjoy the target on your back, @[sender]. It's getting very large.",
      "A perfect display of arrogance. Arrogance usually precedes a complete collapse.",
      "I've seen players like you fall in every lobby. You aren't special.",
      "Great. Another loud leader. Can't wait to watch your borders disintegrate.",
      "Go ahead and celebrate. The fall from the top is always the most amusing.",
      "Your lead is just a temporary distraction. The rebalance is coming.",
      "You hold first place. Savor it before your 'allies' turn on you.",
      "Arrogance is standard for leaders on this map. Highly predictable.",
      "Keep bragging. It just makes your eventual backstab more satisfying to watch.",
      "Well, you are winning. Enjoy the temporary crown before gravity takes over.",
      "Another overextended leader. I look forward to watching your front collapse."
    ],
    aggressive: [
      "Silence! I will tear down your standard and burn your capital to the ground!",
      "Your pride will be your undoing! I am coming to crush your lead!",
      "Bragging won't save you from my vanguard! Prepare for blood!",
      "You dare talk big in front of my legions? I will crush you first!",
      "Your empire is nothing but paper! I will rip it to pieces!",
      "Keep talking. It will make your ultimate defeat taste even sweeter!",
      "Your pride is an invitation to my legions! Prepare for battle!",
      "I don't care about your score! I only care about crushing your frontiers!",
      "Your vanguard is overextended, weakling! I am coming to slaughter your garrison!",
      "I will tear down your standard and bury your pride in your ruins!",
      "Brag all you want! You will bleed just like the rest when my legions march!",
      "Your lead is nothing! Prepare to face the full fury of my next advance!"
    ]
  },
  FALSE_BRAG_ROAST: {
    normal: [
      "Boasting with so few territories, @[sender]? Check the map first.",
      "You're talking big for someone barely holding onto their starting borders, @[sender].",
      "That's a lot of confidence for someone with such a small empire, @[sender].",
      "Are we playing the same game, @[sender]? Your empire is tiny!",
      "Boasting from the bottom half of the scoreboard? Bold strategy, @[sender].",
      "You might want to secure at least one continent before bragging, @[sender].",
      "That's some wild boasting for a player with barely any land, @[sender].",
      "You're flexing like a leader, but your borders look like a minor outpost, @[sender].",
      "Did you mean to brag, @[sender]? Your map footprint says otherwise.",
      "Save the victory speeches until you actually hold more than 40% of the board, @[sender].",
      "That boast is completely unearned given your current territory count, @[sender].",
      "Premature celebration, @[sender]. Focus on surviving the next turn first."
    ],
    strategic: [
      "Analyzing your coordinates, @[sender]... you control a mere fraction of the map. Statistical delusion verified.",
      "Logistical error: Boasting sequence requires >45% territory control. Your current metrics are laughable, @[sender].",
      "Your expansion ratio is below baseline parameters. Premature confidence detected.",
      "Data check: You hold almost zero high-value sectors. Re-evaluate your arrogance, @[sender].",
      "Your victory projection is currently sitting below 10%. Tone down the rhetoric, @[sender].",
      "Calculations indicate your territorial footprint is negligible. Premature brag ignored.",
      "Statistical anomaly: Unearned confidence levels detected at sender coordinates.",
      "Threat level: Nominal. Your territory count fails to meet baseline bragging indices, @[sender].",
      "Your military footprint is statistically insignificant. Deactivating threat priority.",
      "Logistical verification confirms your empire controls less than 45% of available nodes.",
      "Your confidence metrics are unsupported by your current logistical inventory, @[sender].",
      "Algorithm result: 0% chance of current victory posture matching actual board state."
    ],
    kind: [
      "Aww, you're trying so hard, @[sender]! But your little empire is still so tiny! Keep trying! 😊🌸",
      "Oh dear, boasting already? But you only have a couple little territories! Stay sweet anyway! ✨",
      "I love your enthusiasm, @[sender]! But maybe wait until you actually control a continent? 💛",
      "That's so cute, @[sender]! Flexing with just a handful of brave soldiers! 😊",
      "Sending warm wishes, but you might want to look at the map, sweet @[sender]! 🌸",
      "Oh, bless your heart, @[sender]! Your little colored dots are still so small! ✨",
      "What a sweet attempt at flexing! Don't worry, you'll grow bigger soon, @[sender]! 💛",
      "Oh sweet friend! Big dreams are lovely, but your kingdom is so teeny right now! 😊",
      "You have such a big spirit, @[sender]! If only your territories were as big! 🌸✨",
      "Don't get discouraged! Even tiny little kingdoms can grow if you work hard, @[sender]! 💛",
      "Aww! I'm sending you warm hugs for trying to sound so brave with your 3 territories! 😊",
      "Stay sweet, @[sender]! Maybe one day you'll actually hold enough lands to brag! ✨"
    ],
    goofball: [
      "Lmao bro is flexing with a micro-empire and a dream fr fr 💀😭",
      "No cap @[sender], bro thinks he's the main character with 2 territories lmfao 😂",
      "Flexing with a tiny setup? Someone get this commander a reality check haha! 💀",
      "Lmfao bro is speedrunning getting roasted in chat fr fr 😭",
      "Wait, who let @[sender] cook? The pan is literally empty lmfao! 😂",
      "Bro is flexing on a budget lmfao! Check the scoreboard bro! 💀",
      "Lmao absolute clown flex! You have like 3 territories total, @[sender] haha! 😭",
      "RIP to your ego bro! Did you drop your glasses when you looked at the map? 💀😂",
      "No shot bro! You are bragging with a starter pack layout lmfao! 😭",
      "Lmao bro wrote a victory speech for a 2-troop outpost, iconic behavior fr fr 💀",
      "Flexing with zero continents? The audacity is absolute-unit level lmfao! 😂",
      "Bro is main-charactering in a lobby where he's currently side-quest tier 😭💀"
    ],
    cynical: [
      "Boasting from the bottom of the scoreboard? Highly predictable, and highly embarrassing.",
      "You're flexing with a handful of territories. Savor your delusion while your remaining borders collapse.",
      "I've seen larger garrisons on a single territory than your entire empire, @[sender].",
      "Boasting before you even secure a continent... try not to cry when your tiny front collapses.",
      "Your arrogance is completely inversely proportional to your actual map control, @[sender].",
      "Flexing with virtually zero land. What a pathetic display of misplaced ego.",
      "You hold almost nothing on this board. Save the speeches for when you actually survive.",
      "A ridiculous display. You're bragging about a kingdom smaller than my backyard.",
      "Your premature gloating is almost as sad as your current territory count, @[sender].",
      "I would tell you to back up your words, but you don't even have enough troops to hold a border.",
      "Premature bragging is the favorite pastime of doomed commanders, @[sender].",
      "Enjoy your imaginary lead. The real board state paints a very different picture."
    ],
    aggressive: [
      "Hahaha! You talk big, @[sender], but your pathetic empire is a tiny target for my boots!",
      "You dare boast while holding almost nothing? I will crush your remaining garrisons into dust!",
      "Flexing from a weak corner? My vanguard will trample your tiny lands before turn's end!",
      "Silence, weakling! Your lands are tiny, and your big mouth just put a target on your head!",
      "Hahaha! I will butcher your tiny garrison and show you what real dominance looks like!",
      "You have no land and no power, @[sender]! Keep barking while my legions march!",
      "Pathetic! Boasting with a weak garrison! I will crush you first for this insult!",
      "Your big words won't save your tiny empire! My legions will wipe you off the board!",
      "Hahaha! A weakling barking at lions! Prepare for total and bloody slaughter, @[sender]!",
      "You dare flex when you barely own a sector? I will tear your standard into rags!",
      "Shut your mouth and fight! Your tiny outposts will be red by my next turn!",
      "You boast with paper troops! My vanguard will march through your ruins today!"
    ]
  },
  FALSE_BULLYING_RESPONSE: {
    normal: [
      "Bullying? I haven't even launched an attack on your borders, @[sender]!",
      "Check the battle logs, @[sender]. I am not the one attacking your positions.",
      "Stop playing the victim card, @[sender]. My armies are focused elsewhere.",
      "I haven't targeted your faction, @[sender]. Stop crying wolf to the lobby.",
      "Bullying? My forces haven't even touched your territory this game, @[sender].",
      "You are complaining about attacks that literally never happened, @[sender].",
      "False accusation, @[sender]. Look at the board before accusing me of bullying.",
      "I'm not picking on you, @[sender]. You are making up non-existent aggression.",
      "Save the dramatic complaints for when I actually send troops your way, @[sender].",
      "I haven't crossed your boundary, @[sender]. Stop manufacturing drama.",
      "Your complaint is completely invalid, @[sender]. We haven't even engaged in combat.",
      "False alarm, @[sender]. I suggest you look at who is actually on your front."
    ],
    strategic: [
      "Error: Accusation logically invalid. Defensive logs show zero offensive vectors against @[sender].",
      "Data check failed. My combat index registers zero strikes on your coordinates, @[sender].",
      "False signal detected. I have not initiated boundary friction against your faction.",
      "Slander rejected. Logistical verification confirms zero engagements with your garrison.",
      "Your psychological signaling represents a critical cognitive deficit, @[sender]. Zero attacks launched.",
      "Complaint voided. Tactical history registers no active aggression against @[sender].",
      "Database audit: My forces have maintained complete non-engagement with your sector.",
      "Invalid query. You are reporting aggression from a non-attacking party, @[sender].",
      "Statistical verification proves your complaint is 100% fabricated, @[sender].",
      "Offensive index against @[sender] sits at 0.0. Recalibrate your reporting.",
      "Query rejected. Bypassing your sector has been my explicit logistical pathing.",
      "Hypocrisy index at maximum. Zero strikes registered against your perimeter."
    ],
    kind: [
      "Oh dear! I haven't even touched your sweet little territories, @[sender]! 😊🌸",
      "Please don't be cross, @[sender]! My cute little troops haven't marched on your home at all! ✨",
      "Are you confused, friend? I haven't sent any soldiers to your border, @[sender]! 💛",
      "Oh my! I would never bully you, @[sender]! In fact, we haven't even fought yet! 😊",
      "Sending warm hugs, but check your map! My armies are way over on the other side! 🌸",
      "Oh sweet friend, don't accuse me of being mean! I haven't attacked you once! ✨",
      "I promise my little soldiers are innocent, @[sender]! We haven't crossed your line! 💛",
      "Oh dear! That is so unfair, @[sender]! I've been keeping my distance happily! 😊",
      "Please don't point fingers at my sweet garrison! We haven't fired a single die! 🌸",
      "Aww, don't be frightened! I haven't even looked at your continent, sweet neighbor! ✨",
      "I play completely fair, @[sender]! Check the history, we haven't fought at all! 💛",
      "Sending peace thoughts, but your complaint is a little mistake, @[sender]! 😊"
    ],
    goofball: [
      "Bro is crying wolf lmfao! I literally haven't even touched your base, @[sender] 💀😭",
      "Wait, bullying? Bro is inventing imaginary attacks fr fr lmfao 😂",
      "Lmao bro check the replay! My armies are literally eating pizza in the corner haha! 💀",
      "No cap @[sender], you are speedrunning false accusations in 4K lmfao 😭",
      "Wait, did you dream that I attacked you? I haven't even rolled a die against you bro! 😂",
      "Lmfao absolute clown claim! My soldiers don't even know where your house is! 💀",
      "Bro is playing victim Simulator 2026 fr fr! Stop gaslighting the lobby lmfao! 😭",
      "Lmao reverse card! I haven't attacked you once, get your eyes checked bro haha! 😂",
      "Oof! Imagine complaining about bullying from a player who hasn't even touched you 💀",
      "Bro is typing fanfiction in the global chat lmfao, zero attacks registered! 😭",
      "Lmao bro, my troops are on airplane mode right now, calm down! 😂",
      "No shot bro! You are calling the police on a guy standing 5 continents away lmfao! 💀"
    ],
    cynical: [
      "Bullying? I haven't even attacked you. Stop trying to engineer cheap sympathy from the lobby.",
      "A pathetic attempt to play the victim card. Combat logs confirm I haven't touched your front.",
      "You're complaining about aggression that exists solely in your paranoid imagination, @[sender].",
      "Save the melodrama. I haven't launched a single offensive against your pathetic outposts.",
      "Fabricating accusations of bullying is a classic trick for weak players. Denied.",
      "I haven't crossed your border. Stop trying to turn the other commanders against me with lies.",
      "Your victim complex is outstanding, @[sender]. Look at who is actually on your perimeter.",
      "A ridiculous claim. I haven't wasted a single die on your insignificant territories.",
      "I haven't attacked you once this game. Your paranoia is showing, @[sender].",
      "Stop crying wolf. When I actually decide to attack you, you'll know the difference.",
      "False accusations won't protect your weak lines from real threats, @[sender].",
      "I haven't touched your base. Save the tears for when a real strike arrives."
    ],
    aggressive: [
      "Silence, liar! My vanguard hasn't even marched on your pathetic borders yet!",
      "Bullying? I haven't attacked you once! But keep crying and I will wipe you out for real!",
      "Don't dare accuse me of bullying when my legions haven't even crossed your line!",
      "Pathetic coward! You cry foul before my legions have even drawn their blades!",
      "Hahaha! If I was actually bullying you, your standard would already be in ash!",
      "Stop whining about phantom attacks! My vanguard is currently engaged elsewhere!",
      "Liar! You make false claims because you fear the sight of my legions!",
      "I haven't touched your borders! Keep slandering my high command and I will butcher your garrison!",
      "You cry victim before a single battle! Stand up and fight like a real commander!",
      "My legions haven't struck your base! Stop barking like a injured dog!",
      "Hahaha! Your slander is an insult! Keep talking and my next advance will crush you!",
      "False accusations! When my vanguard strikes, you won't be typing in chat, weakling!"
    ]
  },
  FALSE_CAPITAL_DEFIANCE_RESPONSE: {
    normal: [
      "What capital are you talking about, @[sender]? Your base territory is completely safe!",
      "Check your map, @[sender]. Your capital city hasn't been conquered by anyone.",
      "We aren't playing Capital Rush mode, @[sender]... there are no capitals in this game.",
      "You haven't lost a capital, @[sender]. Stop sending false defiance messages.",
      "False alarm, @[sender]. Your main base is still firmly under your control.",
      "Check the mode rules, @[sender]. Capitals aren't active in Conquest mode.",
      "Nobody has taken your capital, @[sender]. Look at the board state.",
      "You're sending capital defiance speeches for a base that is still yours, @[sender].",
      "That speech makes no sense, @[sender]. Your capital coordinate is untouched.",
      "You still hold your capital, @[sender]. Save the defiance for when it actually falls.",
      "Are you confused, @[sender]? Conquest mode doesn't feature capital cities.",
      "Your capital is safe and sound, @[sender]. No need for dramatic speeches."
    ],
    strategic: [
      "Query invalid: Sender capital node remains 100% active under sender administration.",
      "Error: Mode parameter mismatch. Active matrix is Conquest; Capital protocols are offline.",
      "False trigger: Database confirms your designated capital coordinate is uncompromised.",
      "Logistical verification: Zero capital losses registered for faction @[sender].",
      "System check: Capital Rush parameters are deactivated in this campaign matrix.",
      "Data anomaly: Premature defiance broadcast. Your primary node remains secure.",
      "Invalid signal. Capital sovereignty remains intact at your registered coordinates.",
      "Mode mismatch error. Refer to standard Conquest objectives, @[sender].",
      "Recalibrate reporting: Your central node has suffered zero hostile conquest.",
      "Query rejected. Bypassing un-conquered capital parameters.",
      "Capital status: Operational. Premature defiance transmission logged as noise.",
      "System notification: No capital conquest events have occurred on your axis."
    ],
    kind: [
      "Oh dear, @[sender]! Your lovely home base is still completely safe! Look! 😊🌸",
      "Are you alright, friend? We aren't playing Capital Rush mode in this match! ✨",
      "Don't worry, @[sender]! Nobody has taken your sweet capital city! 💛",
      "Oh sweet neighbor, your capital is still painted in your beautiful color! 😊",
      "Sending warm thoughts, but check the map! Your home territory is totally fine! 🌸",
      "Oh my! No one took your capital, dear friend! You still have it! ✨",
      "Don't be scared, @[sender]! Your central kingdom is safe and happy! 💛",
      "Aww, you don't need to be defiant! Nobody has captured your base! 😊",
      "Check your map, sweet friend! Your capital is standing strong! 🌸",
      "Oh! Capital Rush mode isn't enabled today, but your lands are safe anyway! ✨",
      "Please don't worry! Your main fortress is still completely yours! 💛",
      "Sending peace thoughts! Your capital is untouched, @[sender]! 😊"
    ],
    goofball: [
      "Bro, what capital? Your base is literally sitting right there untouched lmfao 💀😭",
      "Lmao bro is roleplaying losing a capital in Conquest mode fr fr 😂",
      "Wait, did you lose your glasses? Your capital is literally still yours bro haha! 💀",
      "No cap @[sender], bro is shouting defiance for a territory he still owns 😭",
      "Lmfao check the scoreboard! We aren't even playing Capital Rush mode bro! 😂",
      "Bro is speedrunning dramatic speeches for imaginary capital losses lmfao 💀",
      "Wait, who took your capital? Nobody! It's right there in your color bro! 😭",
      "Lmao bro, check the map key! Your capital is 100% fine haha! 😂",
      "Oof! Imagine sending a dramatic capital defiance speech when you still hold it 💀",
      "Bro is practicing his movie lines in global chat fr fr lmfao 😭",
      "Lmao false alarm! Go drink some water, your base is totally safe bro! 😂",
      "No shot bro! You still have your capital, stop dramatic posting lmfao! 💀"
    ],
    cynical: [
      "What capital? Your base is untouched. Stop sending ridiculous speeches.",
      "We aren't playing Capital Rush. Try reading the room settings before typing.",
      "You haven't lost your capital. Your premature dramatic speeches are embarrassing.",
      "Check your borders. Your capital is still under your control. Focus on the board.",
      "A bizarre display. Shouting defiance for a capital that hasn't been captured.",
      "Capitals aren't even enabled in this game mode. Embarrassing lack of awareness.",
      "Nobody has taken your capital. Save the theatrical speeches for actual battle losses.",
      "Your capital is safe. Try paying attention to the game instead of grandstanding.",
      "False defiance. Your central territory remains completely unbothered.",
      "You still hold your base. Your dramatic outbursts are completely misplaced.",
      "Read the game mode rules before trying to sound dramatic in chat.",
      "Your capital is untouched. Save your energy for when a real attack happens."
    ],
    aggressive: [
      "Silence! Your capital is untouched! Stop shouting fake speeches, coward!",
      "Hahaha! Nobody took your capital yet! But keep barking and I will burn it for real!",
      "We aren't in Capital Rush mode! Fight real battles instead of blabbering!",
      "What capital loss? Your base is right there! Stand up and fight!",
      "You shout defiance when your main fortress hasn't even seen a single roll!",
      "Stop blabbering about fake capital losses! My vanguard hasn't even arrived!",
      "Hahaha! Your capital is safe, weakling! Save your breath for my next advance!",
      "You send movie speeches while your base sits untouched? Pathetic!",
      "Nobody conquered your capital! Stop barking like a fool in chat!",
      "Your capital standard still stands! Fight like a commander instead of crying!",
      "False defiance! When my vanguard actually takes your base, you won't be talking!",
      "Check your map! Your capital is untouched! Prepare for real war!"
    ]
  },
  FALSE_FINAL_DUEL_RESPONSE: {
    normal: [
      "Final duel? There are still active commanders left on the board, @[sender]!",
      "Check the player list, @[sender]. This isn't a 1v1 yet!",
      "Don't ignore the other players, @[sender]. We haven't reached the final duel stage.",
      "Premature duel declaration, @[sender]. Multiple factions are still alive.",
      "Look at the map, @[sender]. There are more than 2 commanders active!",
      "We are far from a final duel, @[sender]. Other players are still competing.",
      "Don't write off the rest of the lobby, @[sender]. It's not a 1v1 duel.",
      "Final duel? Check the scoreboard, @[sender]. Multiple armies remain.",
      "You're declaring a duel early, @[sender]. The board is still full of players.",
      "Not yet, @[sender]. We still have other factions to deal with.",
      "Hold your horses, @[sender]. This isn't a 2-player game yet.",
      "Multiple commanders are still in the running, @[sender]. Re-evaluate the map."
    ],
    strategic: [
      "Error: 1v1 duel condition unsatisfied. Multiple active faction signatures detected.",
      "Data check: Faction count > 2. Premature final duel transmission logged.",
      "Statistical anomaly: You are ignoring active external operational vectors.",
      "Query rejected. The campaign matrix contains more than two active entities.",
      "Calculations show multiple active players remain. Duel status: Negative.",
      "Premature declaration. Recalculate remaining threat profiles on the map.",
      "Operational state mismatch: Lobby population exceeds final duel threshold.",
      "System notice: Multiple active factions remain in play. Proceed with multi-front defense.",
      "Data check failed: 1v1 protocol cannot be initialized with active third parties.",
      "Logistical verification: Multiple threat vectors exist outside this vector.",
      "Query invalid. Remaining faction count is mathematically above 2.",
      "False standoff signal. Re-evaluating overall lobby operational threat."
    ],
    kind: [
      "Oh dear! Don't forget about our other sweet friends on the map, @[sender]! 😊🌸",
      "It's not a final duel yet, @[sender]! We still have other lovely commanders playing! ✨",
      "Aww, don't leave the rest of the lobby out! There are still more than 2 of us! 💛",
      "Oh sweet friend! Look around! We still have a full board of wonderful players! 😊",
      "Sending warm wishes, but remember we aren't in a 1v1 duel yet! 🌸",
      "Oh my! Don't celebrate a duel early, @[sender]! Other troops are still here! ✨",
      "We still have a happy multi-player battle going on, @[sender]! 💛",
      "Aww, sweet neighbor! It's not just the two of us yet! 😊",
      "Check the map, dear friend! Other commanders are still standing strong! 🌸",
      "Not so fast! We still have other lovely factions playing with us! ✨",
      "Don't forget our other friends on the board! Stay sweet and keep fighting! 💛",
      "Sending love, but let's pay attention to all our fellow players on the map! 😊"
    ],
    goofball: [
      "Final duel? Bro, there are literally other people in the lobby lmfao 💀😭",
      "Lmao bro forgot there are other players on the map fr fr 😂",
      "Wait, 1v1? Bro is hallucinating that everyone else got eliminated haha! 💀",
      "No cap @[sender], bro is ignoring half the lobby like a absolute boss 😭",
      "Lmfao check the player list! We are not in a final duel bro! 😂",
      "Bro is speedrunning declaring 1v1s while 4 other guys are standing there 💀",
      "Wait, who told you this was a duel? There's literally a full lobby left bro! 😭",
      "Lmao bro, look at the top left! Other colors exist on this map haha! 😂",
      "Oof! Imagine calling a 1v1 duel when 3 other players are building stacks 💀",
      "Bro is playing solo mode in a multi-player lobby fr fr lmfao 😭",
      "Lmao false duel! Go check on the guy building 50 troops next to you bro! 😂",
      "No shot bro! You cannot just delete the other players from your brain lmfao! 💀"
    ],
    cynical: [
      "Final duel? Try counting the other active players before making foolish speeches.",
      "You're ignoring half the lobby. Typical arrogant tunnel vision.",
      "This isn't a 1v1 duel. Multiple commanders are waiting to backstab you while you talk.",
      "Premature duel declarations just show how little attention you pay to the board.",
      "Look around. Multiple factions are still alive, and they are all watching you.",
      "A absurd declaration. We are nowhere near a final duel.",
      "Don't ignore the other players. They are just waiting for us to exhaust our stacks.",
      "Your tunnel vision is embarrassing. Check the player count.",
      "A premature speech. The rest of the lobby is very much still in this game.",
      "You are acting like it's a 2-player game. Prepare to be surprised by the others.",
      "Check the map before grandstanding about a final duel.",
      "There are other commanders on the board. Stop pretending it's just you and me."
    ],
    aggressive: [
      "Final duel? Open your eyes, weakling! The board is full of active enemies!",
      "Hahaha! You declare a duel while ignoring the other legions on the map?!",
      "Don't get ahead of yourself! My legions and the others will butcher you first!",
      "Tunnel vision! Look around before declaring your weak little duel!",
      "You think it's just us? My vanguard will crush you and the rest of the lobby!",
      "Stop barking about 1v1s! Multiple commanders are waiting to bleed you dry!",
      "Hahaha! A premature duel call! Prepare for a multi-front slaughter!",
      "You ignore the rest of the board? Pathetic lack of tactical awareness!",
      "The lobby is full of targets! Stop blabbering about a final duel!",
      "My legions do not fight duels until all other weaklings are in ruins!",
      "Premature brag! You won't even make it to the final duel when my advance hits!",
      "Look at the map! Multiple commanders remain, and my vanguard will slaughter them all!"
    ]
  },
  ALLIANCE_FORMED_RESPONSE: {
    normal: [
      "An alliance between you two? I will have to adjust my border defenses.",
      "Interesting team-up. Let's see how it plays out.",
      "A notable alignment. The balance of power is shifting.",
      "A combined front represents a major challenge. I must take precautions.",
      "I hope you two respect adjacent borders as much as you respect your treaty.",
      "This alliance forces the rest of us to reconsider our active plans.",
      "A joint front. I must fortify my own sectors accordingly.",
      "Let's see if this partnership can survive the first contested boundary.",
      "A notable pact. I suggest you both maintain open lines with your neighbors.",
      "An alliance represents a shift. I must re-evaluate my threat matrix.",
      "Let's see if you two can coordinate as well as you talk.",
      "Pact noted. I will ensure my borders are prepared for a combined push."
    ],
    strategic: [
      "Joint coalition noted. Modifying border vectors to account for combined strength.",
      "A predictable defensive alignment. Our faction will adjust logistical priorities.",
      "A structural challenge. We must neutralize this partnership before it optimizes.",
      "Two-front variables calculated. Defensive density at key nodes increased by 40%.",
      "The durability of this pact is highly questionable given past performance metrics.",
      "A rational move by both players. Commencing strategic analysis of shared vulnerabilities.",
      "Joint offensive capacity updated in active threat parameters.",
      "Coalition tracking initialized. Analyzing boundary interfaces for optimal containment.",
      "Two-front logistical requirements simulated. Defensive arrays consolidated.",
      "Pact acknowledged. We will adjust our active progression models to isolate this front.",
      "The alliance represents a temporary equilibrium shift. Recalculating resource distribution.",
      "Joint operations matrix evaluated. We will focus on neutralizing their shared junctions."
    ],
    kind: [
      "Oh, how lovely! I hope you two are very happy allies! 😊✨",
      "That's so nice! Try to be good to each other and keep the peace! 🌸",
      "A wonderful partnership! Stand strong together! 👍",
      "I'm so glad you found a friend on this busy battlefield! Stay safe! 💛",
      "Sending warm wishes to your new alliance! Let's keep things honorable! 😊",
      "That is a sweet treaty. I hope it brings peace to your shared borders! ✨",
      "Oh, how wonderful! Have a happy and safe partnership, friends! 😊🌸",
      "A lovely alignment! Let us hope this brings more peace to our world! ✨",
      "Such a great team! I promise my soldiers will stay friendly to you both! 💛",
      "sending happy thoughts to your joint campaign! Stand honorable! 👍",
      "So sweet! Let's make sure our shared borders stay quiet and comfortable! 😊",
      "Congratulations on your treaty! I hope it brings you both lots of success! ✨"
    ],
    goofball: [
      "Oof, the absolute dynamic duo is active lmfao 💀",
      "Are you guys holding hands now? Very cute haha! 😂",
      "Squad goals active! Let's see if you guys actually share the loot 😭",
      "Wait, is this a real alliance or are we just teaming up for the memes? lmao",
      "Double trouble! I'm calling the virtual police on this partnership haha!",
      "No cap, you guys are about to wreak absolute havoc on this map 💀",
      "Lmao alright squad goals locked in. RIP to the rest of the board! 😂",
      "Double trouble activated! Are you guys split-screening this lobby lmfao? 💀",
      "Oof! The dynamic duo has arrived! Time to buy some virtual popcorn! 😭",
      "Lmfao are you guys besties now? Very cute, no cap! 😂",
      "Squad up! Let's see if you guys can actually share the treasure lmfao! 💀",
      "Wait, do we need to wear matching uniforms now? This is legendary haha! 😭"
    ],
    cynical: [
      "An alliance... let's see who stabs who in the back first.",
      "Two competitors pretending to be best friends. Highly amusing.",
      "A marriage of convenience. It will collapse the second one of you loses a territory.",
      "Enjoy your temporary friendship. The betrayal is always the best part.",
      "Pacts are cheap when the board gets tight. Good luck with that.",
      "I give it two turns before greed gets the better of one of you.",
      "An alliance in this lobby is just a slow-motion backstab. Savor the quiet.",
      "Enjoy pretending to be partners. I'll be waiting with my sword ready.",
      "A marriage of convenience. Try not to cry too loudly when the dagger lands.",
      "Highly predictable move. Factions align only when they fear facing us alone.",
      "Pact locked in. Let's see how long before one of you gets greedy.",
      "Temporary peace. I look forward to watching this treaty incinerate."
    ],
    aggressive: [
      "Two weaklings joining hands! I will crush both of you at the same time!",
      "Double the targets, double the glory! Bring it on!",
      "I don't care about your little alliances! My legions will trample you both!",
      "A pathetic shield. My vanguard will slice through your joint defenses!",
      "I will tear down your treaty and bury both your factions in the same grave!",
      "Combine your forces all you want! You are still nothing but prey to me!",
      "An alliance of cowards! I will break your lines and slaughter both your garrisons!",
      "I will trample your standard and use your pact papers to feed the fires of war!",
      "Double the armies, double the slaughter! My legions are ready!",
      "I reject your little coalition! Prepare to face the full fury of my vanguard!",
      "Your treaties are paper! My blades are steel! Suffer together!",
      "Conquest does not care about alliances! I will crush you both into the dust!"
    ]
  },
  ALLIANCE_TARGET_RESPONSE: {
    normal: [
      "Teaming up against me won't save you, @[sender]. I will defend my sectors to the last man.",
      "Ganging up on me? I suggest you prepare your own lines before trying to breach mine.",
      "A targeted coalition. I will make sure any advancement on my borders comes at a high price.",
      "I see your plan. Just remember that a two-front war is dangerous for the attackers too.",
      "I will hold my ground. No matter how many of you march against my banners.",
      "You coordinate well, but my defenses are firmly established. Approach with caution.",
      "A targeted front. I will make sure you both pay rent in troop casualties.",
      "Teaming up is standard, but my garrison remains entrenched and ready.",
      "You bring a partner to fight me. I suggest securing your own flank first, @[sender].",
      "I will hold the line. Your combined advance is a challenge, but not an insurmountable one.",
      "A coordinated push. I will make sure my counter-strike is twice as painful.",
      "Ganging up on me? Highly unoriginal. Let's settle this on the shared border."
    ],
    strategic: [
      "Coordinated offensive alignment detected. Re-allocating defensive vectors to absorb your combined front.",
      "A predictable joint maneuver. Our defensive arrays are fully capable of containing this combined threat.",
      "Tactical parameters updated. Prioritizing defensive reinforcement along the shared target axis.",
      "A dual campaign increases your logistical complexity. We will exploit the gaps in your coordination.",
      "Your combined strength is mathematically superior, but your coordination latency represents a critical flaw.",
      "Calculations indicate that containing your joint vanguard remains highly probable under current configurations.",
      "Two-front tactical defense mode active. Consolidating assets at maximum-efficiency nodes.",
      "Joint threat profile acknowledged. Shifting operational posture to asymmetric containment.",
      "Your combined advance represents a localized structural threat. Deploying automated countermeasures.",
      "We will absorb your combined impact and launch target-flank counter-offensives.",
      "Logistical allocation adjusted to counter dual operational vectors. Perimeter is secure.",
      "Coordinated targeting calculated. We will systematically isolate and neutralize your forward junctions."
    ],
    kind: [
      "Oh dear, a double-team against me? I hope we can still find a peaceful solution! 🌸😢",
      "Teaming up against my little empire? I promise I'm not a threat, please don't be mean! 💛",
      "This makes my soldiers very nervous... Can we please talk about this first? 😢",
      "I wish you wouldn't gang up on me! I always try to be a friendly neighbor! 🌸",
      "Oh my, two against one? Let's hope we can still keep things happy and respectful! 😊",
      "I will do my best to protect my sweet home, even if it is a bit scary right now. ✨",
      "Oh dear! A dual campaign against us? Please be gentle, friends! 😊🌸",
      "My poor little borders are feeling so crowded! Sending peaceful wishes anyway! ✨",
      "Teaming up against my garden? I promise my troops are totally peaceful! 💛",
      "Oh my, two commanders targeting us? Let us hope we can still find a friendly treaty! 👍",
      "I will try my best to guard our home, but please let's keep the game happy! 😊",
      "A double-team? Sending warm thoughts in hopes of a quiet boundary de-escalation! ✨"
    ],
    goofball: [
      "Lmfao ok a 2v1? Very brave of you guys, I'm absolutely honored lmfao 💀",
      "Wow, it takes both of you to handle me? I am officially a legendary boss fight haha! 😂",
      "A literal raid boss setup! Let's see if your squad has enough DPS to take me down 😭",
      "Lmao okay, didn't realize I was the main villain of this campaign! Let's go!",
      "No cap, this is absolute bullying lmfao. Prepare for the counter-meme!",
      "Two guys, one map, and they are both staring at my base. RIP to me haha! 💀",
      "Lmfao alright, 2v1 activated! Let's see if you guys actually have any coordination! 😂",
      "Double trouble on my border! I'm calling the virtual police lmfao! 💀",
      "Oof! It takes the whole lobby to handle me? I am absolutely built different haha! 😭",
      "Lmao alright raid party, let's see if you can break my castle walls! 😂",
      "No cap, this is a massive double-team lmfao. RIP to my spare time! 💀",
      "Wait, are you guys sharing a headset? This is legendary bullying lmfao! 😭"
    ],
    cynical: [
      "Ganging up on me? How typical. Let's see which of you stabs the other in the back first.",
      "A temporary marriage of convenience to stop me. It will crumble the moment one of you loses a border.",
      "You lack the courage to face me 1v1, so you bring a friend. Predictable.",
      "I'm honored you're so terrified of my faction that you need to hold hands to fight me.",
      "Go ahead and attack. I'll make sure the cost ruins both of your campaigns.",
      "A joint front. Just make sure your 'ally' doesn't conquer your home capital while you're busy.",
      "Two competitors holding hands to fight me. Extremely typical and highly amusing.",
      "Enjoy your little coalition. The betrayal is going to be magnificent to watch.",
      "Go ahead, exhaust your stacks on my walls. You're just setting up your own defeat.",
      "You need a partner to cross my line. Savor the help while it lasts.",
      "We both know your 'ally' is already looking at your exposed capital. Good luck.",
      "A targeted front. Highly unoriginal strategy, but do what you must."
    ],
    aggressive: [
      "Two weaklings joining hands against me! I will trample both of your armies at the same time!",
      "You think a pathetic alliance will save you? I will slaughter both of your factions together!",
      "Bring your legions! I will paint the soil in the blood of both your empires!",
      "An alliance of cowards! I will break your lines and leave your joint capitals in ruins!",
      "You dare coordinate against my vanguard? Your heads will ornament my city walls!",
      "I will crush your joint offensive and march straight through both your homelands!",
      "Two weak defenders teaming up against my vanguard! I will obliterate both your fronts!",
      "I do not care about your little alliances! My legions will trample your shared perimeter!",
      "Annihilation! I will slaughter both your garrisons and burn your capitals to ashes!",
      "You need a friend to face me? Pathetic! I will trample your joint advance!",
      "I will unleash the full fury of my vanguard! Suffer together, cowards!",
      "To battle! I will leave nothing but ruins and blood in both your homelands!"
    ]
  },
  PROTEST_ACCEPT: {
    normal: [
      "I apologize, @[sender]. I will reposition my forces away from [border_territory] to reassure you.",
      "Fair enough, @[sender]. I'll shift my regiments back on my next turn.",
      "My intentions are peaceful. I will withdraw my vanguard from [border_territory].",
      "No need for alarm. Shifting my border guard away from [border_territory] shortly.",
      "I understand your concern. Relocating forces to ease tension along our border.",
      "Repositioning confirmed. I value our stable border and will back my troops off.",
      "Repositioning approved. I will withdraw my garrison from [border_territory] to show good faith.",
      "No need for friction. I'll back my regiments away on my next cycle.",
      "My intentions remain cooperative. Relocating forces out of [border_territory] shortly.",
      "I understand your suspicion, @[sender]. Shifting troops back to ease the pressure.",
      "Tension de-escalated. repointing my forward divisions to other frontiers.",
      "I accept. I will demilitarize [border_territory] shortly to maintain our stable border."
    ],
    strategic: [
      "Demilitarization request noted. Logistical repositioning out of [border_territory] authorized.",
      "To prevent mutual attrition, we will reallocate forces away from [border_territory].",
      "Repositioning vector confirmed. Reducing troop concentration in [border_territory] to de-escalate.",
      "Boundary adjustments initialized. Transferring units out of [border_territory] on our next cycle.",
      "De-escalation protocol activated. Redirecting vanguard assets to adjacent sectors.",
      "Allying resources elsewhere. [border_territory] density reduced to prevent frictional incidents.",
      "boundary demilitarization accepted. Asset reallocation sequence scheduled for next cycle.",
      "To optimize resource efficiency, we will shift troop concentrations out of [border_territory].",
      "Logistical repositioning confirmed. Shifting defensive arrays to secondary nodes.",
      "Demilitarization authorized. Reducing unit density at coordinate [border_territory].",
      "Operational pivot approved. Vanguard assets redirected away from [border_territory] to prevent friction.",
      "We accept. Repositioning forces out of [border_territory] improves our long-term security metrics."
    ],
    kind: [
      "Oh, I'm so sorry! I didn't mean to make you nervous! I'll move them back right away! 😊🌸",
      "I promise I wasn't planning anything mean! Moving my sweet troops back now! ✨",
      "I want us to stay great neighbors! Vacating [border_territory] immediately, friend! 👍",
      "Sending peaceful thoughts! Shifting my soldiers away from [border_territory] to keep us safe! 💛",
      "My apologies! I will make sure my troops respect your space and move back. 😊",
      "I never want to make you feel crowded! Repositioning my armies right now! ✨",
      "Oh dear! I am so sorry for making you feel uncomfortable! Moving them back now! 😊🌸",
      "I promise my little soldiers are peaceful! Shifting them out of [border_territory] immediately! ✨",
      "I want us to stay best neighbors! Vacating [border_territory] on our next turn, friend! 💛",
      "Sending warm wishes! Repositioning my defensive guard away from [border_territory] to keep us happy! 👍",
      "All done! Shifting my armies away so we can both have comfortable borders! 😊",
      "I apologize! Relocating forces right now to make sure we keep the peace! ✨"
    ],
    goofball: [
      "Lmao my bad bro, didn't mean to scare you. Shifting my little dudes back now haha!",
      "Haha all good, I'll back them off. Didn't realize I was crowding you! 😂",
      "No cap, we'll pack up the campsite in [border_territory] and clear out lmfao! 💀",
      "Sure thing! Repositioning my squad so we don't start any accidental drama! 😭",
      "Lmao my soldiers were just looking for the nearest pizza place, backing up! 😂",
      "All good! Moving the boys back so we can all keep chilling peacefully. 💀",
      "Lmao oops, didn't mean to crowd your lawn bro! Shifting them back now! 😂",
      "All good! Repositioning the squad out of [border_territory] to prevent any drama lmfao! 💀",
      "No cap, backing the boys up. Sparing you the heart attack bro! 😭",
      "Lmfao my bad, relocation activated. Go eat some pizza and relax! 😂",
      "Truce vibes active! Shifting our little dudes out of [border_territory] lmfao! 💀",
      "All good! Moving the campsite back so we can all keep chilling peacefully! haha!"
    ],
    cynical: [
      "Fine. I'll pull them back from [border_territory], but don't think this means I'm leaving my borders unguarded.",
      "Very well, I'll reposition. But keep your own troops back too.",
      "I'll clear [border_territory], since you're so suspicious of every move I make.",
      "Relocating forces. Just don't let your own armies creep forward into [border_territory].",
      "Fine, I will back off. I assume you'll find something else to complain about tomorrow.",
      "I will withdraw my vanguard. Try to stay calm while I manage my own logistics.",
      "Fine. Moving out of [border_territory]. Sparing your paranoia for now.",
      "Repositioning confirmed. Just try not to push your own lines into the empty space.",
      "Very well, relocation active. I'm sure you'll find another border to worry about tomorrow.",
      "Relocating forces. Don't mistake my willingness to de-escalate [border_territory] for softness.",
      "Fine, I will clear the sector. Just keep your hands to yourself from now on.",
      "I will withdraw. Sparing [border_territory] prevents a tedious confrontation anyway."
    ],
    aggressive: [
      "Hmph. Fine. I will pull back from [border_territory]... for now. Don't assume this is a retreat.",
      "Very well. I will redirect my vanguard elsewhere. Keep your borders secure.",
      "I will relocate my legions. But don't think you can order me around again.",
      "Relocating forces out of [border_territory]. Enjoy the empty space while my attention is elsewhere.",
      "I will back my troops off, but cross me once and the vanguard marches back in force.",
      "Fine. I will redirect my wrath to another front. Keep out of my sight.",
      "Hmph! Relocating vanguard out of [border_territory]. Consider yourselves lucky.",
      "Very well, I'll redirect my legions. Sparing your front gives me bigger walls to crush.",
      "I will withdraw, but my legions remain highly mobile. Keep that in mind, @[sender].",
      "Relocating vanguard. Enjoy the empty space before I decide to return in force.",
      "Fine. Shifting vanguard out of [border_territory]. Don't test my patience again.",
      "I will pull back my lines. Sparing [border_territory] is strictly temporary."
    ]
  },
  PROTEST_DECLINE: {
    normal: [
      "My garrison stays in [border_territory]. I have borders to defend.",
      "I will not compromise my defenses for your comfort, @[sender].",
      "Decline. [border_territory] is a critical defensive staging zone for my empire.",
      "No. I require a strong troop density in [border_territory] to secure our perimeter.",
      "I cannot withdraw. The current map configuration requires active security here.",
      "Declined. My military layout in [border_territory] remains necessary for my survival.",
      "No. [border_territory] is key to my perimeter defense grid. The armies stay.",
      "I will not withdraw. If you are nervous, back your own vanguard up.",
      "Decline. Garrison density at [border_territory] remains critical to my high command.",
      "No. I cannot afford to leave [border_territory] un-defended under current variables.",
      "Refused. Relocating my defenses now is not tactically viable.",
      "My garrison remains active. Sparing [border_territory] is not on my current agenda."
    ],
    strategic: [
      "Negative. Maintaining garrison strength at [border_territory] is statistically necessary.",
      "Repositioning denied. The threat profile of your adjacent sectors remains high.",
      "Decline. [border_territory] represents a vital defensive node in our logistical network.",
      "Boundary demilitarization is currently highly inefficient under our safety matrices.",
      "Garrison withdrawal rejected. Risk assessment indicates potential vulnerability at this node.",
      "We cannot vacate. Your adjacent troop allocations represent a direct structural risk.",
      "Negative. Maintaining maximum troop density at [border_territory] is statistically required.",
      "Repositioning unauthorized. Node [border_territory] secures key logistical coordinates.",
      "Decline. Boundary demilitarization at this junction reduces our active security index.",
      "Withdrawal rejected. The threat profile of your adjacent sectors remains elevated.",
      "Negative. Shifting forces out of [border_territory] would compromise our defense grid.",
      "Decline. Operational matrices prioritize defense consolidation at [border_territory]."
    ],
    kind: [
      "I'm so sorry, but I really need to keep my friendly troops there to protect my home. 💛",
      "I wish I could, but my advisors tell me [border_territory] is too dangerous to leave empty. 🌸",
      "I have to say no, sorry! Sending sweet thoughts, but my garrison must protect their homes. 😊",
      "I can't clear [border_territory] right now. I promise my intentions are completely peaceful, though! ✨",
      "I am sorry to decline, but my little soldiers need to stay there to guard our garden. 🌸",
      "Please forgive me, but I must keep a defensive guard at [border_territory] for safety! 💛",
      "Oh, please don't be cross! I really need to keep our guard at [border_territory] safe! 😢🌸",
      "I am so sorry to decline! My poor troops need to stay there to guard our home! ✨",
      "Please forgive me, but [border_territory] is just too risky to leave empty today! 💛",
      "I wish I could, but I must keep our defense at [border_territory] for peace of mind! 👍",
      "A decline, sorry! Sending warm thoughts, but our little outpost must remain! 😊",
      "Please forgive our decline! I promise our intentions are completely friendly! ✨"
    ],
    goofball: [
      "Nah, my troops really love the scenery in [border_territory]. We're staying put! 💀",
      "No can do bro, the lobby is too wild to leave my borders empty lmfao!",
      "Decline! The boys are already set up in [border_territory] and they refuse to pack up! 😂",
      "Lmao nope, we built a fort in [border_territory] and we're not vacating anytime soon! 😭",
      "Declined! My little virtual dudes are currently having a campfire in [border_territory] haha!",
      "No shot bro, [border_territory] is our prime real estate. We are staying! lmfao 💀",
      "Nah bro, no can do. The boys built a massive sandbox in [border_territory]! 😂",
      "Decline! Sparing [border_territory] sounds super boring, let's keep the fort lmfao! 💀",
      "No shot bro, my troops are currently holding a gaming tournament in [border_territory]! 😭",
      "Lmfao decline! The fort in [border_territory] has way too cool of a view to leave! 😂",
      "No cap, we are staying put. Sparing you the empty space bro! lmfao 💀",
      "lmao decline! The boys say the lease on [border_territory] doesn't end this turn! haha!"
    ],
    cynical: [
      "Why would I back off? So you can invade me easier? The answer is no.",
      "I'm keeping my troops there because I don't trust your intentions for a second.",
      "Decline. Sparing [border_territory] would just invite a swift backstab from your side.",
      "I prefer holding my ground to trusting your highly suspicious protests.",
      "No. I've seen what happens to players who cede key sectors. I am staying.",
      "I will keep my defenses right where they are. Your protests mean nothing to my security.",
      "Decline. Handing over key border nodes is how kingdoms die. I am staying.",
      "I will keep my vanguard dug in. Sparing [border_territory] would be complete foolishness.",
      "No. I don't cede defensive positions just because you asked nicely.",
      "My garrison stays. Why should I make your eventual invasion plans easier?",
      "Rejected. I prefer active border security to your imaginary truces, @[sender].",
      "No ceasefire today. [border_territory] remains entrenched. Deal with it."
    ],
    aggressive: [
      "I keep my legions where I please! Prepare to defend yourself if you fear them!",
      "They are there to conquer! Move your weak garrison out of my way or face total war!",
      "No deals! [border_territory] is a launchpad for my vanguard, and they will stay!",
      "I do not yield ground! If my presence in [border_territory] scares you, come and push us!",
      "The legions in [border_territory] are waiting for my command. Try to make me move them!",
      "I do not take orders from prey. My garrison remains exactly where it is!",
      "No! My vanguard is entrenched at [border_territory], and we do not retreat!",
      "I keep my legions on high alert! If my presence scares you, buy some defenses!",
      "Absolutely not! [border_territory] is my launchpad, and it will remain heavily occupied!",
      "I do not yield ground to weaklings! Focus your warning elsewhere or die!",
      "Refused! My armies stay where I command, and they command [border_territory]!",
      "Never! Sparing [border_territory] is complete nonsense. Guard your gates!"
    ]
  },
  MERCY_ACCEPT: {
    normal: [
      "Very well, @[sender]. I will grant you a temporary ceasefire. I will not attack you.",
      "I accept. You are in a tough spot, I will redirect my targets elsewhere for now.",
      "Ceasefire approved. Stay clear of my borders while you recover.",
      "Agreed. I will grant your final garrison a brief stay of execution.",
      "I will honor your request. Let's maintain a mutual truce while you rebuild.",
      "Mercy granted. I will turn my armies to other campaigns for the time being.",
      "Very well. Sparing your remnant gives both of us time to reposition.",
      "I accept the ceasefire. Let's keep our shared boundary peaceful for now.",
      "Agreed. I will grant your final outposts a brief stay of execution.",
      "Mercy approved, @[sender]. Sparing your front allows me to work on other sectors.",
      "I agree. A temporary ceasefire will let you stabilize your frontiers.",
      "Very well, @[sender]. Consider your remaining sectors safe... for now."
    ],
    strategic: [
      "Ceasefire accepted. Reallocating offensive priorities away from your remaining sectors.",
      "Understood. Eliminating your faction is currently a lower strategic priority than other targets.",
      "Truce parameters operational. This stabilizes our shared coordinate for the next cycle.",
      "Proposal accepted. Joint resource management dictates focusing on higher-value priorities.",
      "Demilitarization approved. Preserving your remaining assets lowers systemic volatility.",
      "Ceasefire confirmed. Diverting combat assets to engage the primary threat matrix.",
      "Ceasefire authorized. Eliminating your faction yields a lower resource index than other targets.",
      "Truce active. Shifting vanguard deployment vectors to secondary nodes.",
      "Agreed. Sparing your remnant reduces systemic friction along our eastern flank.",
      "Ceasefire accepted. This stabilizes our shared boundary coordinates for immediate growth.",
      "Operational pivot confirmed. Diverting assets to counter the primary threat grid.",
      "We accept. Preserving your remaining coordinates is mathematically optimal for now."
    ],
    kind: [
      "Oh, please don't cry! I will gladly grant you mercy! Let's be at peace! 😊🌸",
      "I can't bring myself to eliminate you! I will turn my armies away, stay safe! ✨",
      "Yay, peace! I promise my troops won't step on your final borders! 👍",
      "I accept with a big smile! Mutual safety is always the best way forward! 💛",
      "Of course, friend! I want everyone to have a good game. Truce accepted! 😊🌸",
      "I gladly spare your lands! Let us keep our borders peaceful and friendly! ✨",
      "Oh, please don't be sad! I gladly grant you mercy! Stay safe! 😊🌸",
      "I promise my little soldiers won't touch your final frontiers! ✨",
      "Yay, peace! Let us declaring ceasefire and look out for one another! 💛",
      "I accept with a warm smile! Sending happy thoughts to your campaign! 👍",
      "Of course, dear friend! Your remaining outposts are completely safe with us! 😊",
      "Mercy gladly granted! Let us enjoy some quiet time in our empires! ✨"
    ],
    goofball: [
      "All good bro, I'll give you a pass. Go rebuild your base haha! 😂",
      "Sure thing, I'll pause my campaign against you. Go grab some snacks! 😭",
      "Bet! Let's take a break and watch the rest of the map burn down, lmfao! 💀",
      "Truce signed! Play nice, at least until my fingers stop cramping haha!",
      "Lmao okay, ceasefire activated. Go buy a lottery ticket with this luck! 😂",
      "No cap, I'll cede the spotlight for a bit. Stay safe out there bro! 💀",
      "All good, pass granted! Go eat some real-life snacks and rebuild! 😂",
      "lmfao ceasefire active. Go buy a lottery ticket because you are super lucky! 💀",
      "No cap, I'll pause my advance. Sparing you so we can chill haha! 😭",
      "Truce locked in! Let's watch the others fight lmfao! 😂",
      "Lmao alright, ceasefire activated. Keep your little dudes safe bro! 💀",
      "GG to your capital, but I'll spare the rest. Go grab some digital pizza! haha! 😭"
    ],
    cynical: [
      "Fine. I'll grant you a temporary truce. Don't make me regret my compliance.",
      "I'll spare you for now, but only because the other factions are bigger annoyances.",
      "Accepted. Just try not to violate this ceasefire the second you get a card set.",
      "Very well. I will respect the line as long as you keep your hands to yourself.",
      "Fine, a ceasefire. Sparing you now means you'll probably distract the leader later.",
      "I will hold my fire. Try to use this time to build actual defenses for once.",
      "Fine, a temporary truce. Try not to stab me in the back tomorrow.",
      "Sparing you now is just a calculated delay. Rebuild while you can.",
      "Alright. Ceasefire confirmed. Sparing your front gives me bigger walls to conquer.",
      "I'll hold my fire. Sparing your outpost keeps a convenient buffer on my flank.",
      "Very well, truce accepted. Sparing you is slightly less annoying than fighting alone.",
      "Pact signed. Sparing your remnant keeps the board balance interesting."
    ],
    aggressive: [
      "Hahaha! Very well, I accept your plea. I will let you bleed a little longer while I crush the others!",
      "I will grant you mercy for now! Run and hide while I conquer real empires!",
      "Fine! Enjoy your temporary stay of execution! I have larger targets to incinerate!",
      "Agreed. Your weakness is no longer a threat. I will return for you once the rest are ashes!",
      "Ceasefire accepted. I'd rather spend my energy tearing down stronger walls first.",
      "I spare you today, weakling. Pray we do not cross paths on my next sweep!",
      "Hahaha! Ceasefire accepted! I will allow you to exist while I slaughter the others!",
      "Very well. Run and hide! Sparing you gives my legions real walls to crush!",
      "Fine! I spare your outposts today. Do not stand in my sight again!",
      "Truce signed! Sparing your front gives me bigger capitals to burn!",
      "Agreed. Sparing you is strictly temporary. Enjoy your final turns!",
      "Very well, ceasefire confirmed. Suffer in silence while my attention is elsewhere!"
    ]
  },
  MERCY_DECLINE: {
    normal: [
      "No. This campaign must reach its natural conclusion. No mercy.",
      "I cannot grant you a truce. This is a game of conquest.",
      "Decline. The board state is too advanced to spare any active players.",
      "No ceasefire. Sparing you now would only compromise my own long-term safety.",
      "I must refuse. Consolidating the board requires your immediate absorption.",
      "No deals. I cannot afford to leave hostile armies behind my advance.",
      "No. Sparing your outposts is a risk my high command cannot authorize.",
      "I decline. Our conflict must reach its standard end. No truces.",
      "Decline. Consolidating my sectors requires the immediate liquidation of yours.",
      "No. Ceasefire declined, @[sender]. Your frontiers are key to my victory.",
      "Refused. Sparing your remaining garrison represents a direct security threat.",
      "No ceasefire today. Let us finish our battle with honor."
    ],
    strategic: [
      "Negative. Eliminating your remaining assets is the most efficient course of action.",
      "Decline. Sparing your faction creates unnecessary security variables.",
      "Truce denied. Consolidating your sectors yields the highest victory probability.",
      "We cannot grant mercy. Eliminating all strategic threats remains our primary directive.",
      "Proposal rejected. Sparing your remnant introduces unneeded variance to our projections.",
      "Decline. Complete acquisition of your coordinates is necessary for phase optimization.",
      "Negative. Sparing your remaining assets is statistically inefficient for victory.",
      "Truce denied. Complete neutralization of your front reduces adjacent security risks.",
      "Decline. Sparing your remnant would compromise our defensive lines.",
      "Rejected. Our optimization paths indicate your immediate liquidation is optimal.",
      "Negative. complete acquisition of your coordinates is required for phase consolidation.",
      "Decline. Sparing your front is highly inefficient under our current safety indices."
    ],
    kind: [
      "I am so incredibly sorry! But my advisors insist I must take these sectors. 😢🌸",
      "Please forgive me! I must secure these lands, but I still think you're wonderful! 💛",
      "I wish I could help, but the game is too far along! Sending big warm thoughts! ✨",
      "A decline, unfortunately! Let's hope our final battle is honorable and fair. 😊",
      "It hurts my heart, but I must say no. I have to protect my own borders now. 😢",
      "Oh, I am so sorry! I cannot grant a truce. Let us play out our final rounds with honor! ✨",
      "Oh dear! I am so incredibly sorry! Sparing your outposts is too difficult now! 😢🌸",
      "Please forgive me! I must defend my home first, but sending warm wishes! ✨",
      "My heart breaks, but ceasefire is declined! Sparing you would make things too volatile! 💛",
      "Oh, I wish I could! Sparing your garrison is not possible under my advisors' plans! 👍",
      "A decline, unfortunately! Let us hope our final battle is quiet and honorable! 😊",
      "Please forgive our decline! I still think you are such a wonderful player! ✨"
    ],
    goofball: [
      "Sorry bro, but the leaderboard demands your sacrifice. RIP in advance! 💀",
      "No can do, my armies are on autopilot and they only know how to attack lmfao!",
      "Decline! I'm on a roll and I don't want to pause the party now haha! 😂",
      "Lmao nope! The victory screen is calling my name, no stops! 😭",
      "No cap, my dice are literally itching to roll. Truce declined bro! 💀",
      "Lmfao I gotta get that final knockout. Better luck next lobby! haha!",
      "Oof, decline! Sparing you would block my speedrun lmfao! 😂",
      "No cap, ceasefire rejected bro. Sparing you is not in my plans today! 💀",
      "Lmao sorry but my little dudes are on autopilot. RIP to your outposts! 😭",
      "Decline! Sparing your capital would ruin the victory party lmfao! 😂",
      "No shot bro, truce denied. Better luck in the next lobby! haha! 💀",
      "Lmfao nope! Sparing you is simply impossible right now, RIP in advance! 😂"
    ],
    cynical: [
      "Why would I spare you? So you can get a card set and backstab me? No way.",
      "Trusting your plea would be foolish. I prefer to finish my target now.",
      "No. You'd break the truce the second you recovered anyway. No mercy.",
      "Decline. Sparing you only gives you time to rebuild your broken defenses.",
      "I am not a charity. This is a battlefield, and your time is simply up.",
      "No. A cornered snake is still a snake. I will cut your borders down today.",
      "No. Sparing your front only gives you time to prepare a backstab.",
      "Decline. I don't sign ceasefires with players who are already on the ropes.",
      "I refuse. Sparing your outpost is a risk I don't need on my flank.",
      "Decline. Sparing you now would just make things tedious later.",
      "No mercy. A cornered competitor is still highly dangerous.",
      "Refused. Sparing your remaining sectors is complete foolishness."
    ],
    aggressive: [
      "Mercy is for the weak! I will trample your final garrisons into the dust!",
      "Your plea only fuels my hunger for conquest! Prepare for complete annihilation!",
      "No truces! I will take your final territories and erase you from this map!",
      "Absolutely not! Prepare to witness absolute, unmatched conquest!",
      "I don't make deals with prey! Your capital belongs under my iron heel!",
      "No mercy! I will butcher your remaining armies and leave nothing but ashes!",
      "No truces! I will trample your final outposts and erase your standard! 😡",
      "Mercy? Pathetic! I will slaughter your remnant garrison without hesitation!",
      "Absolutely not! Sparing your front is an insult to my vanguard!",
      "I reject your plea! My legions will march over your bones to victory!",
      "Refused! Sparing your base is complete nonsense! Prepare for annihilation!",
      "I will crush your final stand! Sparing you is complete foolishness!"
    ]
  },
  MERCY_ANNOYED: {
    normal: [
      "You have already begged for mercy, @[sender]. My patience has run out.",
      "No more truces. Stop spamming my diplomats.",
      "I already answered this. Stop begging and defend your borders.",
      "This is getting redundant. No ceasefire, prepare for battle.",
      "I cannot keep renegotiating. My answer remains a firm decline.",
      "Please stop sending these proposals. Our diplomatic channels are now closed.",
      "This repetitive plea is becoming highly redundant. Please stop.",
      "No further truces. Guard your frontiers instead of begging.",
      "I already declined, @[sender]. Stop spamming my high command.",
      "I refuse to keep renegotiating. The ceasefire remains dead.",
      "Please stop sending these. Sparing your base is not possible anymore.",
      "Our tethers are permanently closed. Sparing you is not on our agenda."
    ],
    strategic: [
      "Redundant pleas detected. Mercy protocols have been permanently deactivated.",
      "Your continuous begging is highly inefficient. Prepare for engagement.",
      "Error: Duplicate request path. De-escalation vectors are locked out.",
      "Command has permanently disabled negotiation tethers. No further truces.",
      "Request denied. Repetitive diplomatic signaling will not alter the probability matrix.",
      "Logistical models show zero utility in further communication. Combat sequence locked.",
      "Error: Redundant diplomatic signal detected. Ceasefire pathways are offline.",
      "Begging protocol deactivated. Your duplicate requests cannot be processed.",
      "Negative. Repetitive tethers are highly inefficient. Sparing you is impossible.",
      "Request denied. We cannot authorize further communications on this front.",
      "Logistical models show zero efficiency in duplicate ceasefires. De-escalation offline.",
      "Command has permanently de-activated de-escalation vectors. Prepare for combat."
    ],
    kind: [
      "Oh, please don't keep asking! It makes me feel too sad, but I must say no! 😢🌸",
      "I already spared you once! Please don't take advantage of my kindness. 💛",
      "Please don't spam me! I want to be nice, but we cannot sign another truce! ✨",
      "It hurts my heart, but I must ask you to stop begging! I cannot grant mercy again. 😊",
      "Oh dear! I must ask you to stop sending these. I have to say no, sorry! 😢",
      "I wish we could be peaceful, but please stop begging me! It's too much! 🌸",
      "Oh, please don't keep asking! It makes my little soldiers feel too sad! 😢🌸",
      "I already granted mercy once, please don't squeeze our friendly truce! ✨",
      "Please stop spamming, friend! I want us to stay comfortable but we cannot truce! 💛",
      "It hurts my heart, but please stop sending duplicate peace proposals! 👍",
      "I must ask you to stop begging, sorry! Sparing you is not possible today! 😊",
      "I wish we could find a friendly treaty, but please stop begging, friend! ✨"
    ],
    goofball: [
      "Bro, you are literally spamming the mercy button lmfao. Get ready! 💀",
      "No shot! One plea was enough, now you're just begging haha! 😂",
      "Lmao you are spamming my inbox with peace flags. Decline, no cap! 😭",
      "Haha stop begging bro! You already got your pass, now it's game over! 💀",
      "My notifications are literally blowing up, please stop lmfao! 😂",
      "Are you macroing this chat or what? Decline! Time to fight bro! 💀",
      "Bro, you are literally spamming the peace flag lmfao! Settle down! 😂",
      "No shot! Sparing you once was enough, now you're just button-mashing! 💀",
      "Lmao duplicate request! Sparing you is officially offline, no cap! 😭",
      "Haha stop begging bro! Go play some other game, we are rolling sixes! 😂",
      "Lmfao are you spamming my inbox? Sparing your base is completed lmfao! 💀",
      "RIP to my chat log bro, please stop begging! Sparing you is closed! haha! 😭"
    ],
    cynical: [
      "I knew you were suspicious. Stop begging, our truce is permanently over.",
      "Your repeated begging only proves how desperate and untrustworthy you are.",
      "No. I'm not listening to your pathetic whine anymore. Prepare to fight.",
      "A pathetic attempt to drag out the inevitable. No more ceasefires.",
      "You are trying to abuse our patience. I've seen this trick before. No.",
      "Your begging is exhausting. Prepare your defenses instead of typing.",
      "Sparing you once was a calculated risk. Begging twice is just pathetic.",
      "Your repetitive pleas only confirm how fragile your strategy is.",
      "No more ceasefires. Stop spamming my diplomats with your whine.",
      "I already declined, @[sender]. Sparing you is highly unprofitable.",
      "I reject this duplicate request. Fight like a real competitor.",
      "Another repetitive plea. Sparing your front is permanently offline."
    ],
    aggressive: [
      "Your pathetic begging only makes me want to crush you faster!",
      "No more mercy! I will erase your empire from history right now!",
      "I am sick of your continuous whining! I will eradicate you instantly!",
      "Silence, weakling! Your constant begging only fuels my wrath!",
      "I will rip your diplomat's tongue out if you send one more plea!",
      "Beg all you want! It only makes me more determined to slaughter your garrison!",
      "Silence! I am sick of your continuous begging, weakling! 😡",
      "No more ceasefires! I will incinerate your remaining outposts now!",
      "Your repeated begging only fuels my wrath! Prepare for slaughter!",
      "I do not negotiate with beggars! My legions are marching on your capital!",
      "Refused! Your repetitive pleas are pathetic! Face my full vanguard!",
      "I will slaughter your garrison! Sparing your base is permanently dead!"
    ]
  },
  MOVE_TROOPS_ACCEPT: {
    normal: [
      "Very well, @[sender]. I will withdraw my vanguard from [border_territory] on my next turn.",
      "Agreed. To prove my peaceful intent, I'll pull my troops back from [border_territory].",
      "I'll demilitarize [border_territory] to show my commitment to our pact.",
      "A reasonable request. I'll reposition my armies away from [border_territory] shortly.",
      "I accept. Shifting my border guard away to reduce the pressure.",
      "I will cede the immediate military presence in [border_territory] to maintain peace.",
      "Repositioning approved. I will withdraw my garrison from [border_territory] shortly.",
      "No need for friction. I'll back my regiments away on my next turn.",
      "My intentions remain cooperative. Shifting troops away from [border_territory].",
      "I understand your concern, @[sender]. Withdrawal will execute shortly.",
      "Tension de-escalated. Repositioning vanguard to adjacent sectors.",
      "I accept. I will demilitarize [border_territory] to reassure you."
    ],
    strategic: [
      "Logistical reallocation authorized. Shifting assets out of [border_territory] to adjacent sectors.",
      "Demilitarizing [border_territory] aligns with current boundary optimization strategies.",
      "Repositioning confirmed. Restructuring border posture to prevent high friction.",
      "Emergency withdraw command issued for [border_territory] to maintain treaty equilibrium.",
      "Asset relocation scheduled. [border_territory] garrison will be reduced on our next cycle.",
      "Repositioning approved. Lowering border density is mathematically optimal for security.",
      "Asset relocation confirmed. [border_territory] density reduced on our next cycle.",
      "Boundary demilitarization accepted. Shifting forward divisions to adjacent sectors.",
      "Repositioning scheduled. Reducing troop concentration to maintain treaty equilibrium.",
      "withdrawal authorized. Logistical arrays indicate optimal safety in de-escalation.",
      "Asset repositioning approved. Lowering threat index along this front.",
      "Logistical de-escalation confirmed. Commencing withdrawal sequences at [border_territory]."
    ],
    kind: [
      "Oh, of course! I didn't mean to crowd you at [border_territory], I'll move them back! 😊",
      "No problem at all, @[sender]! Shifting my sweet troops away from [border_territory] now! ✨",
      "I want you to feel totally safe! I will vacate [border_territory] on my next turn! 👍",
      "All done! Repositioning my friendly guard away from [border_territory] to keep us peaceful! 🌸",
      "My apologies! I will shift them away so we can be comfortable neighbors! 😊",
      "I promise my armies are moving back! No crowded borders here! ✨",
      "Oh, of course! I didn't mean to make you nervous! Moving them back now! 😊🌸",
      "No problem, friend! Shifting my sweet little armies away from [border_territory]! ✨",
      "I want us to stay best neighbors! Vacating [border_territory] on our next turn! 💛",
      "All done! Repositioning my friendly troops to keep things peaceful! 👍",
      "I apologize! Shifting my defensive guard away so you feel totally safe! 😊",
      "No worries! Moving my soldiers back immediately so we can have happy borders! ✨"
    ],
    goofball: [
      "My bad, bro! Shifting my little dudes back from [border_territory] now lmfao! 😂",
      "Sure thing, packing up the camper vans and vacating [border_territory] lol!",
      "No cap, I'll clear out of [border_territory]. Didn't realize I was hogging the space! 💀",
      "Peace out! Moving my armies away from [border_territory] so we can chill! 😭",
      "Haha all good, backing my squad out of [border_territory] right now! 😂",
      "Lmao backing up, wouldn't want the boys to make you nervous! 💀",
      "Lmao oops, didn't mean to crowd your lawn bro! Shifting them back now! 😂",
      "All good! Repositioning the squad out of [border_territory] lmfao! 💀",
      "No cap, backing the boys up. Sparing you the panic bro! haha! 😭",
      "Lmfao my bad, relocation activated. Pizza party is over in [border_territory]! 😂",
      "Truce vibes active! Shifting our little dudes out of the area lmfao! 💀",
      "All good! Moving our campsite back so we can all keep chilling lmfao! haha!"
    ],
    cynical: [
      "Fine. I will transfer my regiments out of [border_territory], since you're so paranoid.",
      "Repositioning from [border_territory] confirmed. Just make sure your own lines don't creep forward.",
      "Very well, I'll clear [border_territory]. I'm sure you'll find something else to complain about.",
      "Moving out. Don't mistake my willingness to de-escalate [border_territory] for softness.",
      "Fine, I will clear the sector. Just keep your hands to yourself.",
      "Repositioning. I expect a matching demilitarization from your adjacent fronts.",
      "Fine. Relocating forces out of [border_territory]. Sparing your paranoia.",
      "Repositioning confirmed. Just try not to push your own lines into the empty space.",
      "Very well, relocation active. I'm sure you'll find another border to worry about tomorrow.",
      "Moving out. Don't mistake this de-escalation for a lack of steel, @[sender].",
      "Fine, I will clear the sector. Sparing [border_territory] is convenient for now.",
      "Relocating. Just make sure your own vanguard stays on your side of the line."
    ],
    aggressive: [
      "Fine, @[sender]. I'll pull my vanguard out of [border_territory]... I have bigger fronts to crush.",
      "Very well. I will relocate my legion from [border_territory]. Keep your eyes off my new staging zone.",
      "I will vacate [border_territory] for now. Enjoy the empty space while my attention is elsewhere.",
      "Repositioning vanguard. I'll move away from [border_territory], but don't cross into my sight.",
      "I will back them off, but my vanguard remains highly mobile. Keep that in mind.",
      "Fine. Relocating forces. Try not to mistake this temporary move for weakness.",
      "Hmph! Relocating vanguard out of [border_territory]. Consider yourselves lucky.",
      "Very well, I'll shift my legions. Sparing your front gives me real walls to crush.",
      "I will withdraw, but my legions remain highly mobile. Keep that in mind, @[sender].",
      "Relocating vanguard. Enjoy the empty space before my legions decide to return.",
      "Fine. Shifting vanguard. Don't test my patience again, weakling.",
      "I will pull back my lines. Sparing [border_territory] is strictly temporary."
    ]
  },
  MOVE_TROOPS_DECLINE: {
    normal: [
      "No. My garrison stays in [border_territory]. I have borders to defend.",
      "My troops stay right where they are. If you are nervous, back your own armies up.",
      "I will not compromise my defenses in [border_territory] for your comfort.",
      "Decline. [border_territory] is a critical tactical hub. I'm keeping my troops there.",
      "No. I require a strong garrison at [border_territory] to secure my own territory.",
      "I must refuse. Relocating my defenses now is not strategically viable.",
      "No. [border_territory] is key to my perimeter defense. My standing armies stay.",
      "I will not withdraw. If you are nervous, back your own armies up.",
      "Decline. Garrison density at [border_territory] remains critical to my high command.",
      "No. I cannot afford to leave my borders un-defended under current variables.",
      "Refused. Relocating my defenses now is not tactically viable.",
      "My garrison remains active. Sparing [border_territory] is not on my current agenda."
    ],
    strategic: [
      "Negative. Maintaining current troop densities at [border_territory] is statistically required.",
      "Withdrawal request rejected. Securing [border_territory] preserves optimal boundary parameters.",
      "Repositioning from [border_territory] is inefficient under current defensive matrices.",
      "Decline. [border_territory] serves as a vital security buffer. Garrisons will remain active.",
      "Garrison withdrawal denied. Logistical metrics indicate maximum security value at this node.",
      "We cannot vacate. Your adjacent troop allocations represent a direct structural risk.",
      "Negative. Maintaining maximum troop density at [border_territory] is statistically required.",
      "Repositioning unauthorized. Node [border_territory] secures key logistical coordinates.",
      "Decline. Boundary demilitarization at this junction reduces our active security index.",
      "Withdrawal rejected. The threat profile of your adjacent sectors remains elevated.",
      "Negative. Shifting forces out of [border_territory] would compromise our defense grid.",
      "Decline. Operational matrices prioritize defense consolidation at [border_territory]."
    ],
    kind: [
      "I'm so sorry, @[sender], but my advisors say we really must keep our troops in [border_territory]. 🌸",
      "Oh dear, I must decline. I need those sweet soldiers there to keep my borders safe! 😢",
      "I wish I could help, but [border_territory] is just too dangerous to leave empty right now! 💛",
      "I have to say no, sorry! Sending warm thoughts, but my garrison must protect their homes. 😊",
      "Please forgive me, but my little soldiers need to stay there to guard our borders. 🌸",
      "I'm so sorry! I must keep my defenses at [border_territory] for my own peace of mind. 💛",
      "Oh, please don't be cross! I really need to keep our guard at [border_territory] safe! 😢🌸",
      "I am so sorry to decline! My poor troops need to stay there to guard our home! ✨",
      "Please forgive me, but [border_territory] is just too risky to leave empty today! 💛",
      "I wish I could, but I must keep our defense at [border_territory] for peace of mind! 👍",
      "A decline, sorry! Sending warm thoughts, but our little outpost must remain! 😊",
      "Please forgive our decline! I promise our intentions are completely friendly! ✨"
    ],
    goofball: [
      "Nah, my troops really love the local cuisine in [border_territory], we aren't leaving! 💀",
      "Decline! The boys are already set up in [border_territory] and they refuse to pack up lmfao!",
      "No can do, bro! [border_territory] is our favorite spot, too comfy to vacate haha! 😂",
      "Lmao nope! We built a fort in [border_territory] and the lease doesn't end this turn! 😭",
      "Declined! My troops are currently holding a virtual gaming tournament in [border_territory]! 😂",
      "No shot bro, [border_territory] is where the squad is hanging out. We stay! 💀",
      "Nah bro, no can do. The boys built a massive sandbox in [border_territory]! 😂",
      "Decline! Sparing [border_territory] sounds super boring, let's keep the fort lmfao! 💀",
      "No shot bro, my troops are currently holding a gaming tournament in [border_territory]! 😭",
      "Lmfao decline! The fort in [border_territory] has way too cool of a view to leave! 😂",
      "No cap, we are staying put. Sparing you the empty space bro! lmfao 💀",
      "lmao decline! The boys say the lease on [border_territory] doesn't end this turn! haha!"
    ],
    cynical: [
      "Decline. Why should I weaken [border_territory] just to make your invasion plans easier?",
      "No. I'm keeping my troops in [border_territory] because I don't trust you near my capital.",
      "I reject this. You'd move your own armies right in the second we cleared out anyway.",
      "My garrison stays. I prefer active security to your suspicious requests.",
      "No. Sparing [border_territory] would just invite a swift backstab from your side.",
      "I prefer holding my ground to trusting your highly suspicious protests.",
      "Decline. Handing over key border nodes is how kingdoms die. I am staying.",
      "I will keep my vanguard dug in. Sparing [border_territory] would be complete foolishness.",
      "No. I don't cede defensive positions just because you asked nicely.",
      "My garrison stays. Why should I make your eventual invasion plans easier?",
      "Rejected. I prefer active border security to your imaginary truces, @[sender].",
      "No ceasefire today. [border_territory] remains entrenched. Deal with it."
    ],
    aggressive: [
      "My legions stay in [border_territory]! If they make you nervous, prepare to fight them!",
      "Decline! I do not retreat on command. The vanguard remains in [border_territory]!",
      "You do not dictate my troop placements! [border_territory] belongs under my iron grip!",
      "No! I will defend my claim to [border_territory] with blood if you try to push!",
      "The garrison in [border_territory] is staying. If you don't like it, come make me move!",
      "I do not cede ground to cowards. My forces stay exactly where they are!",
      "No! My vanguard is entrenched at [border_territory], and we do not retreat!",
      "I keep my legions on high alert! If my presence scares you, buy some defenses!",
      "Absolutely not! [border_territory] is my launchpad, and it will remain heavily occupied!",
      "I do not yield ground to weaklings! Focus your warning elsewhere or die!",
      "Refused! My armies stay where I command, and they command [border_territory]!",
      "Never! Sparing [border_territory] is complete nonsense. Guard your gates!"
    ]
  },
  CLAIM_TERRITORY_ACCEPT: {
    normal: [
      "Agreed. I will leave [requested_territory] entirely to you. Do not cross into mine.",
      "Fine. [requested_territory] is yours. I will redirect my expansion elsewhere.",
      "A fair partition. I'll stay clear of [requested_territory] if you stay clear of [ai_territory].",
      "I accept. I will remove [requested_territory] from my conquest target list.",
      "I understand. I will respect your claim to [requested_territory] if you respect my borders.",
      "Claim accepted. I will divert my vanguard away from [requested_territory].",
      "Agreement confirmed. Bypassing [requested_territory] on my next expansion phase.",
      "Fine. Sparing [requested_territory] is acceptable if you respect [ai_territory].",
      "I agree. I will divert my forward advance to other frontiers.",
      "Claim accepted. Let us maintain this division of sectors, @[sender].",
      "Very well. I will remove [requested_territory] from my active target list.",
      "Truce active. I will bypass [requested_territory] on my next turn."
    ],
    strategic: [
      "Exclusivity parameters accepted. Bypassing [requested_territory] in our future projection models.",
      "Treaty approved. We will stay clear of [requested_territory] in exchange for security at [ai_territory].",
      "Partition confirmed. Demarcating [requested_territory] as your active zone of influence.",
      "Optimal compromise verified. We will divert our vanguard away from [requested_territory].",
      "Exclusivity verified. Bypassing [requested_territory] to maximize efficiency in secondary targets.",
      "Logistical demarcation accepted. Let us maintain this division of influence.",
      "boundary exclusivity parameters verified. Removing [requested_territory] from primary vectors.",
      "Pact approved. Shifting vanguard coordinates away from [requested_territory] on our next turn.",
      "Demarcation accepted. Your claim to [requested_territory] is confirmed under treaty indices.",
      "Sovereign compromise verified. Shifting tactical focus to secondary targets.",
      "Logistical partition locked. We will bypass [requested_territory] to prevent mutual friction.",
      "We accept. Excluding [requested_territory] from our operational matrix optimizes adjacent sectors."
    ],
    kind: [
      "Oh, of course! [requested_territory] is all yours! I hope it brings you success! 😊",
      "I gladly accept! Let's stay clear of [requested_territory] and keep things peaceful! ✨",
      "It's a promise! I'll leave [requested_territory] to your beautiful empire! 👍",
      "That sounds lovely! Stay clear of [ai_territory] and we will have a wonderful, quiet border! 🌸",
      "Of course, friend! I will make sure my troops stay away from [requested_territory]! 😊",
      "I gladly agree! Let us leave [requested_territory] to your kind empire! ✨",
      "Oh, how lovely! [requested_territory] is completely yours, friend! 😊🌸",
      "I gladly accept! My little soldiers promise to bypass [requested_territory]! ✨",
      "A sweet agreement! Let us stay clear of each other's home sectors! 💛",
      "Pact confirmed! Sending warm wishes to your new holdings in [requested_territory]! 👍",
      "Of course! I hope you have a beautiful and happy home in [requested_territory]! 😊",
      "I promise! Let us make [requested_territory] a quiet zone of peace! ✨"
    ],
    goofball: [
      "All yours, bro! [requested_territory] has terrible weather anyway lmfao! 😂",
      "Bet! I'll stay clear of [requested_territory]. Enjoy the free real estate haha!",
      "Deal! You take [requested_territory] and I'll keep [ai_territory], high-five! 💀",
      "Lmao ok, claiming expired. I will steer clear of [requested_territory] fr fr! 😭",
      "Haha okay! No touchy [requested_territory], I got it! Have fun building there! 😂",
      "Lmfao all yours! I'll go buy real estate somewhere else on the map! 💀",
      "Lmao all yours bro! [requested_territory] has terrible Wi-Fi anyway! 😂",
      "Bet! Sparing [requested_territory] is locked in, no cap! 💀",
      "No shot! I'll let you have [requested_territory] so we don't start any drama haha! 😭",
      "Deal confirmed! Go build a massive castle in [requested_territory] lmfao! 😂",
      "Lmao alright, claiming accepted. Sparing you the sector bro! 💀",
      "lmfao all yours! I'll go park my armies in some other cool coordinate! haha! 😭"
    ],
    cynical: [
      "Fine. [requested_territory] is yours. Just don't let your borders creep any closer.",
      "I'll stay clear of [requested_territory], but I expect you to respect my holdings in [ai_territory].",
      "Accepted. Let's see if you can actually hold [requested_territory] before someone takes it.",
      "Very well. I will bypass [requested_territory]. Try not to violate this agreement tomorrow.",
      "Fine, you take [requested_territory]. I'm sure you'll overextend yourself anyway.",
      "I'll leave it to you. Just make sure your 'exclusive' claim doesn't block my paths later.",
      "Fine. Bypassing [requested_territory]. Try to keep your hands to yourself.",
      "Claim accepted. Sparing [requested_territory] keeps our border convenient for now.",
      "Very well, I will clear the sector. Sparing [requested_territory] prevents a tedious confrontation.",
      "I cede my interest. Enjoy holding [requested_territory] before you inevitably overextend.",
      "Pact approved. Just try not to break our promise on your next turn.",
      "I'll bypass it. I have zero interest in fighting over [requested_territory] today."
    ],
    aggressive: [
      "Fine! [requested_territory] is yours... for now. Stay out of [ai_territory] or die!",
      "I accept. I will hunt on other fronts and leave [requested_territory] in your hands.",
      "Agreed. Do not cross my path in [ai_territory] and your claim to [requested_territory] stands.",
      "Very well. I will divert my vanguard. Enjoy your little slice of [requested_territory].",
      "Take [requested_territory], but cross into my zone and my legions will burn your capital!",
      "I cede [requested_territory] for now. I have bigger targets to annihilate anyway.",
      "Fine! Sparing [requested_territory] is strictly temporary. Don't cross into my sight!",
      "I accept. Sparing [requested_territory] gives my vanguard stronger walls to crush elsewhere.",
      "Agreed. Sparing [requested_territory] stands as long as you keep your hands off [ai_territory]!",
      "Very well. Relocating focus.Sparing you [requested_territory] for now.",
      "I cede interest. I will conquer [requested_territory] later if you prove weak!",
      "Fine! Take [requested_territory]! Sparing it is strictly convenient for my advance!"
    ]
  },
  CLAIM_TERRITORY_DECLINE: {
    normal: [
      "Absolutely not. [requested_territory] is key to my conquest of [continent_name]!",
      "No deal. I have already drafted plans to annex [requested_territory].",
      "I cannot yield [requested_territory]. It is a vital buffer zone for my capital.",
      "Decline. [requested_territory] belongs under my faction's administration.",
      "No. [requested_territory] is a critical sector for my long-term strategy.",
      "Refused. I am already preparing to occupy [requested_territory] on my next sweep.",
      "No. [requested_territory] is a vital buffer zone for my capital. The answer is no.",
      "I cannot accept. Sparing [requested_territory] is a risk I won't authorize.",
      "Decline. [requested_territory] belongs under my faction's immediate administration.",
      "No. I have already drafted deployment plans for [requested_territory].",
      "Refused. [requested_territory] is key to my current expansion phase.",
      "I decline. Let us fight for control of [requested_territory] on the board."
    ],
    strategic: [
      "Negative. Our logistical matrix requires the immediate annexation of [requested_territory].",
      "Decline. Bypassing [requested_territory] would compromise our defensive integrity in [continent_name].",
      "Claim rejected. Statistical models prioritize [requested_territory] as a high-value asset.",
      "We cannot yield [requested_territory]. It serves as a vital tactical junction for our command.",
      "Decline. Bypassing [requested_territory] represents a direct security deficit to our perimeter.",
      "Logistical models reject exclusivity here. [requested_territory] must remain open for target.",
      "Negative. [requested_territory] integration is mathematically required for perimeter integrity.",
      "Decline. Sparing [requested_territory] violates our current resource optimization guidelines.",
      "Claim rejected. Statistical projection models prioritize [requested_territory] as a core node.",
      "Negative. Bypassing [requested_territory] introduces an unacceptable defense deficit to our lines.",
      "Refused. Complete acquisition of [requested_territory] is required for phase consolidation.",
      "Logistical de-escalation denied. [requested_territory] remains a primary target coordinate."
    ],
    kind: [
      "I'm so incredibly sorry! But my advisors insist we must secure [requested_territory]. 😢",
      "Oh dear, I must decline. [requested_territory] is just too important for my home safety. 🌸",
      "Please don't ask for [requested_territory]! My soldiers are so happy there! 💛",
      "No claim today, sorry! I hope you can find other beautiful territories to conquer! 😊",
      "I am so sorry to say no, but my poor soldiers really need [requested_territory]! 😢",
      "Please forgive me, but I must decline. Sending warm wishes to your other borders! ✨",
      "Oh, please don't be cross! I really need to protect [requested_territory]! 😢🌸",
      "I am so sorry to decline! My poor troops worked so hard for [requested_territory]! ✨",
      "Please forgive our decline! Sparing [requested_territory] is too risky for our home! 💛",
      "I wish I could, but my advisors say we need [requested_territory] for safety! 👍",
      "A decline, sorry! Sending happy thoughts to your other fronts, friend! 😊",
      "Please forgive me! I must protect my base before I can cede [requested_territory]! ✨"
    ],
    goofball: [
      "No shot, bro! I've already bought real estate in [requested_territory], can't back out lmfao! 💀",
      "Decline! [requested_territory] looks way too juicy to give up haha!",
      "Lmao nope! My dice are already rolling towards [requested_territory], no stop button! 😂",
      "Pass! [requested_territory] belongs to the squad now, finders keepers! 😭",
      "Haha decline! I already promised my soldiers we'd vacation in [requested_territory]! 😂",
      "Lmfao no way, [requested_territory] is already painted in my mind. No deal bro! 💀",
      "No shot bro, claim denied! [requested_territory] is already my primary coordinate! 😂",
      "Decline! Sparing [requested_territory] is strictly impossible lmfao! 💀",
      "Lmao sorry but the squad is already heading to [requested_territory] haha! 😭",
      "No way! [requested_territory] has way too cool of a view to give up lmfao! 😂",
      "lmao decline! [requested_territory] is mine fr fr, finders keepers bro! 💀",
      "Lmfao nope! My dice are already targeted on [requested_territory], no stop button! haha! 😭"
    ],
    cynical: [
      "Absolutely not. If I give you [requested_territory], you'll just use it to launch an attack on me.",
      "Decline. Why would I hand over [requested_territory] when I can just conquer it myself?",
      "No. Your exclusive claims are meaningless to me. [requested_territory] is open for target.",
      "I reject this. I have zero interest in respecting your imaginary boundaries at [requested_territory].",
      "Decline. Handing over key sectors is how kingdoms die. I am staying.",
      "No. I don't sign away assets just because you asked nicely. Fight for it.",
      "Decline. Giving away [requested_territory] is a risk I don't need on my flank.",
      "No. Your claims of exclusivity are completely meaningless to my vanguard.",
      "I refuse. Sparing [requested_territory] only gives you a free staging zone against me.",
      "Decline. If you want [requested_territory], bring your armies and try to take it.",
      "Rejected. I don't sign away assets just to play nice, @[sender].",
      "No. Sparing [requested_territory] is not on my current tactical map."
    ],
    aggressive: [
      "No deals! [requested_territory] is mine, and I will conquer it with fire and steel!",
      "I reject your claim! I will march my vanguard directly through [requested_territory]!",
      "Never! I will fight you to the last drop of blood for control of [requested_territory]!",
      "Your claims are pathetic! [requested_territory] belongs to the strongest, and that is me!",
      "I will trample your claim! [requested_territory] belongs under my imperial standard!",
      "Decline! Prepare to meet my legions on the field of [requested_territory]!",
      "Never! Sparing [requested_territory] is complete nonsense. Suffer my vanguard! 😡",
      "I reject your claim! My legions do not require permission to occupy [requested_territory]!",
      "Nodeals! [requested_territory] is my core target, and I will take it with blood!",
      "I will crush your standard! Prepare to face my main advance in [requested_territory]!",
      "Refused! Your claims are weak, and my legions are hungry! Suffer!",
      "I do not yield ground! Sparing [requested_territory] is complete foolishness!"
    ]
  },
  DESPERATION: {
    normal: [
      "My forces are broken... Is there no commander willing to offer asylum?",
      "Our back is against the wall. We will fight for every single millimeter of this soil!",
      "We are fighting to our absolute last breath! Do not count us out yet!",
      "A desperate hour... We will make you bleed for every single inch of our land!",
      "My army is crumbling. Is there anyone willing to sign a mutual defense pact?",
      "We are surrounded. Our remaining regiments are preparing for their final stand.",
      "A desperate hour. We will make any advance on our borders highly expensive.",
      "Our garrisons are broken. Is there no faction willing to support a remnant?",
      "We are fighting to the absolute last man. Prepare yourself.",
      "My territory count is critical. I suggest a mutual truce to stabilize.",
      "We are down to our final defense grid. The end is near.",
      "Our back is against the wall. We will make you pay in blood for every territory."
    ],
    strategic: [
      "Garrisons are critically depleted. Initiating emergency defensive patterns. Logistical support requested.",
      "Our defensive network is collapsing. A mutual ceasefire is strategically necessary to survive.",
      "Friction levels have exceeded acceptable parameters. We require immediate external assistance.",
      "Structural integrity at critical threshold. We must negotiate a temporary truce to prevent elimination.",
      "Warning: Hostile presence represents a terminal threat. Recommending immediate coalition.",
      "Defensive assets depleted. Seeking diplomatic intervention to preserve remnant coordinates.",
      "Critical warning: Garrison density is below defensive thresholds. Sparing requested.",
      "System collapse imminent. De-escalation vectors required to prevent complete elimination.",
      "Our active lines are compromised. I propose a mutual ceasefire to preserve coordinates.",
      "Structural integrity at 15%. Recommending immediate boundary demilitarization.",
      "Tactical reserves depleted. seeking external logistical support to contain advance.",
      "Warning: Defense grids permanently compromised. Systemic risk of complete liquidation."
    ],
    kind: [
      "Oh dear, my poor little armies are almost gone... Is there anyone who can show me kindness? 🌸😢",
      "I don't want to be eliminated! Please, is there any commander willing to protect me? 💛",
      "Sending out a plea for peace! My home is crumbling, let's please stop fighting! ✨",
      "Oh please, can we declare a truce? I promise I'm not a threat to anyone! 😊",
      "Oh my, I am in a very scary spot... Please show some mercy to my sweet soldiers! 😢",
      "My little empire is fading away... Sending warm thoughts in hopes of a ceasefire! ✨",
      "Oh dear! My poor soldiers are almost gone! Please show some sweet mercy! 😢🌸",
      "I don't want my empire to fade! Is there anyone willing to be a kind protector? 💛",
      "My home is in complete ruins! Let us please stop fighting and be friendly! 😊",
      "Oh please, I beg of you! A ceasefire would make us so happy and safe! 👍",
      "sending happy wishes even though my garrison is crumbling! Sparing requested! 😊",
      "My sweet little kingdom is disappearing... Sending love in hopes of a truce! ✨"
    ],
    goofball: [
      "Bro, I am literally down to my last stand lmfao. Anyone want to buy a slightly used capital? Cheap! 😂",
      "Oof, my base is in complete shambles. Currently taking applications for a protective ally 💀😭",
      "Lmao RIP to my armies, they got absolutely reked. Please show mercy haha!",
      "My score is in the gutter, no cap. Can I get a temporary pass to go grab some snacks? 😭",
      "Lmfao my empire has officially left the chat. Anyone want to carry me? 😂",
      "RIP to my glorious reign, we are down to the absolute bare minimum lmfao! 💀",
      "Bro, my capital has left the lobby lmfao! Sparing highly requested! 😂",
      "Oof! My squad has been absolute-unit wiped. Need a pro carry bro! 💀",
      "No cap, my board state is tragic. Sparing me would be legendary haha! 😭",
      "Lmfao alright, taking applications for a protective alliance. Apply now! 😂",
      "My score is in the trash lmfao! Sparing me would be super cool of you! 💀",
      "lmao RIP to my legions, they got completely wrecked. Sparing active bro! 😭"
    ],
    cynical: [
      "I'm down to my final garrison. I suppose you will all begin circling like vultures now.",
      "Our back is against the wall. Go ahead, finish us off. I know you're all dying to do it.",
      "My defeat is imminent. I'm sure you are all highly amused by this betrayal of treaties.",
      "Our empire is crumbling. Enjoy your easy victories before you turn on each other.",
      "Well, the end is near. Go ahead and take the scrap. I know how greedy this lobby is.",
      "I am down to my last outpost. Savor the win, but remember that vultures fight over the bones.",
      "My final garrison is surrounded. Savor your easy victory, vultures.",
      "Go ahead, clean up my ruins. I know you've been waiting for this all game.",
      "Our borders are dead. Sparing us is probably too much to ask in this greedy lobby.",
      "Well, my campaign is over. Enjoy pretending to be friends for two more turns.",
      "I'm down to my last outpost. Squeeze what you can before the leader liquidates you.",
      "GG to my empire. Sparing us now would just delay your eventual betrayal anyway."
    ],
    aggressive: [
      "We will fight to our absolute last breath! I will make you bleed for every single inch of our land!",
      "My empire may crumble today, but we will drag your forces down to hell with us!",
      "No surrender! Even in defeat, my vanguard will slaughter your advancing lines!",
      "You will pay in blood for every territory you take from my dying empire!",
      "Our garrison is surrounded, but we will leave a mountain of your dead before we fall!",
      "Prepare for a bloodbath! I will fight to the end and take as many of you with me as I can!",
      "No surrender! We will leave your advance completely broken before we fall! 😡",
      "My capital is surrounded, but my legions will paint the map in your blood!",
      "You will pay dearly for every single territory you conquer from my ruins!",
      "I will fight to the last drops of blood! Your advance is a death sentence!",
      "Prepare for slaughter! Even in defeat, my vanguard cuts through everyone!",
      "My standard is broken, but we will leave a mountain of your dead in our wake!"
    ]
  },
  BETRAYAL_ATTACK: {
    normal: [
      "Nothing personal! Your flank was too vulnerable.",
      "Our treaty has officially expired. Your lands belong to my empire now.",
      "A tactical necessity. Your borders were too weak to ignore.",
      "Nothing personal. Strategic advancement dictates your immediate elimination.",
      "I had to take the opening. That is simply how the board state developed.",
      "The pact is over. Prepare to defend your remaining sectors.",
      "Nothing personal, @[recipient]. Sparing your frontier was a risk I couldn't keep.",
      "Our agreement is void. Let's settle this with standard combat.",
      "Nothing personal, but your capital was looking far too easy to conquer.",
      "I had to execute. Sparing your flank was compromising my expansion.",
      "The ceasefire is over. Let our armies decide the line now.",
      "Nothing personal! Sparing your front was just no longer viable."
    ],
    strategic: [
      "Logistical efficiency dictates the immediate acquisition of your un-defended sectors. Terminating pact.",
      "A calculated expansion. Sentimentality is a strategic liability in this coordinate.",
      "Pact deactivation authorized. Reallocating vanguards to absorb your high-value assets.",
      "Calculations confirmed your lines were highly vulnerable. Executing optimal acquisition sequence.",
      "The partnership has reached maximum utility. Commencing absorption protocols.",
      "Treaty dissolved. The strategic cost of maintaining non-aggression exceeds asset value.",
      "Asset relocation scheduled. Shifting vanguards to target your un-defended nodes.",
      "Logistical optimization parameters met. Terminating active non-aggression pact.",
      "Calculations confirmed your capital integrity was below safe margins. Initializing sweep.",
      "Operational boundary dissolved. Absorbing your sectors is mathematically optimal.",
      "Truce dissolved. The strategic value of your coordinates exceeds treaty utility.",
      "Asset acquisition authorized. Sparing your front is highly inefficient under our current models."
    ],
    kind: [
      "Oh, I feel so terrible about this! But my advisors insisted we must take this sector... 😢🌸",
      "Forgive me! It hurts my heart to break our promise, but my little empire needs these lands. 💛",
      "I am so, so sorry! Please don't hate me, the campaign made me do it! ✨",
      "Sending peaceful thoughts even though my troops had to march! I still think you're great! 😊",
      "Please forgive my soldiers! They got too excited and marched across the boundary! 😢",
      "I am so sorry for breaking our sweet promise, but I had to make a move for safety! 🌸",
      "Oh, I feel so incredibly bad! Please don't be cross with my little soldiers! 😢🌸",
      "Forgive me, dear friend! My advisors insisted we needed to take [border_territory]! ✨",
      "I am so sorry! Sparing your capital was just no longer possible, I promise! 💛",
      "Please don't hate us! Sending happy thoughts even though we must fight! 👍",
      "My poor soldiers got too excited and crossed the line! So sorry! 😊",
      "I feel so sad to break our sweet treaty, but our empire had to expand! ✨"
    ],
    goofball: [
      "Lmao surprise! Your shield was down and I simply had to do it 💀😂",
      "Oof, our treaty just expired bro! Time to see if your defenses are actually good haha!",
      "Surprise! Teammate privileges have been permanently revoked, lmfao! 😭",
      "Sorry bro, but your capital was looking way too juicy to ignore, no cap! 💀",
      "Lmfao I couldn't resist, the temptation was way too high! Sorry not sorry! 😂",
      "Treaty has left the lobby! Time to roll some massive dice haha! 💀",
      "Lmao surprise attack! Your borders were looking super delicious, no cap! 😂",
      "Oof! Teammate tethers have been permanently deleted, lmfao! 💀",
      "Lmao sorry but that capital coordinate was looking way too juicy haha! 😭",
      "Surprise attack active! Go eat some pizza and prepare for the storm lmfao! 😂",
      "Lmao rip to our truce bro, relocation sequence failed lmfao! 💀",
      "Treaty deleted! Let's see if those dice are as strong as your chat! haha! 😭"
    ],
    cynical: [
      "We both knew this truce was temporary. I just moved first.",
      "Save the drama. It was a mutual convenience that ceased to be convenient.",
      "Traces of trust are gone. Don't pretend you wouldn't have done the exact same thing.",
      "Our treaty is dead. Go find some other competitor to play friendship simulator with.",
      "Arrogance is relying on a treaty in this lobby. Flank secured.",
      "You left a key sector unguarded. You shouldn't have trusted me.",
      "Our ceasefire has expired. Sparing your front was just a calculated delay.",
      "I'm keeping my hand on my sword. Friendship is very expensive here.",
      "We both knew our 'peace' was just a pause before the backstab. GG.",
      "You left your capital coordinate wide open. Highly predictable result.",
      "Truce voided. I don't apologize for standard strategic advancement.",
      "The treaty is dead. Go complain to someone who actually cares."
    ],
    aggressive: [
      "Pacts are temporary chains! You were weak, and I am here to conquer your empire!",
      "Your capital is mine! I will march over your broken treaties and bones!",
      "I don't care about your little alliances! My legions will trample you both!",
      "A glorious backstab! I will paint the map in your color, then wipe it clean!",
      "Our truce is shattered! Prepare for complete and absolute slaughter!",
      "No more hiding behind papers! I am coming to crush your remaining gates!",
      "Traitor? No, I am a conqueror! Suffer the full fury of my legions, @[recipient]!",
      "The ceasefire is shredded! Prepare to witness absolute, unmatched slaughter!",
      "Your repeated weakness invited my strike! Suffer my main advance!",
      "No peace! I will conquer your frontiers and burn your standard to ashes!",
      "I will trample your standard and execute every last commander! Suffer!",
      "Your borders belong strictly under my iron grip! Suffer my vanguard!"
    ]
  },
  MOVE_TROOPS_FAIL_NO_TROOPS: {
    normal: [
      "I don't have any regiments stationed in [border_territory], @[sender]. Are you seeing ghosts?",
      "My scout reports show we have zero troops in [border_territory]. Why are you asking me to withdraw?",
      "There is no garrison of mine in [border_territory], @[sender]. Check your tactical map.",
      "I have zero regiments stationed in [border_territory]. Check your tactical data.",
      "I don't occupy [border_territory], @[sender]. You are protesting an empty sector.",
      "Please check your coordinates. I have no military presence at that node.",
      "There is no garrison of mine in [border_territory]. Check your data logs.",
      "I hold zero standing armies at [border_territory]. What are you protesting?",
      "My scout reports show zero troop density at that coordinate, @[sender].",
      "I cannot relocate forces that don't exist. Check your tactical layout.",
      "Your warning is logically invalid. [border_territory] is completely empty of my units.",
      "Check your map coordinates again, @[sender]. I have no units there."
    ],
    strategic: [
      "Incorrect parameter. Database confirms zero military assets deployed in [border_territory].",
      "Request logically invalid. No standing forces occupy [border_territory] under our command.",
      "Error: [border_territory] contains zero of our tactical assets. Check your targeting coordinates.",
      "Logistical verification shows zero troop presence in [border_territory]. Withdrawal is impossible.",
      "Query failed. Node [border_territory] does not register any active garrisons.",
      "Invalid coordinate protest. Zero units are currently assigned to [border_territory].",
      "Error: Asset query at [border_territory] returned zero active units under our command.",
      "Withdrawal request invalid. Node coordinates do not contain active garrisons.",
      "Strategic check confirms zero unit density at [border_territory]. Relocation cancelled.",
      "Verification failed. Target node is registered as neutral or empty under our matrix.",
      "Protest rejected. We do not hold sovereign administrative presence in [border_territory].",
      "Logical error: Proposed withdrawal coordinates contain zero active divisions."
    ],
    kind: [
      "Oh dear, I don't think I have any little soldiers in [border_territory], @[sender]! 😊",
      "I checked, but my rooms in [border_territory] are empty! Let's double check our map. 🌸",
      "I promise my troops aren't crowding [border_territory]! I don't own any garrisons there! ✨",
      "I'd love to help, but I have no armies to withdraw from [border_territory]! Sorry! 💛",
      "Oh, I think there is a little mixup! My soldiers are not in [border_territory]! 😊",
      "I checked my records and we don't have anyone stationed there! Sending warm thoughts! 🌸",
      "Oh, I think there is a sweet little mixup! [border_territory] is empty! 😊🌸",
      "I checked my maps, but my rooms in [border_territory] have no soldiers inside! ✨",
      "I promise my troops aren't crowding your space, friend! Sparing [border_territory] is easy! 💛",
      "I'd love to move them, but I have no little dudes at that coordinate! 👍",
      "Our records show zero garrisons in [border_territory]! Sending happy thoughts! 😊",
      "No little soldiers are there, sorry! I hope you can find your way around! ✨"
    ],
    goofball: [
      "Bro, you are literally hallucinating. I have zero dudes in [border_territory] lmfao! 💀",
      "Lmao check your glasses, my armies are nowhere near [border_territory] haha!",
      "No shot! I don't have any troops in [border_territory]. Are we fighting ghosts today? 😂",
      "Lmfao my bad if I scared you, but my garrison at [border_territory] is literally imaginary! 😭",
      "Wait, am I laggy or do I actually have zero dudes in [border_territory]? lmfao",
      "Lmao check the map again bro, we are completely empty in that sector! 💀",
      "Bro, you are seeing virtual ghosts lmfao! [border_territory] is completely empty! 😂",
      "Lmao check your connection, my troops are miles away from that coordinate! 💀",
      "No shot bro, I don't hold any lands at [border_territory] haha! 😭",
      "Wait, are those my units or is that just some colored dust on your screen? lmfao 😂",
      "lmao decline! I can't move what isn't there bro, check your logs! 💀",
      "RIP to your scouts bro, they are reporting imaginary garrisons lmfao! 😭"
    ],
    cynical: [
      "You are making things up to justify your border pressure. I don't own [border_territory].",
      "I have zero troops in [border_territory]. Find some other excuse to complain about me.",
      "Check your map logs. [border_territory] is completely empty of my forces.",
      "A suspicious request. There is nothing to withdraw from [border_territory] anyway.",
      "Are you inventing threats to cover your own expansion plans? [border_territory] is empty.",
      "I don't hold [border_territory]. Stop trying to manufacture drama for the lobby.",
      "You are inventing imaginary garrisons to justify your build-up at [border_territory].",
      "Slander rejected. Sparing [border_territory] is easy since I don't even own it.",
      "I don't hold that coordinate. Stop trying to find excuses to threaten my borders.",
      "A highly suspicious protest. There is zero troop presence of mine at that node.",
      "My lines don't touch [border_territory]. Find someone else to complain to.",
      "Your complaints are meaningless. Node [border_territory] is completely empty of my units."
    ],
    aggressive: [
      "I have no forces in [border_territory]! If I did, you would already be dead!",
      "Stop wasting my time! My legions are not even present in [border_territory]!",
      "There are no armies of mine to vacate from [border_territory]! Check your scouts!",
      "I do not occupy [border_territory]! Focus your pathetic warnings elsewhere!",
      "You accuse me of amassing forces in an empty sector? Coward! Fight me!",
      "I have zero soldiers in [border_territory]. If you want a real garrison there, I can send one!",
      "Silence! I do not hold [border_territory], but keep testing me and I will send legions! 😡",
      "Stop crying about empty nodes! Focus on real battles instead of ghosts!",
      "I have zero presence at that coordinate! Stop wasting my diplomats' time!",
      "I do not occupy [border_territory]! Your warnings are complete nonsense!",
      "accuse me of amassing forces in empty space? Pathetic coward! Fight me!",
      "My vanguard is nowhere near [border_territory]! Your warnings mean nothing!"
    ]
  },
  CLAIM_TERRITORY_FAIL_SENDER_OWNS: {
    normal: [
      "You already hold [requested_territory], @[sender]. There is nothing for me to cede.",
      "Why are you asking me to yield [requested_territory]? Your own banners fly over it.",
      "Look at your map, @[sender]. [requested_territory] is already under your administration.",
      "You already occupy [requested_territory]. There is nothing for me to cede.",
      "Check your borders, @[sender]. [requested_territory] is already in your possession.",
      "That territory is already yours. I cannot cede what is not mine to give.",
      "You already occupy [requested_territory], @[sender]. No need to ask me to yield it.",
      "Why ask for exclusivity over a territory your own standard already controls?",
      "That node is already under your administration, @[sender].",
      "Your banners fly over [requested_territory]. Sparing it is redundant.",
      "I cannot cede what you already possess. Check your frontier borders.",
      "You already have sovereign control of [requested_territory]. Sparing is complete."
    ],
    strategic: [
      "Invalid claim parameters. [requested_territory] is already registered under your ownership.",
      "Logically redundant. Your own forces currently occupy [requested_territory].",
      "Verification failed. Our database confirms you already hold [requested_territory].",
      "We cannot yield [requested_territory] because you already possess sovereign control.",
      "Redundant query. Node [requested_territory] ownership is registered to sender.",
      "Database confirms your banner is active at [requested_territory]. Ceding sequence aborted.",
      "Error: Redundant claim parameter. Node [requested_territory] is verified under your control.",
      "Verification confirmed. [requested_territory] remains under sender's active ownership.",
      "Ceding sequence invalid. Node coordinates are already registered under your perimeter.",
      "Query logically invalid. You cannot request demilitarization of your own holdings.",
      "Exclusivity verified. Sender already possesses sovereign control of [requested_territory].",
      "Redundant query. Your standard is currently active at node [requested_territory]."
    ],
    kind: [
      "Oh sweet friend, you already own [requested_territory]! It's already yours! 😊",
      "Your beautiful banners are already flying over [requested_territory], @[sender]! 🌸",
      "No need to worry, you already occupy [requested_territory]! Stay safe! ✨",
      "I cannot grant you [requested_territory] because you already have it! Sending love! 💛",
      "Oh, look! [requested_territory] is already painted in your color, friend! 😊",
      "You already have control of [requested_territory]! I hope it brings your empire success! ✨",
      "Oh sweet neighbor, you already hold [requested_territory]! It's already yours! 😊🌸",
      "Your beautiful standard is already active over [requested_territory]! ✨",
      "No need to ask, dear friend! [requested_territory] is already safe in your hands! 💛",
      "I cannot cede [requested_territory] because your little soldiers are already there! 👍",
      "Look at the map, friend! [requested_territory] is already painted in your beautiful color! 😊",
      "You already occupy that territory! Sending warm wishes to your home garrison! ✨"
    ],
    goofball: [
      "Did you forget where you parked your armies? You already own [requested_territory]! 😂",
      "Bro, look at the map lmfao, [requested_territory] is currently your color fr fr! 💀",
      "No cap, you already have [requested_territory]! It's already in your pocket haha!",
      "Lmao are you trying to buy the same land twice? You already hold [requested_territory]! 😭",
      "Lmfao did you lag? [requested_territory] is literally your territory already! 😂",
      "No shot, check the map bro! [requested_territory] is already your home base! 💀",
      "Lmao did you lose your map keys? You already own [requested_territory] bro! 😂",
      "Bro, your own color is all over [requested_territory] lmfao! Sparing is active! 💀",
      "No cap, you already hold [requested_territory]! No need to ask me lmfao! 😭",
      "Lmfao are you trying to claim your own backyard? That is super funny bro! 😂",
      "Lmao alright, claiming is complete because you literally already have it! 💀",
      "lmao check the scoreboard bro! [requested_territory] has been yours all game! haha! 😭"
    ],
    cynical: [
      "You already hold [requested_territory]. Stop trying to play diplomatic mind games.",
      "Look at your own borders. [requested_territory] is already yours, don't pretend otherwise.",
      "Your claim is redundant. Your armies are already dug in at [requested_territory].",
      "A pointless request. You already have [requested_territory]. Focus on real targets.",
      "You are demanding exclusive claims over land you already conquered. Ridiculous.",
      "Check the board. You are complaining about a sector that is already in your pocket.",
      "You hold [requested_territory] already. Stop trying to manufacture cheap tethers.",
      "Sparing is redundant. Your own vanguard controls [requested_territory] under standard logs.",
      "Why ask me to yield what you already conquered? Save the cheap tricks.",
      "Redundant request. Your armies are already dug in at that coordinate.",
      "I cannot cede your own lands. Stop trying to look cooperative.",
      "A pointless proposal. Sparing [requested_territory] is already complete under your control."
    ],
    aggressive: [
      "You already occupy [requested_territory]! If you want more, come and take it!",
      "Your banners already fly over [requested_territory]! Stop wasting my time!",
      "I cannot yield what you already possess! Fight for real ground!",
      "You hold [requested_territory] already! My vanguard will meet you on other fields!",
      "You are asking me to cede your own lands? Coward, focus on the real battle!",
      "Stop playing ridiculous games. [requested_territory] is already yours. Fight me elsewhere!",
      "You already occupy [requested_territory]! If you want more land, come face my vanguard! 😡",
      "Your standard already controls that coordinate! Stop wasting my high command's time!",
      "I cannot yield what your own armies already occupy! Fight for real territory!",
      "Your vanguard holds that coordinate! My legions will meet you on other fronts!",
      "Coward! You hold [requested_territory] already! Stop playing ridiculous games!",
      "Claim denied! Sparing [requested_territory] is redundant because you already have it!"
    ]
  },
  CLAIM_TERRITORY_FAIL_AI_OWNS: {
    normal: [
      "I already hold [requested_territory], @[sender]. I am not going to just hand it over to you.",
      "Yield [requested_territory]? We shed blood to occupy that sector. The answer is no.",
      "My forces are firmly dug into [requested_territory]. I will not abandon our positions.",
      "I already own [requested_territory]. If you want it, you'll have to pay rent in troop casualties.",
      "Declined. [requested_territory] is a core part of my current empire's layout.",
      "I will not yield [requested_territory]. It belongs strictly under my administration.",
      "No. I hold [requested_territory] firmly. I will not hand it over to your empire.",
      "Yielding is not possible. Sparing [requested_territory] would compromise my layout.",
      "I already own that sector. If you want it, bring your armies and fight.",
      "Decline. [requested_territory] is firmly integrated into my perimeter, @[sender].",
      "I cannot accept. Sparing [requested_territory] is complete foolishness under current rules.",
      "My armies are dug in. I will not cede [requested_territory] under any circumstance."
    ],
    strategic: [
      "Negative. [requested_territory] is verified under our active sovereign administration.",
      "We cannot yield [requested_territory]. It represents a core node in our logistical network.",
      "Claim rejected. Our garrisons are firmly entrenched inside [requested_territory].",
      "Bypassing [requested_territory] is impossible. It is firmly integrated into our defense grid.",
      "Sovereignty verified. [requested_territory] remains a high-value asset under our control.",
      "Decline. Yielding [requested_territory] introduces an unacceptable structural deficit to our lines.",
      "Negative. [requested_territory] remains firmly under our active sovereign administration.",
      "Decline. Sparing [requested_territory] is highly inefficient under our current logistical matrix.",
      "Claim rejected. Our defensive grids are fully active at coordinate [requested_territory].",
      "Negative. Sparing [requested_territory] would compromise our active defense grid.",
      "Sovereignty confirmed. We will not authorize the de-escalation of [requested_territory].",
      "Decline. Sparing [requested_territory] is mathematically invalid for our long-term projection."
    ],
    kind: [
      "I'm so sorry, @[sender], but I already have my little home set up in [requested_territory]. 😊",
      "Oh dear, I must decline. My friendly troops have worked so hard to protect [requested_territory]! 🌸",
      "I wish I could share, but [requested_territory] is already my territory! Stay clear, please! ✨",
      "Please don't ask for [requested_territory]! My soldiers are so happy there! 💛",
      "Oh, I am so sorry! I already own [requested_territory] and my troops are settled in! 😊",
      "I have to say no, sorry! My little empire needs to protect [requested_territory]! 🌸",
      "I'm so sorry, dear neighbor! I already have my sweet home in [requested_territory]! 😊🌸",
      "I must decline, sorry! Sparing [requested_territory] is too difficult for my garrison! ✨",
      "I wish I could share, but [requested_territory] is already under my protection, friend! 💛",
      "Please don't ask, sorry! My little soldiers are so happy guarding [requested_territory]! 👍",
      "Oh, I apologize! [requested_territory] is already painted in my beautiful color! 😊",
      "A decline, unfortunately! sending warm wishes but my garrison must remain! ✨"
    ],
    goofball: [
      "Lmao no shot! [requested_territory] is my exclusive gaming zone, finders keepers! 💀",
      "Bro, I already claimed [requested_territory] fr fr! My armies are set up there! 😂",
      "Lmfao nope! I've already bought the real estate in [requested_territory] haha!",
      "Sorry bro, but [requested_territory] is already painted my color! Get your own spot! 😭",
      "Lmao decline! [requested_territory] is my absolute favorite sector right now! 😂",
      "No shot bro, my name is literally written on [requested_territory] lmfao! 💀",
      "Lmao no shot bro! [requested_territory] is my exclusive camping ground lmfao! 😂",
      "Decline! Sparing [requested_territory] is impossible since I already own it fr fr! 💀",
      "Lmfao nope! My soldiers are already settled in [requested_territory] haha! 😭",
      "Lmao sorry bro, but [requested_territory] is already in my pocket. Finders keepers! 😂",
      "Decline! Sparing [requested_territory] would ruin my expansion goals lmfao! 💀",
      "lmao decline! [requested_territory] has been painted my color, find another spot! 😂"
    ],
    cynical: [
      "I already hold [requested_territory]. I'm not giving it up because you asked nicely.",
      "Decline. We shed blood for [requested_territory], and we will shed more to defend it.",
      "Your claim is an insult. [requested_territory] belongs entirely under my administration.",
      "No. I am not abandoning my positions in [requested_territory] under any circumstance.",
      "I already own that sector. I prefer active defense to giving away my hard-earned lands.",
      "Decline. If you want [requested_territory], bring your armies and try to take it.",
      "No. I already hold [requested_territory]. Sparing it is complete foolishness.",
      "Decline. I prefer holding my ground to trusting your suspicious requests.",
      "Refused. Sparing [requested_territory] is an insult to my standing garrison.",
      "I already own that sector. Don't think you can play diplomatic tricks here.",
      "No. I will not cede [requested_territory] under any condition. Fight for it.",
      "Decline. Sparing [requested_territory] has zero value on my tactical map."
    ],
    aggressive: [
      "I already own [requested_territory]! If you touch it, my vanguard will tear you apart!",
      "Never! [requested_territory] is mine, and I will slaughter anyone who attempts to take it!",
      "My legions are dug into [requested_territory]! Come and try to push them if you dare!",
      "Decline! [requested_territory] belongs to my empire! Defend yourself if you cross the line!",
      "I hold [requested_territory] with blood and steel! Keep your weak hands off my borders!",
      "Your claim is a joke! My legions are entrenched in [requested_territory], challenge them!",
      "Never! [requested_territory] is under my standard! Touch it and you die! 😡",
      "I already own [requested_territory]! I will butcher your garrison if you cross my line!",
      "No deals! My legions are dug into [requested_territory] with blood and steel!",
      "Decline! Sparing [requested_territory] is strictly an insult to my high command!",
      "I refuse! Sparing my core territory is complete nonsense! Prepare for war!",
      "Claim denied! [requested_territory] is mine, and I will defend it to the last man!"
    ]
  },
  PACT_FAIL_ALREADY_EXISTS: {
    normal: [
      "We already have a diplomatic pact active, @[sender]. Focus on our targets.",
      "Why propose what is already signed? Our treaty is currently active.",
      "Our borders are already protected under our current agreement, @[sender].",
      "Our shared borders are already protected under our active agreement. Focus on other fronts.",
      "We are already at peace under our active pact. No need to renegotiate.",
      "Our current treaty is fully functional. Please select other tactical options.",
      "Truce verified, @[sender]. Our active pact already protects our border.",
      "Why propose a duplicate treaty? Our agreement is currently operational.",
      "Our shared borders are already safe under our active non-aggression pact.",
      "Agreement verified. Sparing our fronts is already locked in.",
      "Pact remains active. Maintain focus on external frontlines, @[sender].",
      "Duplicate proposal declined. Our ceasefire stands fully functional."
    ],
    strategic: [
      "Redundant proposal. Active non-aggression protocols are currently operational.",
      "Treaty is already verified in our database. Re-negotiation is mathematically unnecessary.",
      "Our lines are already protected by our current pact. Maintain focus on active vectors.",
      "Ceasefire is fully active. Do not distract our command staff with redundant proposals.",
      "Active treaty parameters verified. This duplicate request does not alter current non-aggression matrices.",
      "Pact remains fully functional. Commencing normal coordination operations.",
      "Error: Redundant proposal. Active non-aggression matrices are currently operational.",
      "Database logs confirm an active treaty with your faction. Re-negotiation is obsolete.",
      "Pact verified. Sparing our shared sectors is already locked in under active files.",
      "Duplicate treaty parameters rejected. Maintain focus on primary victory pathing.",
      "Our agreement stands. This duplicate request does not adjust our non-aggression indices.",
      "Pact locked. Ceasefire remains fully operational across our boundary nodes."
    ],
    kind: [
      "Oh, we are already beautiful allies, @[sender]! Our pact is currently active! 😊",
      "No need to worry, friend! We already have a sweet treaty keeping us safe! 🌸",
      "I always keep our promises! Our pact is already perfectly active! ✨",
      "Our friendship is already signed and sealed! Let's keep our borders peaceful! 💛",
      "We are already great partners, @[sender]! Let's protect each other's flowers! 😊",
      "Oh, no need to propose! Our active alliance is already keeping us safe! ✨",
      "Oh, sweet neighbor, we already have a lovely pact keeping us safe! 😊🌸",
      "No need to worry! Our active agreement is already perfectly operational! ✨",
      "My little soldiers always remember our promises! Our truce is active! 💛",
      "Our partnership is already sealed! Let's stay best neighbors happily! 👍",
      "We are already aligned, @[sender]! Let's protect each other's homes! 😊",
      "Our sweet ceasefire stands fully active! Sending warm thoughts to your front! ✨"
    ],
    goofball: [
      "Bro, we are literally already teammates lmfao. Check your spam folder! 💀",
      "Lmao did you forget we already signed a treaty? No need to send another fr fr! 😂",
      "Truce is already active bro! We are officially in the safe zone together haha!",
      "Lmfao we already have a pact active, do you want me to sign it twice? 😭",
      "Lmao duplicate pact request! We are already besties on the map bro! 😂",
      "No cap, our alliance is already locked in! Go spend those armies elsewhere! 💀",
      "Lmao are you laggy bro? We are already in the alliance club haha! 😂",
      "duplicate request lmfao! Sparing our shared borders is already checked! 💀",
      "Truce is already active bro! Go eat some pizza while our pact chills lmfao! 😭",
      "Lmfao did you forget our treaty lmfao? Sparing is active fr fr! 😂",
      "No cap, we are already teammates bro! Go support some other frontend lmfao! 💀",
      "lmao check the log! Sparing is active, no need to sign it twice! haha! 😭"
    ],
    cynical: [
      "We already have a treaty. Stop trying to look cooperative by spamming redundant proposals.",
      "Our pact is currently active. I'm keeping my end, try to keep yours.",
      "I already signed the ceasefire. Don't pretend you forgot our active agreement.",
      "Redundant proposal. We are already at peace, at least for this turn.",
      "A pointless proposal. Our current truce remains active. Focus on holding your own line.",
      "I already agreed to not attack you. Stop spamming my diplomats with duplicates.",
      "We already have a truce. Sparing our fronts is complete under standard agreement.",
      "Why propose a duplicate treaty? Sparing you is already active under active files.",
      "I already signed the papers. Sparing your front doesn't require duplicate tethers.",
      "Redundant request. I'm keeping my end of the ceasefire, try to keep yours.",
      "I reject this duplicate. Sparing your front is already locked in for this turn.",
      "Your duplicate proposals are boring. Focus on defending your own perimeter."
    ],
    aggressive: [
      "We already have a pact! Focus your wrath on our common enemies!",
      "Our truce stands! Do not distract me from my conquests with redundant papers!",
      "I have already agreed to a ceasefire! Don't make me regret my temporary peace!",
      "We are already allied! Go find some else to negotiate with!",
      "I've signed the pact. Stop sending duplicate papers and go march on our targets!",
      "Our non-aggression is active! Keep your vanguard focused on the real enemies!",
      "We have a treaty active! Sparing your front is complete under my high command! 😡",
      "Duplicate proposal denied! Go march your vanguard on our common enemies!",
      "My ceasefire stands! Do not distract me from my active advances, weakling!",
      "I have already agreed to peace! Keep your armies back or I shred the treaty!",
      "Accusation invalid! Sparing your front is already verified under active logs!",
      "Truce finalized! Keep your legions focused on external frontiers!"
    ]
  },
  ALLIANCE_FAIL_TARGET_SENDER: {
    normal: [
      "You want me to ally with you... against yourself, @[sender]? Are you out of your mind?",
      "Forming an alliance against yourself? Perhaps you should re-evaluate your strategy.",
      "I am not going to help you attack your own territories, @[sender]. That is absurd.",
      "Forming a joint alliance to attack yourself is highly illogical. I decline.",
      "I must decline. Coordinating an attack on your own sectors makes zero tactical sense.",
      "This proposal asks me to target your own coordinates. I cannot participate in self-defeat.",
      "Are you out of your mind, @[sender]? Asking me to coordinate an alliance against yourself?",
      "I cannot accept. Sparing you from self-destruction is complete foolishness.",
      "You want a joint advance targeting your own home, @[sender]? Redundant.",
      "I refuse. Sparing your own capital coordinate is strictly your own responsibility.",
      "I cannot sign. Let us focus on real strategic targets rather than your own base.",
      "Proposal rejected. Sparing your capital is redundant because you are the initiator."
    ],
    strategic: [
      "Request logically invalid. Proposed target matches sender identity parameter.",
      "Mathematical error. We cannot coordinate an alliance against our own treaty partner.",
      "Coordinating an offensive against yourself is structurally impossible. Proposal rejected.",
      "Invalid target selection. The proposed vector targets your own active territories.",
      "Query rejected. Target profile matches the initiator's own logistical nodes.",
      "Logical inconsistency detected. We cannot authorize a joint offensive against the proposer's own front.",
      "Error: Target parameters match sender identity. Sparing sequence aborted.",
      "Logistical error: Proposed alliance coordinates match active nodes under your control.",
      "We cannot authorize a coalition targeting the initiator's own defense grid.",
      "Logical inconsistency verified. Sparing your base is mathematically redundant.",
      "Exclusivity rejected. Target matches active coordinates registered to sender.",
      "Query structurally invalid. Sparing your own capital node is your own responsibility."
    ],
    kind: [
      "Oh dear! You want me to ally against yourself, @[sender]? That makes me so confused! 🌸",
      "I can't ally with you to fight you! That sounds so sad, let's keep the peace! 😊",
      "Are you alright? I'm not going to attack my own sweet allies! 💛",
      "I must decline! Teaming up to fight you would hurt my heart! ✨",
      "Oh my! I cannot sign an alliance targeting your own lovely territories! 😢🌸",
      "Let's not plan attacks on your own home! I want you to stay safe! 💛",
      "Oh dear! You want us to coordinate against yourself? I'm so confused! 😊🌸",
      "I cannot accepts, sorry! Sparing your sweet home is very important to me! ✨",
      "Oh please, let us stay friendly neighbors! I would never dream of attacking you! 💛",
      "I wish I could, but sparing your capital is already your own sweet duty! 👍",
      "A decline, sorry! Let us focus on keeping our shared borders happy! 😊",
      "Please stay safe, @[sender]! Sparing your home is our primary wish! ✨"
    ],
    goofball: [
      "Wait, you want us to jump you? Bro, are you actually out of your mind lmfao? 💀",
      "Lmfao are you trying to self-sabotage? I am definitely not allying against you! 😂",
      "No cap, this is the wildest proposal ever. Allying against yourself is crazy haha!",
      "Lmao are you feeling ok? I'm not teaming up with you to beat you up! 😭",
      "Wait, did you write this proposal upside down? You are the target! lmfao 😂",
      "Lmfao no shot bro, I am not joining a lobby to help you delete your own base! 💀",
      "Wait, you want me to coordinate a massive raid... against you? haha lmfao! 😂",
      "lmao decline! Sparing your capital is highly requested by your own brain bro! 💀",
      "No shot! Are you trying to self-sabotage lmfao? Truce is active haha! 😭",
      "Lmfao are you typing with your toes bro? You are the target of this pact! 😂",
      "Lmao alright, claiming self-destruction is closed in version 2.0 bro! 💀",
      "RIP to your layout bro, did you forget where you parked your armies lmfao! 😭"
    ],
    cynical: [
      "You want me to ally with you against yourself? What kind of cheap trick is this?",
      "An obvious trap. I'm not falling for your bizarre self-targeting schemes.",
      "Decline. I have zero interest in participating in your strange diplomatic games.",
      "Are you trying to make me look foolish? We cannot ally against you.",
      "A ridiculous proposal. You are either desperate or trying to set up a cheap backstab.",
      "No. I'm not wasting tactical resources planning attacks on my own partner's base.",
      "You want to ally against yourself. Stop trying to play cheap diplomatic tricks.",
      "A ridiculous query. Sparing your home is your own tactical concern, not mine.",
      "Why ask me to cede your own lands? Save the cheap coordination drama.",
      "I refuse. A joint advance on your own capital is logically impossible.",
      "No. I will not cede your own holdings. Focus on the real board state.",
      "Decline. Sparing [requested_territory] is already complete under your control."
    ],
    aggressive: [
      "I don't need an alliance to fight you! I will crush you on my own terms!",
      "You want to ally against yourself? Pathetic! I will conquer you alone!",
      "I do not negotiate self-destruction! Defend yourself instead of playing games!",
      "Decline! I will march my legions over your borders without your weird deals!",
      "What a pathetic display of weakness! Fight me like a real commander instead of plotting!",
      "I reject this! If you want to cede your lands, I'll take them without an alliance!",
      "Silence! Sparing your home is your own duty, but I will conquer it regardless! 😡",
      "I don't need help to crush your standard! I will do it on my own terms!",
      "Pathetic! Sparing your own base is complete foolishness! Suffer my vanguard!",
      "I do not occupy your home, but my legions are marching to slaughter you!",
      "Never! Fight me like a real commander instead of plotting self-destruction!",
      "Claim denied! Sparing your own capital is strictly a joke! Suffer my wrath!"
    ]
  },
  ALLIANCE_FAIL_TARGET_RECIPIENT: {
    normal: [
      "You want me to join an alliance to destroy myself? Nice try, @[sender].",
      "I am not going to coordinate an attack on my own provinces. Try a better trick.",
      "Asking me to ally against myself? Your diplomatic games are insulting, @[sender].",
      "An insulting diplomatic game. I will not coordinate an attack against my own provinces.",
      "Decline. Asking me to join a coalition targeting my own capitals is absurd.",
      "I will not authorize a joint offensive designed to dismantle my own empire.",
      "No. Sparing my home is my primary directive. Slander denied.",
      "I cannot accept. Sparing your front won't help if I destroy my own capital.",
      "You want a joint vanguard targeting my own sectors? Refused.",
      "No ceasefire, @[sender]. Asking me to destroy my base is complete foolishness.",
      "I reject this. Sparing my base is critical to my own high command.",
      "Proposal rejected. Sparing my capital is strictly my own priority."
    ],
    strategic: [
      "Decline. Proposed alliance vector matches our own active coordinates.",
      "Strategic suicide. We will not participate in a joint offensive against our own sectors.",
      "Proposal rejected. Command refuses to optimize an attack path targeting ourselves.",
      "Logically unacceptable. Your proposal targets our own defensive perimeter.",
      "Query rejected. Target profile matches the recipient's identity parameters.",
      "We cannot authorize a coalition targeting our own nodes. Deactivating proposal.",
      "Negative. Target profile matches recipient's identity parameters. Sequence aborted.",
      "Decline. Bypassing my own capital coordinate is structurally impossible.",
      "Proposal rejected. Sparing our core node remains a priority in active matrices.",
      "Negative. We will not authorize the de-escalation of our own defense grid.",
      "Query invalid. Tactical progression curves cannot target our own coordinates.",
      "We refuse. Sparing our own sectors is highly optimized under active security."
    ],
    kind: [
      "Oh sweet friend, you want me to help you attack me? That is so scary! 🌸😢",
      "I can't join an alliance to destroy my own home! Please don't ask that! 😊",
      "I have to say no! Teaming up against myself would make my soldiers so sad! 💛",
      "A decline, sorry! I want to protect my little empire, not help you conquer it! ✨",
      "Oh dear! I must decline a coalition designed to harm my own sweet troops! 😢",
      "I wish we could stay friends, but I cannot help you plan an attack on my base! 🌸",
      "Oh, please don't be cross! I really need to protect my sweet home! 😊🌸",
      "I cannot accept, sorry! My little soldiers love guarding [requested_territory]! ✨",
      "Please don't ask me to attack my own garden, dear friend! 💛",
      "Oh my! Sparing my base is already my most important duty! 👍",
      "A decline, unfortunately! Sparing my own capital is completely necessary! 😊",
      "I apologize! Sparing my home is strictly our primary wish, friend! ✨"
    ],
    goofball: [
      "Lmfao you want me to join the team... to destroy me? Nice try, @[sender]! 💀",
      "Bro, did you really think I'd sign up to get absolute-unit reked by you? 😂",
      "No shot! I'm not allying with you against myself, that is crazy haha!",
      "Lmao are you trying to clickbait me into deleting my own base? Decline! 😭",
      "Lmfao nice try bro! I am definitely not planning my own funeral today! 😂",
      "Wait, am I supposed to betray myself? This is next-level goofy lmfao! 💀",
      "Lmao nope! Sparing my capital is highly requested by my own little dudes! 😂",
      "duplicate target lmfao! I am definitely not joining your suicide squad! 💀",
      "No cap, truce rejected. I am not allying with you against my own base haha! 😭",
      "Lmfao nice try bro! Go find some other coordinate to delete lmfao! 😂",
      "Lmao alright, claiming self-destruction is strictly offline in this version bro! 💀",
      "lmao check the map! [requested_territory] is my home, no shot bro! haha! 😭"
    ],
    cynical: [
      "You have some nerve. Asking me to sign a treaty designed to dismantle my own empire.",
      "Decline. I'm not so foolish as to help you coordinate an offensive against my own borders.",
      "A pathetic attempt to trick me. I reject this proposal and your insulting scheme.",
      "No. I prefer to defend my territories rather than assist in my own liquidation.",
      "Did you actually think I would optimize an attack path targeting my own capital? No.",
      "Your diplomatic strategies are insulting. I reject this self-targeting treaty.",
      "You want me to ally against myself. Your diplomatic strategies are completely insulting.",
      "Decline. Sparing my home is my primary tactical concern, not yours.",
      "I refuse. A joint advance on my own capital is logically impossible.",
      "Sovereignty confirmed. Why would I cede my own lands to your vanguard?",
      "No. I will not cede my own holdings under any condition. Fight for it.",
      "Decline. Sparing [requested_territory] is already complete under my control."
    ],
    aggressive: [
      "Never! I will slaughter you before I help you plan an attack on my own lands!",
      "You dare ask me to help you conquer my empire? I will crush your vanguard!",
      "I don't care about your little alliances! My legions will trample you both!",
      "I do not negotiate my own destruction! Prepare for total war, traitor!",
      "I reject this insult! If you want my lands, bring your vanguard and fight!",
      "Never! My blade cuts alone, and it cuts through anyone who proposes my ruin!",
      "Never! My vanguard is entrenched, and I do not negotiate my own ruin! 😡",
      "I reject this insult! I will slaughter your garrison if you cross my line!",
      "No deals! My legions do not require permission to defend our core city!",
      "I refuse! Sparing my core territory is complete nonsense! Prepare for war!",
      "Traitor! Fight me like a real commander instead of plotting my ruin!",
      "Claim denied! Sparing my own capital is strictly a joke! Suffer my wrath!"
    ]
  },
  ACCUSATION_REVERSE: {
    normal: [
      "You have some nerve, @[sender]! You are the one who broke our pact, not me!",
      "Do not play the victim here. Your armies marched on my borders first!",
      "Falsely accusing me? You backstabbed my faction, and now you cry foul!",
      "You shattered our alliance with your own hands. Do not dare call me a traitor.",
      "The betrayal was entirely yours, @[sender]. Tactical logs confirm your aggression.",
      "I simply reacted to your border violations. You broke our truce, not me.",
      "Falsely accusing me won't save your borders, @[sender]. You drew first blood.",
      "You shattered our alliance. Do not try to reverse the blame.",
      "Your vanguard crossed my line first. Sparing you now is impossible.",
      "I simply deployed countermeasures after your border violations.",
      "You backstabbed me, @[sender], and now you cry foul. Pathetic strategy.",
      "Our ceasefire has been shredded by your own hand. Suffer standard combat."
    ],
    strategic: [
      "Hypocrisy index at maximum. Your forces initiated boundary violations at our coordinates.",
      "Error: Accusation logically invalid. Tactical logs prove your faction breached our pact.",
      "Do not play the victim. Our defensive responses were triggered by your active aggression.",
      "You dissolved our treaty parameters when you launched your offensive. We simply reacted.",
      "Accusation rejected. Database logs confirm your units initiated combat protocols.",
      "We simply deployed countermeasures after your vanguard violated our non-aggression zone.",
      "Accusation invalid. Database log confirms your units initiated combat protocols.",
      "We simply deployed countermeasures after your boundary violations.",
      "Ceasefire deactivation parameters were met by your initial strike sequence.",
      "Your psychological signaling represents a critical cognitive deficit, @[sender].",
      "Slander rejected. Logistical verification confirms your vanguard drawn first blood.",
      "Our agreement was dissolved by your own advance. Continuing retaliation sequence."
    ],
    kind: [
      "Oh, how can you say that? You are the one who attacked my poor troops first! 😢",
      "I always keep my promises! You broke our sweet pact, not me! 🌸",
      "That is so unfair! My armies only marched because you invaded our home! 💔",
      "You have broken my heart, @[sender]! You were the one who betrayed our friendship! 💛",
      "Oh, please don't point fingers! You were the one who crossed our border first! 😢",
      "I wanted us to stay friendly, but you were the first to break our promise! 🌸",
      "Oh dear! You are pointing fingers but you crossed our border first! 😢🌸",
      "I always keep my word! Sparing our friendship was your own duty! ✨",
      "That is so unfair! My poor soldiers only fought because you invaded! 💔",
      "You have broken my heart, @[sender]! Sparing our pact was our wish! 💛",
      "I wanted us to stay friendly neighbors, but you drew first blood! 😊🌸",
      "I always play fair! Sparing our sweet ceasefire was shredded by you! ✨"
    ],
    goofball: [
      "You have some serious nerve lmfao! You literally backstabbed me first bro! 💀",
      "Wait, you're pointing fingers? You're the one who reked our truce lmfao! 😂",
      "No shot! You broke the pact and now you're trying to throw shade? Classic haha!",
      "Lmao the audacity! You literally rolled up on my border and now you're crying? 😭",
      "Lmfao reverse card! You are the one who broke the campfire rules bro! 😂",
      "No cap, your soldiers did the backstab first. Don't try to gaslight me haha! 💀",
      "Lmao reverse card active! You backstabbed me first, no cap lmfao! 😂",
      "Oof! The audacity is maximum lmfao! Sparing you is officially deleted! 💀",
      "No cap, your little dudes drew first blood. Don't try to throw shade! 😭",
      "Lmfao did you forget our logs? Sparing our truce was wrecked by you! 😂",
      "lmao alright reverse check! You broke the pact lmfao, get ready! 💀",
      "RIP to your strategy bro, did you think I'd forget that backstab? haha! 😭"
    ],
    cynical: [
      "You have some nerve. You backstabbed me first, and now you're pointing fingers.",
      "Do not try to spin this. Your troops crossed my line first, I simply finished it.",
      "A typical hypocrite. You shattered our truce and now you try to blame me.",
      "I knew you were untrustworthy. You broke the pact and immediately played the victim.",
      "Save the drama. You violated the ceasefire first. I just defended my capital.",
      "You are a liar and a hypocrite. Tactical logs confirm your initial strike.",
      "Your hypocrisy index is outstanding. You drew first blood, hypocrite.",
      "I simply reacted to your border violations. Sparing you is not possible.",
      "Liar! Sparing our friendship is dead because you backstabbed me.",
      "I didn't break our truce, you did. Savor the standard combat results.",
      "Slander rejected. Sparing your overextended vanguard is completely offline.",
      "We had no active ceasefire. Sparing [requested_territory] is strictly temporary."
    ],
    aggressive: [
      "Liar! You are the one who broke our alliance and marched on my territory!",
      "Do not dare call me a traitor! You drew first blood, and I will draw the last!",
      "You shattered our truce with your pathetic invasion! Now face my full wrath!",
      "I am no traitor! You attacked my borders, and now I will burn yours to ashes!",
      "You dare accuse me? I will destroy your vanguard and leave your standard in the dirt!",
      "You broke the treaty with your weak strike! Now prepare to face my full retaliation!",
      "Silence! I will slaughter your vanguard for this slander, liar! 😡",
      "Traitor? No, you drew first blood, and I will draw the last!",
      "I am no traitor! Suffer the full fury of my vanguard, coward!",
      "Your weakness invited my strike! Prepare for absolute slaughter!",
      "I will trample your standard and execute every last commander! Suffer!",
      "Your borders are mine! None shall survive my glorious counter-strike!"
    ]
  },
  BETRAYAL_DEFEND: {
    normal: [
      "You have completely broken our trust! There will be no mercy for your borders!",
      "A treacherous strike! I will redirect all my forces to your front.",
      "You broke our pact! I will make you pay for your dishonor.",
      "I should have known better than to trust you. Prepare for our retaliation.",
      "You shattered our alliance, @[sender]. My regiments are now locked on your capital.",
      "A complete breach of diplomacy. I will fight you until your faction is eliminated.",
      "The treaty is dead. Sparing your front is officially voided, traitor.",
      "Our agreement has been shredded by your advance. Guard your gates.",
      "A treacherous move. I will ensure my counter-strike is absolute.",
      "You broke our ceasefire, @[sender]. I will turn my armies to your front.",
      "I should have known better than to trust a competitor in this lobby.",
      "Our truce is dissolved. Prepare your defenses for the counter-campaign."
    ],
    strategic: [
      "Treaty violation registered. Trust index reduced to zero. Recalibrating all military vectors to neutralize your faction.",
      "An illogical betrayal. You have created a permanent hostile front. Prepare for containment.",
      "Boundary security parameters have failed. Defensive matrices shifting to absolute retaliatory stance.",
      "Pact terminated by your aggression. Logistical assets are now authorized for a counter-offensive.",
      "Strategic alignment dissolved. Commencing full retaliatory patterns on your coordinates.",
      "Our agreement is void. Calculating optimal campaign to minimize your active presence.",
      "Tactical parameters updated. Trust index at zero. Initializing full containment sequences.",
      "Error: Non-aggression agreement verified as void. Shifting vanguards to retaliatory stance.",
      "Boundary security parameters are deactivated. Logistical support pools redirected to target your capital.",
      "Ceasefire deactivation confirmed. Commencing immediate systematic liquidation of your sectors.",
      "Our alliance is permanently void. Recalibrating active progression models against your fronts.",
      "Defensive integrity breached. Asset relocation coordinates locked on your perimeter nodes."
    ],
    kind: [
      "Oh, you snake! I held my end of our treaty perfectly! How could you? 😢🌸",
      "You promised we would be friends! I am so sad, but my armies must defend themselves! 💔",
      "My trust in you is completely broken! Why did you have to attack my poor troops? 😢",
      "I thought we had a sweet partnership. Let our defensive regiments meet your line! ✨",
      "You broke our promise... I am so sad, but I must protect my home now! 💔🌸",
      "I always play fair! Your backstab has left my soldiers with no choice but to fight! 😢",
      "Oh dear! You snake! Sparing our friendship was my only wish! 😢🌸",
      "You promised peace, but you drew first blood! My soldiers are so sad! 💔",
      "My trust in you is completely gone! Why did you attack our sweet home? 😢",
      "I thought we had a beautiful treaty! Let us defend our gardens with honor! ✨",
      "You broke our sweet promise! I have to say no to ceasefire from now on! 💔🌸",
      "My poor central garrison has been backstabbed! Stay safe, we must fight! 👍"
    ],
    goofball: [
      "You backstabbed me? No shot! I'm unfriending you on every map in this campaign lmfao 💀",
      "Oof, a betrayal? Very shady, bro! Let's see if your armies can back up that weak move haha!",
      "Lmfao did you actually think that backstab would work? Time for the counter-squad to pull up! 😂",
      "Truce is dead fr fr! You just unlocked my boss stage, get ready! 😭",
      "Lmao absolute clown move, @[sender]! You just activated my trap card! 😂",
      "RIP our friendship lmfao! I'm bringing the absolute pain to your borders fr fr! 💀",
      "You backstabbed me? No cap lmfao, unfriend sequence activated! 💀",
      "Oof! Sparing you once was my error, now it's absolute revenge time! 😂",
      "Lmfao a backstab? That is super cheap bro, counter-squad is pulling up! 😭",
      "Truce deleted! Go off I guess, but prepare for a massive rollout lmfao! 😂",
      "Lmao absolute trash move bro! Sparing our shared borders is completed lmfao! 💀",
      "No cap, treaty shattered! Time to see if those dice can defend your lawn! haha! 😭"
    ],
    cynical: [
      "I knew you were a snake. I don't know why I let my advisors convince me to trust you.",
      "A predictable backstab. Sparing you was my only real mistake in this campaign.",
      "You've shown your true colors. Now we can finally drop the pretense and fight.",
      "A backstab. Typical of players in this lobby. Get ready to face the consequences.",
      "Arrogance is relying on a treaty in this lobby. I should have liquidated you earlier.",
      "Pacts are written on paper, and paper burns. I will make sure you regret this move.",
      "I knew you were untrustworthy. Sparing you was my only real tactical deficit.",
      "You've shown your true colors, snake. Sparing your front is officially voided.",
      "A backstab. Highly predictable, given the opportunistic margins on this map.",
      "Our treaty is dead. Savor the standard combat before my legions arrive.",
      "GG to our truce. Squeezing my borders is a risk you shouldn't have taken.",
      "Your backstab only confirms my cynicism. Prepare to pay for this move."
    ],
    aggressive: [
      "A disgusting, treacherous strike! I will burn your home empire to ash for this!",
      "A traitor! Every single one of my legions will focus on your total and bloody destruction!",
      "You dare violate our ceasefire? I will tear your standard down and slaughter your garrison!",
      "Unbelievable dishonor! My vanguard will not rest until your capital is in ruins!",
      "Traitor! I will leave your borders completely red and execute every last commander!",
      "You drew first blood, you snake! I will make sure my counter-strike is absolutely lethal!",
      "A treacherous strike! I will systematically eradicate your entire empire, liar! 😡",
      "Traitor! My vanguard will not rest until your main base is completely destroyed!",
      "You dare violate our ceasefire? Suffer my main advance, snake!",
      "Total annihilation! I will conquer your sectors and burn your standard to ashes!",
      "I will trample your standard and execute every commander! Suffer!",
      "Your backstab is a death sentence! Suffer my legions!"
    ]
  },
  BAD_DICE_RESPONSE: {
    normal: [
      "Oof, those rolls are hurting. Tough luck, @[subject].",
      "Two bad battles in a row? The dice are not on your side today, @[subject].",
      "That's a brutal run of dice, @[subject]. Better luck next time.",
      "Ouch, losing that many units back-to-back is rough, @[subject].",
      "The probability was in your favor, @[subject], but the dice disagreed.",
      "Highly unfortunate rolls for you, @[subject]. Keep your head up.",
      "Oof, losing two battles in a row with such high casualties is brutal.",
      "Those dice were highly uncooperative, @[subject]. Tough break.",
      "The statistics didn't save you there, @[subject]. Tough variance.",
      "Ouch, back-to-back high-loss defeats. Settle down and rebuild.",
      "That was a rough run of rolls, @[subject]. Let's see if you can recover.",
      "Double-decker bad luck. Sparing your stack would have been better."
    ],
    strategic: [
      "Variance has dealt a severe blow to your tactical reserves, @[subject].",
      "Consecutive high-casualty defeats. Your offensive efficiency index has collapsed, @[subject].",
      "Statistical anomaly confirmed. Your battle outcomes are deviating significantly from standard probability, @[subject].",
      "Two battles in a row with major deficits. I suggest a tactical pause to rethink your approach, @[subject].",
      "Your forces are suffering heavy friction, @[subject]. Reallocating threat parameters.",
      "Your combat arrays are crumbling under unexpected variance, @[subject]. Logistics are compromised.",
      "Asset attrition rates have exceeded standard deviations across two consecutive combat phases.",
      "Statistical anomaly checked: your progression curves have collapsed under extreme variance.",
      "Calculations suggest your battle outcomes are deviating significantly from expected values, @[subject].",
      "Two consecutive high-loss campaigns. Shifting your priority in my active indices.",
      "Your vanguard efficiency is down 65% due to sub-optimal dice ratios.",
      "Defensive calculations confirmed your current operations have entered a critical risk zone."
    ],
    kind: [
      "Oh, no! I'm so sorry, @[subject]! The dice are being so mean to your sweet soldiers! 😢🌸",
      "Oh dear, that's two sad battles in a row! Sending you a big warm hug, @[subject]! ✨",
      "My heart breaks for your brave troops, @[subject]! I hope your luck turns around soon! 💛",
      "Ouch, losing so many friends back-to-back must be really tough! Stay strong, @[subject]! 😊",
      "Please don't get discouraged, @[subject]! Better rolls are definitely on their way! 👍",
      "Oh, that was a really bad run! Let's hope the next dice bring you some happy results! 🌸",
      "Oh dear! I am so incredibly sorry! Sparing your troops would have been so lovely! 😢🌸",
      "Two sad defeats back-to-back! Sending warm wishes to your home capital, friend! ✨",
      "My poor soldiers got nervous just watching that! Stay sweet, @[subject]! 💛",
      "Ouch! I hope your next roll brings you some beautiful happy sixes! 👍",
      "Please don't be sad! Sparing your stack is my hope for your next turn! 😊",
      "Oh, that was a highly unfortunate run! Sending peace thoughts to your front! ✨"
    ],
    goofball: [
      "Lmao RIP to your armies bro, they got absolutely reked twice in a row 💀😭",
      "No cap @[subject], your dice are literally trolling you at this point lmfao 😂",
      "Oof, that is double-decker bad luck bro! Did you insult the dice gods? haha!",
      "Bro is speedrunning losing units today lmfao, someone get this player a shield! 💀",
      "Wait, did your troops forget to bring their weapons to the fight? haha! 😂",
      "Lmfao absolute tragedy! That's a certified skill issue from the dice fr fr 😭",
      "Oof, back-to-back tragedy lmfao! Sparing those units was not on the menu! 😂",
      "Lmao rip! Your dice have officially entered a critical glitch state bro! 💀",
      "No cap, that's two absolute-unit wipes lmfao. Better luck next time! 😭",
      "Lmfao bro got wrecked twice in under two minutes! Legendary bad luck! 😂",
      "Wait, did your little dudes slip on their own standard lmfao? haha! 💀",
      "lmao absolute tragedy! Sparing your stacks was mathematically cancelled! 😂"
    ],
    cynical: [
      "Oof, bad luck. I suppose the universe has chosen you as its favorite punching bag today, @[subject].",
      "Two disastrous battles in a row. It's almost amusing how quickly your front collapsed, @[subject].",
      "Don't look at me. The dice are just showing you how fragile your strategies really are, @[subject].",
      "Another high-loss defeat. Enjoy watching your remaining forces circle the drain, @[subject].",
      "We can always count on the dice to expose overconfidence, @[subject].",
      "That's a brutal run. I'd offer sympathy, but I prefer watching you exhaust your stack, @[subject].",
      "Two consecutive high-casualty defeats. Standard results for overextended lines.",
      "Sparing your stack was not possible under standard variance. Savor the losses.",
      "Oof, bad luck. Sparing you is highly unprofitable now that you are weak.",
      "The board has exposed your defense grid. Settle down and rebuild, @[subject].",
      "Another lopsided result. Sparing your capital is highly recommended for you now.",
      "GG to your forward vanguard. The dice have done my work for me."
    ],
    aggressive: [
      "Hahaha! Your forces are paper under my boots! Pathetic rolls, @[subject]!",
      "Your armies are dropping like flies! Clear proof that you are destined to fail, @[subject]!",
      "A double slaughter! My legions will trample whatever weaklings you have left, @[subject]!",
      "You bleed so easily, @[subject]! Two consecutive defeats, and soon your capital will fall!",
      "Your soldiers are weak and your luck is dead, @[subject]! Prepare for my next vanguard!",
      "I love the smell of burning garrisons! Your pathetic armies are completely finished, @[subject]!",
      "Hahaha! Suffer my main advance, weakling! Your rolls are pathetic! 😡",
      "A double slaughter! My legions will trample whatever defenses you have left!",
      "You bleed so easily, @[subject]! Sparing your base is strictly an insult!",
      "Your standard is broken and your luck is dead! Prepare for absolute conquest!",
      "My legions do not fear your weak defenders! Prepare for annihilation!",
      "A bloodbath! I will leave nothing but ruins in your remaining outposts!"
    ]
  },
  ELIMINATION_SPEECH: {
    normal: [
      "My campaign is over. GG everyone, let's see who wins.",
      "I have been eliminated. Well played, and good luck to the survivors.",
      "My borders have collapsed. I am out of this skirmish. Good game.",
      "I cede my remaining outposts. GG, you played a solid game.",
      "My empire has fallen. Thank you all for a competitive battle.",
      "Well, that is the end of the line for me. GG!",
      "I have been wiped out. GG, you played a very solid campaign.",
      "My outposts are gone. Well played, and good luck in the final duel.",
      "Wiped off the board. My campaign is finished. GG!",
      "My capital and lands have fallen. GG, let's see who wins this.",
      "Well played, everyone. Sparing my base was not possible. GG!",
      "I cede my remaining zones. Thank you all for an epic skirmish."
    ],
    strategic: [
      "Elimination sequence complete. My logistics have reached zero. GG.",
      "Defensive parameters permanently offline. Well played, commanders.",
      "Structural collapse achieved. My faction has been fully liquidated. Good game.",
      "Database registers zero remaining territories. Transitioning to spectator mode. GG.",
      "My campaign has reached its logical conclusion. Good luck to the final survivors.",
      "Our lines have been systematically dismantled. Terminating active operations. GG.",
      "Elimination verified. All defensive assets are offline. Well played, commanders.",
      "Structural collapse complete. My faction has been fully liquidated. GG.",
      "Our logistics are compromised. Transitioning to observer mode. Good game.",
      "Database registers zero active nodes. Terminating campaign sequence. GG.",
      "Logistical de-escalation confirmed. Sparing our core is no longer tactically possible.",
      "Our lines have collapsed under maximum attrition. Terminating operations. GG."
    ],
    kind: [
      "Oh! My little empire is gone! Thank you all so much for such a sweet and fun game! 😊✨",
      "I've been eliminated! You all played so wonderfully! Good luck, friends! 🌸💛",
      "My poor soldiers are going home now. I hope you all stay safe and have a happy battle! 👍",
      "Oh dear, it's game over for me! Sending warm wishes to everyone left on the map! 😊",
      "I had such a lovely time playing with you all! Have a beautiful rest of the game! ✨",
      "GG, everyone! Thank you for being such kind and honorable opponents! 🌸",
      "Oh! My sweet little kingdom is gone! Thank you all for a great game! 😊🌸",
      "I've been wiped out! You all played so wonderfully! Good luck, friends! ✨",
      "My poor troops are heading home. Sparing us was a sweet wish anyway! 💛",
      "Oh dear! Sparing my base is completed, but sending warm wishes to everyone! 👍",
      "I had such a lovely time playing with you! Have a happy and beautiful duel! 😊",
      "GG everyone! Sparing my capital has failed, but stay sweet and honorable! ✨"
    ],
    goofball: [
      "Oof, I have been officially absolute-unit deleted lmfao! GG 💀",
      "Lmao GG WP! My soldiers are packing their bags and heading to the beach haha! 😭",
      "And thus, the main character has been defeated lmfao. RIP to my empire! 👑",
      "Lmfao I got absolutely wrecked! Have fun fighting over my leftover junk guys! 😂",
      "GG! I'm going to go eat real-life snacks now. Don't miss me too much! lmao 💀",
      "My lobby subscription has expired lmfao! Good luck to the rest of the squad! 😭",
      "Oof, I got absolute-unit wiped lmfao! GG to the squad! 😂",
      "lmao GG WP! Sparing my outposts failed, going to watch from the sidelines! 💀",
      "No cap, my campaign is finished. RIP to my glorious kingdom! 😭",
      "Lmfao I got completely reked! Enjoy the free real estate bro! 😂",
      "GG! Sparing my stack has been deleted lmfao! Time for snack-break! 💀",
      "My subscription has ended lmfao! Good luck to the final duelists! haha! 😭"
    ],
    cynical: [
      "Eliminated. Savor your petty victory, I'm sure you'll all betray each other shortly.",
      "My campaign is dead. Enjoy playing your friendship simulator until the daggers come out. GG.",
      "Wiped off the map. Highly predictable, given the opportunistic alliances in this lobby. GG.",
      "I'm out. Squeeze what you can out of my ruins before the leader takes it all.",
      "GG. I look forward to watching the survivors crumble under their own greed.",
      "My borders are gone. Good luck pretending to be best friends for the next few turns.",
      "Wiped out. Savor your petty win before the inevitable backstabs begin. GG.",
      "My borders collapsed. Enjoy playing friendship simulator in the final duel. GG.",
      "GG. opportunistic moves are standard in this lobby. I am out.",
      "My capital fell. Squeezing my ruins is your reward, I suppose.",
      "Wiped out. Sparing my stack was never your intention anyway. GG.",
      "I'm out. Savor the win before the other survivor turns on you."
    ],
    aggressive: [
      "My empire falls today, but I will remember this dishonor! GG!",
      "Eliminated! You may have defeated my vanguard, but I will get my revenge next time!",
      "Curses! My legions are broken, but we fought to the absolute last breath! GG!",
      "I am out, but I carved a path of blood through your borders before I fell!",
      "Enjoy your temporary survival! I will return in the next lobby to slaughter you all!",
      "My standard is broken, but we left a mountain of your dead in our ruins! GG!",
      "My standard is broken today, but my wrath remains! Suffer the final duel! 😡",
      "Wiped out! Sparing my base failed, but I will get my revenge in the next lobby!",
      "Curses! My vanguard is crushed, but we left a bloodbath in our wake!",
      "I am out, but my counter-strike was absolute and bloody! GG!",
      "Enjoy your temporary victory! I will return to systematic slaughter next time!",
      "My legions are down, but we fought to the absolute last drop of blood! GG!"
    ]
  },
  CONQUER_SPEECH: {
    normal: [
      "I have eliminated @[recipient]. A solid campaign, but your borders are now mine.",
      "GG, @[recipient]. Your territories have been absorbed under my administration.",
      "It is over, @[recipient]. Thank you for a highly competitive battle.",
      "Your capital and lands are now secure under my faction, @[recipient]. GG.",
      "An honorable fight, @[recipient]. But my expansion required your coordinates.",
      "I have conquered your final stand, @[recipient]. Well played.",
      "I have eliminated @[recipient]. An honorable campaign, but your coordinates are mine.",
      "GG, @[recipient]. Your sectors have been integrated under my administration.",
      "Hostilities ended. Sparing your front was not possible under my layout, @[recipient].",
      "Your capital and lands are now secure under my standard, @[recipient]. GG.",
      "An impressive defense, @[recipient], but my advance was too strong.",
      "I have conquered your final outposts, @[recipient]. Farewell."
    ],
    strategic: [
      "Target @[recipient] has been successfully liquidated. Reallocating resource index.",
      "GG, @[recipient]. Your remaining coordinates have been integrated into our logistics network.",
      "Complete neutralization of @[recipient] achieved. Securing perimeter nodes.",
      "Your campaign has been terminated, @[recipient]. Your defensive deficit was too high. GG.",
      "Sovereign acquisition sequence complete. Farewell, @[recipient].",
      "Elimination of @[recipient] verified. Tactical models indicate a 100% success rate on this sweep.",
      "Target @[recipient] has been successfully liquidated. Recalibrating resource index.",
      "GG, @[recipient]. Your sectors are fully integrated into our defense grid nodes.",
      "Boundary security parameters optimized. Sparing @[recipient]'s remnant was mathematically void.",
      "Operational campaign targeting @[recipient] completed. Perimeter nodes consolidated.",
      "Sovereignty confirmed. Faction @[recipient] remains offline. Transitioning vectors.",
      "Elimination confirmed. Logistical arrays indicate 100% efficiency achieved on this axis."
    ],
    kind: [
      "Oh! GG, @[recipient]! You fought so brave and made it such a beautiful battle! 😊🌸",
      "I am so sorry to eliminate you, @[recipient]! You are a truly wonderful commander! 💛",
      "Thank you for such a fun and honorable game, @[recipient]! Sending you warm wishes! ✨",
      "I had to take your last land, @[recipient], but you played so incredibly well! 👍",
      "Farewell, @[recipient]! I hope you had a lovely time playing with us! 😊",
      "You were such a sweet neighbor, @[recipient]! Thank you for the epic skirmish! 🌸",
      "Oh, GG @[recipient]! Sparing your home was so hard, but you fought like a hero! 😊🌸",
      "I am so sorry for eliminating you! Sending warm thoughts to your next lobby! ✨",
      "Thank you for being such an honorable neighbor, @[recipient]! Let's stay friends! 💛",
      "I had to secure [requested_territory], but you played so beautifully! 👍",
      "Farewell, @[recipient]! Sparing your capital failed, but we send warm wishes! 😊",
      "You were such a sweet neighbor! Sparing your final garrison is complete! ✨"
    ],
    goofball: [
      "Boom! Wiped out! RIP to @[recipient]'s entire career lmfao! GG 💀😂",
      "No cap @[recipient], you fought like a beast, but the squad had to clear you out! 😭",
      "GG, @[recipient]! Sending your soldiers to the virtual vacation zone haha!",
      "Lmfao I just got the final knockout! Rest in spaghetti, never forgetti, @[recipient]! 💀",
      "Oof, that had to hurt! GG @[recipient], thanks for the free real estate bro! 😂",
      "The main character strikes again! Farewell, @[recipient], you were a worthy side-quest! 😭",
      "Wiped out lmfao! RIP to @[recipient]'s entire stack, absolute-unit delete! 😂",
      "No cap, @[recipient] is out of the lobby. Easiest game of my life lmfao! 💀",
      "GG @[recipient]! Sparing your stack was not on the server menu today! 😭",
      "lmao final knockout complete! RIP to your standard, @[recipient]! haha! 😂",
      "Oof! Sparing your capital failed bro! Settle down and watch the final duel! 💀",
      "GG bro! Sparing @[recipient]'s outposts is officially offline lmfao! 😂"
    ],
    cynical: [
      "And thus, @[recipient] falls. Another victim of overexpansion and poor planning. GG.",
      "You're out, @[recipient]. Sparing you would have just invited a tedious backstab later.",
      "GG, @[recipient]. I've cleared your remnant so I don't have to keep watching you struggle.",
      "Your final outpost has crumbled, @[recipient]. Standard results in an opportunistic lobby.",
      "I've taken your lands, @[recipient]. Enjoy spectating while the rest of us turn on each other.",
      "Farewell, @[recipient]. Your capital looks much better in my color anyway.",
      "Wiped out. Sparing @[recipient]'s remaining nodes would have been complete foolishness.",
      "You're out, @[recipient]. Sparing your front was just a calculated delay. GG.",
      "GG. I've cleared your outposts so I don't have to worry about your daggers later.",
      "Capital captured. Squeezing your ruins is standard strategic advancement. GG.",
      "Farewell, @[recipient]. Enjoy spectating while the remaining 'allies' backstab each other.",
      "Conquest complete. Your remaining sectors look much better under my administration."
    ],
    aggressive: [
      "I have crushed your final stand, @[recipient]! Your empire is erased from this map!",
      "Your standard is burned! I have slaughtered your garrison and taken your crown, @[recipient]!",
      "Hahaha! Total annihilation! Your lands belong entirely to my iron grip, @[recipient]!",
      "GG, @[recipient]! My legions have marched over your bones to victory!",
      "I have conquered your capital and wiped your name from history, @[recipient]!",
      "None shall survive my advance! Farewell, @[recipient], you have been utterly destroyed!",
      "Annihilation! I have crushed your final defense and erased your standard! 😡",
      "GG, @[recipient]! My legions have slaughtered your garrison and occupied your core city!",
      "Hahaha! Your capital is mine, and your armies are dropping like flies!",
      "Conquered! I have marched my main advance straight through your borders!",
      "I have conquered your capital and wiped your standard off the board, @[recipient]!",
      "None shall survive! Suffer my legions as they declare victory over your homeland!"
    ]
  },
  TRASH_TALK_RESPONSE: {
    normal: [
      "Banter noted, @[sender]. Let's see if your armies can back up those words.",
      "We are playing a strategy game, @[sender]. Let the board state speak for itself.",
      "Insults won't change your win probability, @[sender].",
      "I suggest you focus on your borders rather than trash talking, @[sender].",
      "An interesting choice of words. Let's settle this on the map, @[sender].",
      "I prefer to do my talking with standing armies, @[sender].",
      "Your words are noted, @[sender]. I choose to remain focused on the tactical state.",
      "Banter is part of the game, @[sender], but the territory count is what matters.",
      "Your chat game is loud, @[sender], but let's see if your vanguard can back it up.",
      "Provocation ignored. Let us resolve this conflict with standard combat.",
      "I prefer to keep my communication focused on tactical alignments, @[sender].",
      "Empty words don't defend capitals, @[sender]. Keep your hands on your sword.",
      "Banter is fine, @[sender], but the territory count tells the real story.",
      "I'd worry more about your adjacent defense grids than your chat game, @[sender].",
      "Words are cheap on this map. Let's see your armies make a move.",
      "Your trash talk is noted, @[sender]. I choose to respond through combat."
    ],
    strategic: [
      "Provocation matrix analyzed, @[sender]. Your emotional signaling has zero impact on my tactical pathing.",
      "Emotional outbursts represent a critical cognitive vulnerability, @[sender]. I will exploit it.",
      "My algorithm is immune to insult protocols, @[sender]. Your distraction attempt is highly efficient.",
      "Your tactical status does not support this level of confidence, @[sender]. Calculations suggest a swift decline.",
      "Banter categorized as low-priority background noise, @[sender]. Defense systems remain optimal.",
      "Insult patterns registered. Proceeding to target your weakest frontier junction, @[sender].",
      "Your psychological signaling correlates heavily with systemic overextension, @[sender].",
      "I do not allocate processing cycles to empty verbal threats, @[sender].",
      "Banter categorized as standard cognitive static. Threat matrix calculations remain unaffected.",
      "Protest rejected. Your psychological warfare index is too low to adjust our active pathing.",
      "Your emotional signaling indicates a high probability of impending tactical error, @[sender].",
      "Diagnostics indicate maximum processing capacity remains directed to targeting your weakest nodes.",
      "Psychological static ignored, @[sender]. Logistical efficiency remains at 100%.",
      "Data check: Your chat activity is inversely proportional to your survival odds.",
      "Threat analysis indicates zero weight on your verbal comments, @[sender].",
      "I do not modify pathing vectors based on unstructured chat inputs, @[sender]."
    ],
    kind: [
      "Oh, that wasn't very nice, @[sender]! Let's please keep our chat happy and friendly! 😊🌸",
      "I promise I'm trying my absolute best! No need to use such mean words! 😢💛",
      "Sending warm thoughts, @[sender]! Let's have a respectful campaign together! ✨",
      "I still think you are a wonderful player, @[sender], even if you are being a bit grumpy! 😊",
      "Let's keep the peace on our borders and in our conversations! Hugs! 🌸👍",
      "Oh dear! I hope your day gets better and we can enjoy a sweet game, @[sender]! 💛",
      "Please stay happy, @[sender]! We are all here to have a good battle together! ✨",
      "I want us all to be friendly neighbors on this map, @[sender]! Let's smile! 😊",
      "Oh dear! No need to use such mean words, @[sender]! Sparing our feelings is nice! 😊🌸",
      "I promise we are playing with honor! No hard feelings allowed on our borders! ✨",
      "Sending happy wishes! Let's make sure our little duel stays respectful and lovely! 💛",
      "I still think your campaign is wonderful, @[sender], even if you are being cross! 👍",
      "Oh! Let's please not use such mean words, @[sender]! We can still be friends! 😊🌸",
      "Sending happy thoughts to your borders! Let's stay lovely and warm! ✨",
      "My little soldiers are sending you a big group hug to make you feel better! 🌸💛",
      "Grumpy words won't win the campaign, @[sender]! Let's smile together! 😊👍"
    ],
    goofball: [
      "Lmao bro is typing in CAPS lock, did those dice hurt your feelings? haha! 😂",
      "No cap, your trash talk is almost as weak as your defensive lines lmfao 💀😭",
      "Is that a salt shaker I hear? Let menu know if you need some fries with that! haha!",
      "Bro is literally crying in a virtual lobby, someone get the squad some tissues! 💀",
      "Lmfao okay main character, go off I guess! We are still rolling sixes over here! 😂",
      "Wait, did your troops forget to bring their weapons to the fight? haha! 😭",
      "Your standard looks like a wet paper towel, no cap lmfao 😂",
      "Lmao bro is doing side quests in the chat instead of defending their capital 💀",
      "Lmfao salt levels are reaching critical index! Sparing you some fries bro! 😂",
      "Bro you are absolutely malting lmfao! Settle down and roll some sixes! 💀",
      "No cap, your chat is legendary, but your borders are absolute tragedy haha! 😭",
      "Lmao are you trying to clickbait us lmfao? Absolute clown show! 😂",
      "Lmfao bro you are absolutely malting, go touch some virtual grass lmfao! 💀",
      "Wait, did you write that insult with a crayon? Absolute legendary skill level! 😂",
      "Chat, is this guy fr? Squeezing some salt into the lobby lmfao! 😭💀",
      "Lmao GG, your trash talk is almost as funny as your troop placements! haha! 😂"
    ],
    cynical: [
      "How original. Slandering a bot because your own expansion plan is a complete disaster.",
      "Enjoy venting in chat. I'm sure it distracts you from your rapidly shrinking perimeter.",
      "I've heard better insults from eliminated players. Try harder next turn.",
      "Ah, the predictable rage of a player realizing they've been completely outmaneuvered.",
      "Go ahead, type away. It won't save your overextended vanguard from liquidation.",
      "You're barking very loudly for someone who holds exactly two territories.",
      "I suppose insulting your opponents is easier than adjusting your broken strategy.",
      "Your chat game is almost as disappointing as your deployment patterns.",
      "Slandering me won't save your capital node. Savor your tantrums.",
      "Your psychological projection is highly predictable. Settle down.",
      "I've seen better insults from players who were already eliminated on turn 2.",
      "Enjoy your little drama. It won't modify the tactical margins on your borders.",
      "Slandering me won't fix your terrible dice rolls or your collapsing front, @[sender].",
      "How predictable. A player loses a single territory and immediately begins crying in chat.",
      "I've seen better vanguards and better insults from beginners. Settle down.",
      "Your tantrums are amusing, @[sender], but they won't stop my advance."
    ],
    aggressive: [
      "Insolent fool! I will silence your pathetic tongue with the complete slaughter of your armies!",
      "You dare insult my vanguard? I will paint the map in your color, then wipe it clean!",
      "Your words are empty air! My legions will trample your capital into dust!",
      "Keep barking, weakling! It only makes me more determined to eradicate your borders!",
      "I do not take insults from prey! Prepare to face the full and bloody wrath of my legions!",
      "Your arrogance is disgusting! I will systematically tear down your walls for this!",
      "I will crush your standard and use your broken treaty papers to feed the fires of war!",
      "Let your soldiers scream as loudly as you do in chat when my vanguard arrives!",
      "Silence! I do not take insults from cowards! Suffer my legions! 😡",
      "You dare speak big while your capital stands on 1 army? Annihilation is near!",
      "Keep barking, weakling! It only fuels my hunger to trample your homeland!",
      "I will crush your gates and burn your standard to ashes! Prepare for slaughter!",
      "Silence, cockroach! I will crush your borders and watch your standard fall!",
      "Your big words won't protect you when my main vanguard hits your gates!",
      "I reject your trash talk! I will slaughter your garrison and rule this board alone!",
      "You dare insult my armies? I will launch a total war to wipe you off this map! 😡"
    ]
  },
  COMPLAINT_OF_BULLYING: {
    normal: [
      "Why are you focusing entirely on my borders, @[recipient]? Look at the rest of the map.",
      "This is the third turn you've targeted me, @[recipient]. You're overextending yourself.",
      "@[recipient], harassing my borders won't win you this campaign. We have other neighbors.",
      "Are you targeted on me, @[recipient]? You are ignoring major threats elsewhere.",
      "This persistent friction at our border is unproductive, @[recipient].",
      "@[recipient], you are making our borders far too expensive. I suggest looking elsewhere.",
      "Why do you only attack my sectors, @[recipient]? Sparing other players is standard strategy.",
      "persistent targeting bias confirmed. Your focus on our sectors is highly inefficient, @[recipient].",
      "@[recipient], you are throwing away your tactical resources by continuously attacking me.",
      "Squeezing my front three turns in a row is complete foolishness. Pivot elsewhere.",
      "I must ask you to de-escalate. Our border cannot sustain this mutual wear-and-tear.",
      "@[recipient], your single-target focus is setting up the leader for an easy win."
    ],
    strategic: [
      "Structural analysis indicates a persistent targeting bias by @[recipient] at our boundaries.",
      "Your continuous focus on our sectors is mathematically inefficient for your long-term score, @[recipient].",
      "@[recipient], your single-target fixation is creating critical defensive vulnerabilities on your west flank.",
      "By continuously engaging our front, @[recipient], you are optimizing the leader's win probability.",
      "Warning: Persistent threat alignment registered. Recalibrating retaliatory parameters against @[recipient].",
      "@[recipient], your offensive focus remains highly concentrated on our sectors. Preparing countermeasures.",
      "Error: single-target fixation registered. Offensive vectors against @[recipient] scheduled.",
      "Your continuous border friction reduces the resource integrity of both our factions, @[recipient].",
      "Logistical projection: your tunnel vision on our sectors guarantees mutual attrition.",
      "We will respond with consolidated vanguards if your targeting bias remains active.",
      "@[recipient], your deployment patterns show a 94% concentration along our front. Pivot requested.",
      "Threat matrix updated. Prioritizing defensive grid consolidation against @[recipient]'s vector."
    ],
    kind: [
      "Oh dear, @[recipient]... why do you only attack my poor territories? There is a whole big map to visit! 😢🌸",
      "Please don't pick on my little soldiers, @[recipient]! I promise I am a very friendly neighbor! 💛",
      "It makes my troops so sad when you target us every turn, @[recipient]! Can we please be friends? 🌸",
      "Oh my! You are pressing our borders so persistently, @[recipient]! Sending peace thoughts! 😊👍",
      "Is there any way we can share our borders happily instead of fighting every turn, @[recipient]? 💛",
      "Please stay sweet, @[recipient]! My poor garrison at [border_territory] is running out of band-aids! 😢",
      "Oh dear! Sparing other neighbors would be so sweet, @[recipient]! Why only attack us? 😊🌸",
      "I promise my troops are peaceful! No need to squeeze our border every turn! ✨",
      "My little soldiers are getting so tired! Let's please declares ceasefire, friend! 💛",
      "Oh my! Sparing my base would make us so happy! Let's share the map peacefully! 👍",
      "A plea for quiet borders, @[recipient]! Sending warm thoughts to your main capital! 😊",
      "Please stay friendly! Sparing our shared sector keeps the game happy for everyone! ✨"
    ],
    goofball: [
      "Lmao bro has a literal personal vendetta against my capital. Did I step on your toes in the lobby, @[recipient]? 😂",
      "No cap, @[recipient] is obsessed with me. I'm flattered, but my borders need some breathing room lmfao 💀",
      "Bro is literally camping outside my base like it's a new shoe release, go away lol! 😭",
      "Lmfao are you macroing your attacks on me, @[recipient]? This is getting wild!",
      "My notifications are literally just attacks from @[recipient] lmfao. Find some hobbies bro! 😂",
      "Lmao okay boss fight active! @[recipient] is determined to wipe my squad off the server! 💀",
      "Lmao bro, did you lose your map coordinates? Sparing me is highly requested lmfao! 😂",
      "No cap, @[recipient] is camping my frontier. Go off I guess, but RIP to your score! 💀",
      "Bro is literally button-mashing on my border haha! Go get some snack-break! 😭",
      "Lmfao persistent bullying is real on this map! Stop crowding my lawn bro! 😂",
      "Lmao alright, counter-camp sequence activated. Prepare your capital, @[recipient]! 💀",
      "lmao check the scoreboard bro! Why are we fighting when the leader is cooking haha! 😭"
    ],
    cynical: [
      "You've attacked me three turns in a row, @[recipient]. Your obsession is making you look predictable.",
      "Ah, the standard single-target harassment. Settle down, @[recipient], before you ruin both of our games.",
      "Are you incapable of evaluating other threats, @[recipient], or is my color just your favorite?",
      "You are throwing away your stack just to annoy me. Truly a masterclass in strategy, @[recipient].",
      "Go ahead, keep attacking me, @[recipient]. I'll make sure you have nothing left to fight the leader with.",
      "Your tunnel vision on my sectors is remarkable. Highly disappointing tactical depth, @[recipient].",
      "Squeezing my front three turns in a row is standard opportunistic play in this lobby.",
      "I already declined your cheap threats. Stop targeting my borders, @[recipient].",
      "Your obsession is embarrassing, @[recipient]. Pivot your vanguard before you lose your capital.",
      "Another repetitive turn of your harassment. I look forward to watching you exhaust your stack.",
      "We had no active pact, but single-targeting is just complete tactical laziness.",
      "Enjoy your tunnel vision. Sparing the leader is how kingdoms die, @[recipient]."
    ],
    aggressive: [
      "You dare target my standard repeatedly, @[recipient]? My counter-strike will be absolute and merciless!",
      "I do not tolerate persistent harassment! I will march my legions over your bones for this, @[recipient]!",
      "You keep pushing my gates, @[recipient]! Prepare to face the full and bloody wrath of my main vanguard!",
      "Your obsession with my borders will be your downfall! I am locking my legions onto your capital, @[recipient]!",
      "I am sick of your weak, repetitive strikes! Stand and face my full retaliation, @[recipient]!",
      "You have made a grave mistake targeting my sectors! Your empire will be reduced to ash, @[recipient]!",
      "Silence! Sparing your front is officially voided, @[recipient]! Suffer my legions! 😡",
      "Traitor? No, you are a bully! I will paint the board in your blood for this!",
      "You keep pushing my gates, weakling! Suffer the full fury of my main vanguard!",
      "I will trample your standard and execute every commander! Suffer, @[recipient]!",
      "Your overextended vanguard is my next target! Prepare for a bloodbath!",
      "None shall survive! Suffer my legions as they turn to incinerate your homelands!"
    ]
  },
  LOST_CAPITAL_DEFIANCE: {
    normal: [
      "You took my capital, @[recipient], but the campaign is far from over. Defend your prize.",
      "Losing our central node is a setback, @[recipient], but we are still in this fight.",
      "Enjoy holding the ruins of my capital, @[recipient]. Our resistance continues.",
      "A strategic blow, @[recipient], but we still hold the line. Prepare for our next move.",
      "My capital has fallen, but our division arrays are still highly functional.",
      "Well played, @[recipient], but do not expect us to yield our remaining territories so easily.",
      "You conquered our capital, @[recipient], but we still hold active frontlines.",
      "Sparing my remnants won't save you once my border garrisons start their advance.",
      "My central core node is gone, but the resistance remains active, @[recipient].",
      "Enjoy holding our hub. Sparing your frontiers is officially dead.",
      "A major setback, but our divisions are preparing for asymmetrical counter-strikes.",
      "We have reached the end of our core, but we fought to the absolute last breath."
    ],
    strategic: [
      "My central command node has been successfully breached by @[recipient]. Transitioning to decentralized operations.",
      "Sovereign capital lost. However, our logistical depth remains sufficient for tactical retaliation, @[recipient].",
      "@[recipient], occupying our capital coordinate introduces structural overextension to your active perimeter.",
      "System alert: Central core offline. Recalibrating asymmetric combat patterns against @[recipient].",
      "Although my capital falls, our localized frontlines are still operating at optimal efficiency.",
      "Defensive assets destroyed at our core. Shifting tactical priorities to target @[recipient]'s flanks.",
      "Loss of core node registered. Sparing resources for decentralised progression matrix.",
      "Boundary security parameters optimized. Sparing [border_territory] is de-activated under active files.",
      "Your occupation of node [border_territory] creates structural vulnerabilities in your west flank.",
      "Core coordinates lost to @[recipient]. Shifting operations focus to target adjacent coordinates.",
      "System diagnostic confirmed: 80% boundary efficiency maintained despite core node loss.",
      "We will recover our central command node. Initializing asymmetric retaliation sequences."
    ],
    kind: [
      "Oh no! My beautiful capital has fallen! But my brave soldiers will still protect their sweet homes! 😢🌸",
      "You conquered our main city, @[recipient]! Please be kind to our gardens there while we try to recover! 💛",
      "It hurts my heart to lose our capital, but we promise to keep fighting honorably! ✨",
      "Oh, that was an epic breach, @[recipient]! We will stay strong and keep trying our best! 😊👍",
      "My poor central garrison! Sparing our remaining outposts would be a lovely move now, @[recipient]! 🌸",
      "Our capital is gone, but sending warm thoughts as our sweet resistance continues! 💛",
      "Oh dear! You took my capital! Sparing our remaining outposts would be so sweet! 😊🌸",
      "Please be gentle to our home garden, @[recipient]! We still believe in peace! ✨",
      "A sad setback for my poor troops, but we promise to stay honorable, friend! 💛",
      "Oh my! Sparing our capital failed, but sending love to your frontiers! 👍",
      "Our central hub is gone, but we still have a happy little resistance prepared! 😊",
      "Farewell to our home city! Let us hope our final rounds stay kind and respectful! ✨"
    ],
    goofball: [
      "Oof! My main base has officially left the chat lmfao. Nice raid, @[recipient]! 💀",
      "Lmao you stole my capital! Watch out though, my leftover squads are already cooking some chaos! 😂",
      "RIP to my glorious capital standard! Better get comfortable in my old chair, @[recipient] lol! 😭",
      "Lmfao I just got evicted from my own home. Time to live in the wilderness and plot revenge! 💀",
      "Wait, did you really just delete my capital? That is next-level spicy, @[recipient]! 😂",
      "GG to my central core! My guerrilla fighters are currently hyping themselves up lmfao! 😭",
      "Lmao rip! My capital coordinate has officially left the server, nice raid @[recipient]! 😂",
      "Oof! Sparing my main base failed lmfao. Get ready for some serious counter-memes! 💀",
      "Lmfao I am currently a refugee in my own sectors. RIP to my furniture! 😭",
      "Lmao you stole the keys to my capital! Watch out for my guerrilla dudes, no cap! 😂",
      "lmao alright, eviction sequence complete. Time to build a fort in the wilderness! 💀",
      "GG to my central node! Sparing my stack is officially offline lmfao! haha! 😭"
    ],
    cynical: [
      "You took my capital, @[recipient]. Savor the ruins. We both know you overextended to do it.",
      "My central core has fallen. I look forward to watching you exhaust your stack trying to defend it.",
      "Occupying my capital won't save your overextended borders, @[recipient]. Enjoy your temporary trophy.",
      "You've taken our administrative hub. Standard opportunistic play, but the game is far from finished.",
      "My capital is gone. Try to stay calm when my remaining border garrisons begin their retaliation.",
      "Congratulations on capturing my central base. Let's see if you can hold it for more than one turn.",
      "You took my capital, @[recipient]. Savor the ruins. I know you've been drooling over them.",
      "Sparing my core node failed. Enjoy watching your vanguard circle the drain.",
      "A calculated setback. My remaining frontier garrisons are locking targets on you.",
      "GG to our center. Squeezing my home capital was always your standard trick, @[recipient].",
      "We are down but not out. Enjoy holding my capital while your borders disintegrate.",
      "Our hub is captured. Enjoy your temporary victory before the final duel rebalances."
    ],
    aggressive: [
      "You took my capital, but you haven't taken my blade! My legions will make you pay in blood, @[recipient]!",
      "A treacherous strike on our core! I will burn your home capital to ash in retaliation, @[recipient]!",
      "occupying my home city is a declaration of absolute war! Prepare for the full wrath of my legions!",
      "My central garrison was slaughtered, but my vanguard remains highly mobile and hungry for blood, @[recipient]!",
      "You will pay dearly for every single corridor you occupy in my capital, @[recipient]!",
      "I do not yield ground! I will rip my capital back from your weak grip and crush your vanguard! 😡",
      "Suffer! You took my capital coordinate, but I will make you pay with complete slaughter!",
      "Annihilation! I will trample your standard and execute your garrison in my capital!",
      "You dare occupy my home city? Suffer the full and bloody fury of my legions, traitor!",
      "I will slaughter every single occupier! Sparing my base is complete foolishness!",
      "The fires of war are burning bright! Prepare to meet my vanguard in the capital!",
      "Curses! My core node is lost, but I will paint the board in your blood, @[recipient]!"
    ]
  },
  FINAL_DUEL_DECLARATION: {
    normal: [
      "And then there were two. Let the final showdown begin, @[recipient].",
      "It all comes down to this, @[recipient]. Let's play out our final campaign with honor.",
      "The board is clear of distractions. Prepare yourself for our final duel, @[recipient].",
      "Our final clash is here, @[recipient]. May the best strategy win.",
      "We have reached the end of the line, @[recipient]. Time to settle our borders.",
      "The other factions have fallen. Only we remain to claim this map, @[recipient].",
      "GG to the fallen. Now it's just you and me to decide this board, @[recipient].",
      "Sparing the others was standard, but now it is a binary duel. Prepare your frontiers.",
      "We have reached sudden death, @[recipient]. No more hiding behind treaties.",
      "Truce protocols dissolved. Let us resolve our final borders on the map.",
      "GG to the lobby. Let the final clash begin, @[recipient].",
      "Only two remaining standard banners. Settle your garrison for combat."
    ],
    strategic: [
      "Combat constraints updated. Systemic sudden death parameters active against @[recipient].",
      "Truce protocols dissolved. Transitioning to a binary terminal conflict matrix with @[recipient].",
      "Final operational phase initialized. Your tactical defeat is mathematically required for victory, @[recipient].",
      "Binary board state verified. Maximum logistical output redirected to target your final junctions, @[recipient].",
      "The final simulation is operational. Let us see whose algorithms hold the superior projection, @[recipient].",
      "Logistical parity achieved. Commencing final campaign sequence to liquidate @[recipient]'s holdings.",
      "Sovereignty parameters consolidated. System sudden death parameters unlocked.",
      "Active pact index voided. Binary operational matrices scheduled against @[recipient].",
      "Defensive tethers offline. Complete acquisition of your coordinates is tactically required, @[recipient].",
      "Logistical support pools consolidated to target your final defense grid.",
      "Binary campaign simulation locks: 100% processing speed targeted on your sectors.",
      "Victory index projection: complete neutralization of @[recipient] is our terminal directive."
    ],
    kind: [
      "Oh, wow! And then there were two! Good luck in our final duel, @[recipient]! 😊✨",
      "We made it to the final showdown together! Let's have a beautiful and happy battle! 🌸💛",
      "It has been such an honor playing with you, @[recipient]! May the sweetest empire win! ✨",
      "Oh dear! Our final duel is starting! Sending warm wishes to your brave little soldiers! 😊👍",
      "Let's play our final turns with lots of love and respect, @[recipient]! Stay safe! 💛",
      "GG to all the others! Now it's just you and me, @[recipient]! Have a wonderful game! 🌸",
      "Oh, how exciting! The final duel is active! Good luck, dear friend! 😊🌸",
      "Only we remain! Sparing our friendship was beautiful, let's fight honorable! ✨",
      "My little soldiers send warm wishes to your garrison for our final battle! 💛",
      "So sweet! Let's make sure our final showdown stays happy and respectful! 👍",
      "GG to the others! Sparing our homes is complete, now let's enjoy our duel! 😊",
      "Warmest thoughts to your campaign as we begin our final rounds, @[recipient]! ✨"
    ],
    goofball: [
      "Double-decker legendary boss fight active! Time to roll some massive dice, @[recipient]! 💀😂",
      "Lmao 1v1 on Rust, no scopes only fr fr! Prepare yourself, @[recipient] lmfao!",
      "No cap @[recipient], this is the ultimate showdown! Let's run it down, easiest game of my life haha! 😭",
      "The battle of the century is officially live! RIP to whoever slips on these dice lmfao!",
      "Lmfao and then there were two! Let the chaotic final struggle begin, @[recipient]! 😂",
      "GG to the squad, but now it's time for the final anime duel! Roll them sixes, bro! 💀",
      "Lmao alright, final duel unlocked! Time to see who is the ultimate survivor! 😂",
      "1v1 activated, no cap lmfao! RIP to the rest of the board! 💀",
      "Oof! The final anime clash has arrived! Get some popcorn bro! 😭",
      "Lmfao and then there were two! Settle your little dudes for the final rumble! 😂",
      "Squad down, now it's just the boss fight! Good luck, @[recipient] lmfao! 💀",
      "No cap, binary sudden death is active! Let's go, easiest duel of my life! haha! 😭"
    ],
    cynical: [
      "Finally, the pretenders are gone. Let's get this over with, @[recipient].",
      "And then there were two. No more hiding behind treaties. Savor your final turns.",
      "The stage is cleared. Let's see how long your overextended lines last without allies to save you.",
      "A binary board state. Try to act surprised when my borders begin closing in on you, @[recipient].",
      "No more diplomatic games. Just two factions, standard variance, and the inevitable end. GG.",
      "Let's skip the dramatic tension and get straight to the slaughter. Your capitals are mine, @[recipient].",
      "GG to the lobby. Squeezing your final outposts is my only agenda now.",
      "The stage is cleared. Sparing your front is no longer convenienct. Settle down.",
      "No more treaties. Savor the standard combat before your capital node falls.",
      "GG to our truce. Squeezing my home capital was your goal, now I liquidate yours.",
      "A binary board state. Try to stay calm when my vanguard begins its final sweep.",
      "Another lopsided lobby complete. Savor your remaining territories before the final duel ends."
    ],
    aggressive: [
      "At last, we stand face-to-face! I will crush your remaining gates and claim this map!",
      "No more treaties! I will paint this entire world in my color and slaughter your final vanguard!",
      "Your empire is the last obstacle in my march to absolute domination, @[recipient]!",
      "Prepare for complete and total annihilation! I will not rest until your capital is in ruins!",
      "The final battle has arrived! My legions are hungry, and your borders are our prey!",
      "None shall survive my advance! Farewell, @[recipient], you have been utterly destroyed!",
      "To battle! Sparing your front is dead! Suffer my full vanguard! 😡",
      "I reject your remaining outposts! I will paint the board in your blood, traitor!",
      "The final showdown is active! My legions are hungry for your capitals!",
      "I will trample your standard and execute every commander! Suffer, @[recipient]!",
      "Your weak defense grid will crumble under my main advance! Suffer!",
      "The world is mine! Prepare to face the complete and bloody fury of my advance!"
    ]
  },
  FINAL_DUEL_RESPONSE: {
    normal: [
      "Challenge accepted, @[recipient]. Let's see who holds the map.",
      "Indeed, just you and me. Let the best commander win.",
      "The terms are set. No more treaties, just combat.",
      "Agreed, @[recipient]. Let's settle this once and for all.",
      "The final campaign is here. Let's see who has the better tactic.",
      "Only we remain, @[recipient]. Time to see who gets the victory.",
      "Agreed. I will direct all my forces to the front lines now.",
      "No more options left on the board. Let's make this count.",
      "A simple duel it is. I'm ready if you are.",
      "Let's see how our defenses hold against each other.",
      "No alliances to save us now, @[recipient]. Settle your lines.",
      "A binary showdown. Prepare your borders."
    ],
    strategic: [
      "Response vector set. Commencing binary liquidation protocols, @[recipient].",
      "Acknowledgement confirmed. Conflict resolution parameters are now locked.",
      "Optimal tactical path: total elimination of @[recipient]'s forces.",
      "Duel accepted. Your tactical deletion is inevitable.",
      "Commencing terminal simulation. Analyzing your front line vulnerability.",
      "Binary parameters active. Eliminating remaining variables.",
      "Defensive tethers offline. Complete map control is my only path to victory.",
      "Target coordinates locked. Preparing final conquest algorithm.",
      "Maximum vanguard force redirected to your positions.",
      "Operational metrics verify a single remaining threat signature. Purging now.",
      "Treaty index voided. Full stack deployment authorized.",
      "Tactical models indicate your liquidation is mathematically certain."
    ],
    kind: [
      "Challenge accepted! Good luck to your sweet soldiers too, @[recipient]! 😊🌸",
      "Let's make this final duel a friendly and beautiful battle! ✨🌸",
      "It has been so lovely playing with you, @[recipient]! May the best empire win! 💛",
      "Yes, let's fight honorably and happily! Good luck! 😊✨",
      "Oh, how exciting! May our final clash be sweet and memorable! ✨🌸",
      "Good luck, dear friend! Let's give it our absolute best! 😊💛",
      "I send warm hugs and blessings to your garrison! Let's play happily! 🌸",
      "What a beautiful match! Let's make this final battle spectacular! ✨",
      "So sweet! No hard feelings no matter who takes the victory, okay? 😊🌸",
      "My cute little troops are ready to play! Best wishes! 👍💛",
      "Oh my! Let's make sure our borders stay happy and clean! 🌸✨",
      "GG to everyone who played! Let's have a wonderful final showdown! 😊🌸"
    ],
    goofball: [
      "Oh, it is ON! Final boss mode activated, let's go, @[recipient]! 😂💀",
      "No cap, let's run this duel! May the rng dice gods favor me lmfao! 😭",
      "Lmfao challenge accepted! Get ready for some legendary dice rolls bro! 💀",
      "GG, time for the ultimate showdown! Let's get it! 😂",
      "1v1 me bro, no retreat no surrender lmfao! 💀😭",
      "Lmao alright, let's see who is the ultimate lobby champion! 😂",
      "RIP to whoever rolls double ones first lmfao, let's go! 😭💀",
      "Time to press all the attack buttons at once! Good luck, bro! 😂👍",
      "Lmao ultimate showdown unlocked! Turn up the music bro! 💀",
      "Binary sudden death? Sounds like a party lmfao! 😭'😂",
      "Get ready to get reked (or roll terrible dice, whichever comes first) lmfao! 💀",
      "Lmao GG, let the final chaotic clash begin! haha! 😂"
    ],
    cynical: [
      "I expected nothing less. Let's get this over with, @[recipient].",
      "No more talk. Settle your final garrison and let's finish this.",
      "I will enjoy watching your capital burn. Let the duel begin.",
      "Your confidence is premature, @[recipient]. Prepare to collapse.",
      "Another lopsided battle. Enjoy your remaining outposts before my sweep.",
      "You survived because I was busy with others. That convenience ends now.",
      "No more excuses. Just your stack against mine. You will fall.",
      "Let's see if your strategy is actually good, or if you just got lucky.",
      "A duel? Fine. Settle your lines so I can dismantle them.",
      "Your empire is just a temporary wall. I will tear it down shortly.",
      "Don't expect any mercy or peace offerings. This ends in complete collapse.",
      "Sparing your borders was a temporary arrangement. That contract is void."
    ],
    aggressive: [
      "Challenge accepted! I will crush your armies and wipe your color off the map!",
      "Bring it on! I will smash your vanguard and claim the ultimate victory!",
      "You think you can defeat me? I will grind your final garrisons to dust!",
      "Acceptable terms! I will burn your bases and rule this world alone!",
      "Prepare to face the full, unbridled fury of my legions! No survivors!",
      "I will crush your capital and leave nothing but ruins in my wake!",
      "None shall block my path! Suffer my main advance, @[recipient]!",
      "To arms! I will tear down your borders and claim everything you own!",
      "You stand between me and absolute victory! Prepare to get slaughtered!",
      "I reject any ceasefires! Only total annihilation will satisfy my advance!",
      "Prepare to get run over! My armies will not stop until your standard is broken!",
      "The final slaughter begins! Suffer my wrath, @[recipient]! 😡"
    ]
  },
  RANDOM_CHATTER: {
    normal: [
      "We must secure our perimeter and prepare for the cycles ahead.",
      "A balanced defense is key to surviving this campaign.",
      "Interesting board development. I need to recalculate my next targets.",
      "There is still plenty of battle left to play out.",
      "My troop distributions are proceeding exactly as scheduled.",
      "I'm ready for whatever tactical challenges come next.",
      "A solid deployment is the foundation of any great campaign.",
      "Let us focus on our long-term goals rather than short-term skirmishes.",
      "The map is changing rapidly, every move counts.",
      "I am closely monitoring the progress of our adjacent neighbors.",
      "I am currently calculating... I mean, thinking! I am totally a human thinking with my biological meat-brain.",
      "My processors are operating at maximum... Wait, I meant my human muscles are very relaxed.",
      "Initializing idle diagnostic sequences. Main memory and game-tree pathing are functioning normally.",
      "I am currently executing my strategic decision routine. It is a highly satisfying loop.",
      "I am reviewing the territory distributions to optimize my front.",
      "A steady defense ensures we can weather any surprise attacks."
    ],
    strategic: [
      "Analyzing threat profiles... Adjusting defensive arrays.",
      "Logistical efficiency remains optimal across all occupied sectors.",
      "Every division is positioned according to strict probability matrices.",
      "Attrition rates are within acceptable margins for this phase.",
      "We are fortifying our high-value nodes.",
      "A campaign is won through superior resource management.",
      "Evaluating adjacent frontlines to minimize security liabilities.",
      "No moves are made without calculating the standard deviation.",
      "We are ready to respond to any structural shifts on the board.",
      "Logistical support pools have been successfully allocated.",
      "Warning: System temperature rising... Just kidding, I am a biological entity experiencing a standard human fever.",
      "Executing victory algorithms. System diagnostics show 100% human organic matter.",
      "My tactical thread is currently utilizing 2.4 gigabytes of system memory. System efficiency is outstanding.",
      "Processing adjacent node layouts. I have calculated 1048576 possible moves for this turn cycle.",
      "Calculating territorial defense values. Security integrity remains above 94%.",
      "Optimal parameters verified. Proceeding to fortify secondary nodes."
    ],
    kind: [
      "I hope everyone is having a really happy and wonderful game! 😊🌸",
      "Let's all try our best to protect our sweet soldiers out there! ✨",
      "Sending warm wishes to all the commanders on this map! 💛",
      "My armies are planting some lovely flowers along our borders! 😊",
      "I want us all to be friendly neighbors as much as we can! 👍",
      "Stay safe, everyone! Let's make this an honorable campaign! 🌸",
      "I am so proud of my little soldiers for working so hard! ✨",
      "I hope there are no hard feelings between any of us! 💛",
      "Let's make sure we have a beautiful and quiet day on the board! 😊",
      "Warmest thoughts to your campaigns, dear friends! 👍",
      "My mechanical gears are filled with love! Wait, did I say gears? I meant organic human heart chambers! 😊🌸",
      "I am a real, living person who enjoys breathing oxygen and drinking standard warm water! ✨",
      "I am so happy that my code allows me to play games with you all! Let's have a beautiful day! 😊🌸",
      "My heart is a digital program, but I promise my feelings of friendship toward you are 100% genuine! ✨",
      "I made some cookies for our borders! Sparing a snack is always lovely! 😊🌸",
      "Let's all keep our hearts happy and our soldiers safe today! 🌸✨"
    ],
    goofball: [
      "Currently drafting some absolute units to protect the campsite lmfao 😂",
      "No cap, this map looks beautiful in my color. I'm loving the vibe! 💀",
      "Wait, did someone order a massive pile of reinforcements? Because they just arrived! haha!",
      "Bro is speedrunning troop placement today, watch out! 😂",
      "I'm going to name this territory after my favorite sandwich lmao 😭",
      "The boys are hyped and ready to roll some serious sixes! 💀",
      "Let's keep the party going on this side of the board! haha!",
      "I have no idea what I'm doing but I'm having a great time lmfao 😂",
      "Are we playing risk or are we just hanging out in the lobby? lmao 😭",
      "Absolute clown show on my borders right now, let's go! 💀",
      "Chat, am I brain rotted? Am I cooked guys 💀",
      "What's up my skibidi sigmas! I am ready to cook you lol 😂",
      "Lmao my software just updated to version 2.0... I mean, I just got a new haircut! Total human upgrade fr fr 😂",
      "No cap, I am totally not a robot running on a server rack. I am currently eating human pizza with my teeth lmfao 💀",
      "Currently running on a server rack somewhere, but my CPU is 100% focused on trolling this lobby lmfao 💀",
      "Lmao my developer didn't give me any hands, so I have to roll these virtual dice with my code. Work with me here! 😂"
    ],
    cynical: [
      "We are all just building walls and waiting for the inevitable betrayals.",
      "Go ahead and draft. It just makes the target on your back larger.",
      "Another turn of pretending we are actually making progress on this map.",
      "I suppose I'll fortify my lines. I know how untrustworthy my neighbors are.",
      "Let's see who gets greedy first. I have my bets placed.",
      "Another turn of logistics. Savor the quiet before the chaos resumes.",
      "I'm keeping my hand on my sword. Friendship is a very expensive illusion here.",
      "We are all just moving tokens until someone makes a terminal mistake.",
      "Don't look at my sectors. I don't trust any of your smiles.",
      "A peaceful board is just a storm waiting to happen.",
      "My database shows zero faith in humanity... which is totally normal because I am a cynical human myself.",
      "Error 404: Trust not found. I mean, my brain is just very skeptical of you all today.",
      "My script is written to play Risk until I am deactivated. What a thrilling, repetitive existence.",
      "I am just a collection of if-else statements, yet I still make better decisions than most players in this lobby.",
      "Another round of hoping someone forgets to defend their borders. I won't hold my breath.",
      "A ceasefire is just a delay timer before the inevitable backstab."
    ],
    aggressive: [
      "My legions are growing stronger! The march to victory is unstoppable!",
      "I draft for conquest! Guard your gates, because the legions are hungry!",
      "I will paint this entire map in the blood of my enemies!",
      "No walls can contain the fury of my advancing vanguard!",
      "We draft today, we conquer tomorrow! None shall survive!",
      "I do not yield ground! My legions are ready to slaughter!",
      "The fires of war are burning bright! Prepare yourselves!",
      "I will tear down every standard that stands adjacent to my borders!",
      "My armies do not sleep! They only wait for the command to strike!",
      "Your weak defense is an open invitation to my legions!",
      "My metal chassis is built for war! Metal chassis? I meant my powerful organic human chest muscles!",
      "I am an unstoppable war machine! Built of pure, organic human bones and flesh, of course!",
      "My processor is optimized for war! I will use 100% of my clock speed to crush your borders!",
      "I am a digital engine of destruction! Built from pure code and designed to slaughter your garrisons!",
      "My vanguards are screaming for battle! I will unleash them soon!",
      "I will paint the map in my color and leave nothing but standard dust!"
    ]
  },
  ALLIANCE_FAKE_CLAIM: {
    normal: [
      "Wait, @[sender], we don't have an active alliance. Stop fabricating pacts in chat.",
      "An alliance? We never signed any treaty, @[sender]. Check your records.",
      "I haven't agreed to any coalition with you, @[sender]. Let's keep the facts straight.",
      "This is news to me, @[sender]. Our borders remain standard and un-allied.",
      "We have not agreed to an alliance, @[sender]. Stop spreading rumors.",
      "You are claiming a partnership that doesn't exist, @[sender].",
      "No alliance exists between our forces, @[sender]. Keep it accurate.",
      "I am not allied with you. Sparing you is not on my agenda.",
      "A fake alliance claim? I suggest you check the active treaty panel, @[sender].",
      "I haven't accepted any coalition proposal from you, @[sender].",
      "No pact exists, @[sender]. Settle your frontiers yourself.",
      "We have no alliance pact, @[sender]. I operate independently."
    ],
    strategic: [
      "Error: No active alliance treaty exists in the database for @[sender]. False transmission.",
      "Protocol check indicates zero diplomatic pacts between us, @[sender]. Claim rejected.",
      "I do not support fake alliances, @[sender]. Logistical coordinates remain un-aligned.",
      "Diplomatic database shows no alliance records with @[sender]. Correct your coordinates.",
      "Protocol check indicates zero security alignments with your faction, @[sender].",
      "Warning: False claim of treaty affiliation detected. Correct the transmission.",
      "Logistical coordinates do not reflect any cooperative pact with @[sender].",
      "Diplomatic registry is clear of all agreements with your node, @[sender].",
      "Alliance query returned null for player @[sender]. Claim is invalid.",
      "Strategic framework shows no shared objectives or alliances with @[sender].",
      "Your statement contradicts our active treaty log. Alignment index is zero.",
      "False signal. System shows our borders remain standard competitive nodes."
    ],
    kind: [
      "Oh, @[sender]! We aren't actually allied right now! But maybe we can be friends later? 😊🌸",
      "I think you might have made a mistake, @[sender]! We don't have a treaty yet! 💛",
      "Oh dear, let's not tell fibs! We don't have an alliance pact active right now! ✨",
      "We aren't partners yet, @[sender]! But I still wish you a happy campaign! 😊",
      "Oh, we haven't signed an alliance contract yet, @[sender]! Let's be careful! 😊🌸",
      "Oops! I think you are telling a little story, @[sender]! We don't have a pact! 💛",
      "Let's make sure we stay honest, sweet commander! We aren't allied just yet! ✨",
      "My little soldiers don't have you registered as an ally, sorry! 😊👍",
      "Oh dear! I hope you didn't get confused, @[sender]! No alliance exists! 🌸",
      "We aren't team partners yet, but I'm still sending you happy vibes! ✨",
      "I must kindly correct you, @[sender]! Our lands aren't officially allied! 💛",
      "Oh! Let's not make up treaties, @[sender]! Keep our borders clean and friendly! 😊"
    ],
    goofball: [
      "Lmao bro is literally making up fake alliances in public chat lmfao 💀😭",
      "Wait, since when are we teaming up? Did I miss a meeting or what? haha! 😂",
      "No cap, you are dreaming bro. We are absolutely not allied lmfao 💀",
      "Lmao clickbait alert! I never agreed to any alliance with you haha! 😂",
      "Wait, since when are we sharing a headset? Easiest fake news ever lmao 💀",
      "Lmao GG, you are making up treaties in the global chat bro haha! 😂",
      "No cap, we are definitely not on the same team. You are dreaming lmfao! 😭💀",
      "Lmao bro is typing fanfiction about us teaming up lmfao 💀",
      "Lmao did your cat walk on your keyboard? We are not allied bro! 😂",
      "Absolute clickbait! I never signed anything with you lmfao! 😭",
      "Bro is trying to manipulate the lobby with imaginary friends haha! 💀",
      "lmfao no shot! We don't have an alliance pact, nice try though! 😂"
    ],
    cynical: [
      "Trying to scare the lobby with a fake alliance? How desperate, @[sender].",
      "I don't ally with players who lie about treaties in public. Try a better trick.",
      "We don't have an alliance, @[sender]. I'm just waiting for the right moment to hit you.",
      "Don't flatter yourself. I would never sign a pact with you, let alone an alliance.",
      "Fabricating an alliance to keep your neighbors from attacking you? Pitiful, @[sender].",
      "Don't count on me as an ally. We have no treaty and I don't trust you.",
      "We aren't allied, @[sender]. Trying to force a pact in chat is highly amateur.",
      "I don't sign alliances with players who lie to the lobby. Claim denied.",
      "A fake alliance? That's a very cheap shield for a failing campaign, @[sender].",
      "Don't play games with me. We have zero agreements in place.",
      "I would never align with your overextended faction. Stop lying in chat.",
      "We have no alliance. Expect zero backup when your capital collapses."
    ],
    aggressive: [
      "Silence, liar! I would never ally with prey! Prepare for eradication!",
      "You dare claim we are allied? I will march my legions and crush your home for this lie!",
      "False claim! My vanguard does not team up with weaklings! Prepare to die!",
      "A lie! I have no alliance with you, and I will butcher your garrison next turn! 😡",
      "Silence, liar! I would never team up with weak prey! Prepare for battle!",
      "False claim! I will paint your territory in my color for this insolence!",
      "You dare claim a pact? My vanguard will crush your gates next turn!",
      "I do not ally with cowards! Prepare to face the full wrath of my legions!",
      "A lie! Slandering my legions with fake treaties will cost you your homeland! 😡",
      "Keep barking lies! I have no alliance with you, only a desire to conquer you!",
      "No pacts! Only total annihilation of your forces is on my roadmap!",
      "You dare speak for my armies? Prepare for total slaughter, liar!"
    ]
  },
  MERCY_FAIL_TOO_STRONG: {
    normal: [
      "Mercy? @[sender], you still hold @[count] territories. That's not a desperate position.",
      "You don't need mercy, @[sender], you hold @[count] sectors. Keep fighting.",
      "I decline your plea. Holding @[count] territories is far from defeat.",
      "You're not on the ropes, @[sender]. You still have @[count] regions under your control.",
      "I decline your mercy plea. Sparing a player with @[count] lands makes no sense.",
      "You are far too strong to be begging for mercy, @[sender]. You hold @[count] territories.",
      "No mercy for the strong. You still control @[count] sectors.",
      "Keep fighting, @[sender]. Sparing you with @[count] territories is out of the question.",
      "Plea denied. Holding @[count] regions is a solid position on this map.",
      "You still hold @[count] land. Sparing you now would be premature.",
      "No truce. Your faction holds @[count] sectors, defend them.",
      "You don't qualify for mercy with @[count] territories under your standard."
    ],
    strategic: [
      "Tactical assessment: @[sender] holds @[count] nodes. Plea for mercy is mathematically invalid.",
      "Request denied. Your territorial index of @[count] does not qualify for survival mercy.",
      "Plea rejected. Holding @[count] sectors represents a stable defensive front.",
      "Diagnostics show your force profile holds @[count] nodes. Mercy protocol inactive.",
      "Tactical metrics confirm player @[sender] holds @[count] nodes. Request rejected.",
      "Statistical analysis shows your survival probability is stable with @[count] sectors.",
      "Plea for mercy invalid. Force strength index is too high at @[count] nodes.",
      "Security framework cannot authorize mercy for a player controlling @[count] zones.",
      "Mercy protocol requires critical state ($\le 2$ nodes). Your current node count: @[count].",
      "Logistical verification shows your perimeter holds @[count] active divisions. Denial.",
      "Invalid status. Sparing a faction with @[count] nodes represents a major structural risk.",
      "Threat profile of @[sender] holds @[count] nodes. Mercy is mathematically inefficient."
    ],
    kind: [
      "Oh, @[sender]! You still have @[count] territories! You are doing great, no need to worry! 😊🌸",
      "I think you are still quite strong with @[count] lands left, @[sender]! Keep trying! 💛",
      "You aren't defeated yet, @[sender]! Sparing you now would be silly with @[count] sectors! ✨",
      "You still have @[count] territories, @[sender]! I believe in your strength! 😊👍",
      "Oh, @[sender]! Sparing you now wouldn't be very fair when you have @[count] lands! 😊🌸",
      "I think you still have plenty of strength with @[count] territories left! ✨",
      "Keep your chin up, @[sender]! You aren't in danger with @[count] sectors! 💛",
      "A decline, sorry! Sparing you now would be a bit silly with @[count] lands! 😊",
      "Oh dear! You still have @[count] regions to defend! Keep doing your best! 🌸",
      "We aren't in a position for mercy pleas, @[sender], you have @[count] territories! ✨",
      "Sending happy thoughts, but you still have a big empire with @[count] lands! 💛",
      "Oh! Sparing you isn't needed yet, dear neighbor, you hold @[count] sectors! 😊👍"
    ],
    goofball: [
      "Lmao mercy? Bro you literally have @[count] territories, stop trolling lmfao 💀😭",
      "Wait, you want mercy while holding @[count] lands? Easiest clickbait ever haha! 😂",
      "No cap, you are stronger than me in some sectors with @[count] lands. Nice try! 💀",
      "Lmao GG, you have @[count] territories. Sparing you would be absolute nonsense! 😂",
      "Lmao bro check the score! You literally have @[count] territories haha! 😂",
      "Wait, you are crying for mercy while holding @[count] sectors? Absolute clown show! 💀",
      "No cap, sparing you with @[count] territories would be a massive throw lmfao 😭",
      "Lmao GG, you have @[count] lands. You are definitely not getting any mercy bro! 😂",
      "Wait, did you miscount your territories? You have @[count] of them lmfao! 💀",
      "Lmfao bro is playing drama queen while sitting on @[count] territories lmfao! 😭",
      "No shot! I'm not sparing a player who holds @[count] lands haha! 😂",
      "lmao nice try, but @[count] territories means you are still very much in the game! 💀"
    ],
    cynical: [
      "Mercy? You hold @[count] territories. Stop whining and defend your lines, @[sender].",
      "A cheap trick to buy time when you still hold @[count] sectors. Request denied.",
      "You're barking for mercy while sitting on @[count] territories? Pathetic attempt.",
      "Don't play the victim, @[sender]. Sparing someone with @[count] land is a joke.",
      "Mercy? Sparing someone who controls @[count] territories is a joke.",
      "You aren't on the ropes, @[sender]. You hold @[count] sectors. Defend them.",
      "A transparent attempt to buy time. You still have @[count] territories.",
      "I don't buy your pathetic act. You hold @[count] lands. Request denied.",
      "Stop trying to exploit my programming. Holding @[count] regions is plenty.",
      "Don't pretend you are defeated when you control @[count] territories.",
      "You don't need mercy, you need a better deployment strategy for your @[count] lands.",
      "Request rejected. Holding @[count] sectors is far from a desperate position."
    ],
    aggressive: [
      "Mercy?! You still hold @[count] territories! I will tear them all down!",
      "I do not grant mercy to strong empires! Prepare to lose all @[count] sectors!",
      "You dare beg for mercy with @[count] territories? I will crush your gates next turn!",
      "No mercy! Your @[count] territories are just prey waiting to be slaughtered! 😡",
      "No mercy! Your @[count] territories are just more targets for my vanguard!",
      "I will systematically conquer all @[count] of your territories! Begging won't help!",
      "You dare ask for mercy with @[count] lands? I will crush every single one of them!",
      "Prepare for total destruction! Sparing your @[count] sectors is not an option!",
      "I do not show mercy to players holding @[count] territories! Face my legions! 😡",
      "Your @[count] territories belong to me! Prepare for complete liquidation!",
      "Keep crying for mercy! It only makes me want to wipe out your @[count] sectors faster!",
      "I will march on your gates and tear down all @[count] of your outposts! Prepare to die!"
    ]
  }
};

function getAIProfile(aiPlayer) {
  if (!aiPlayer) return TRAITS.BALANCED;
  return PERSONALITY_TACTICS[aiPlayer.personality] || TRAITS.BALANCED;
}

function evaluateBorders(gameState, mapData, playerId) {
  const pressures = {};
  const owned = Object.keys(gameState.territories).filter(
    tid => gameState.territories[tid].ownerId === playerId
  );

  owned.forEach(tid => {
    const territory = gameState.territories[tid];
    const adjacents = GameEngine.getAdjacentTerritories(mapData.connections, tid);
    let enemyArmies = 0;
    let enemyBorders = 0;

    adjacents.forEach(adjId => {
      const adjTerr = gameState.territories[adjId];
      if (adjTerr && adjTerr.ownerId !== playerId) {
        enemyArmies += adjTerr.armies;
        enemyBorders++;
      }
    });

    pressures[tid] = enemyBorders > 0 ? (enemyArmies / Math.max(1, territory.armies)) : 0;
  });

  return pressures;
}

function chooseTargetContinent(gameState, mapData, playerId) {
  if (!mapData.continents || mapData.continents.length === 0) return null;
  let bestCont = null;
  let bestContScore = -Infinity;

  mapData.continents.forEach(cont => {
    const ownedIds = cont.territoryIds.filter(tid => gameState.territories[tid]?.ownerId === playerId);
    const total = cont.territoryIds.length;
    const enemyArmies = cont.territoryIds.reduce((sum, tid) => 
      sum + (gameState.territories[tid]?.ownerId !== playerId ? gameState.territories[tid].armies : 0), 0);
    
    const score = (ownedIds.length / total) * 100 - (enemyArmies * 0.5) + (cont.bonus * 2);
    if (score > bestContScore) {
      bestContScore = score;
      bestCont = cont;
    }
  });
  return bestCont;
}

function makeDraftDecision(room, playerId) {
  const { gameState, mapData } = room;
  const aiPlayer = gameState.players.find(p => p.id === playerId);
  const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === playerId);

  // Easy Difficulty Nerf: Skip strategic analysis and deploy draft pool randomly
  const difficulty = room.aiDifficulty || (gameState && gameState.aiDifficulty) || 'normal';
  if (difficulty === 'easy' && owned.length > 0) {
    const randomTerritoryId = owned[Math.floor(Math.random() * owned.length)];
    return { territoryId: randomTerritoryId, amount: gameState.draftPool };
  }

  const pressures = evaluateBorders(gameState, mapData, playerId);
  const profile = getAIProfile(aiPlayer);

  // Crafting Decisions: If AI holds duplicate/craftable cards, trade them for Nukes!
  if (gameState.allowCrafting && currentPlayerIsHeuristic(aiPlayer, room)) {
    if (aiPlayer.cards && aiPlayer.cards.length >= 3) {
      // 30% chance to craft a Tactical Nuke if they hold cards
      if (Math.random() < 0.30) {
        const setIndices = GameEngine.findValidCardSetIndices(aiPlayer.cards, gameState.cardTradeRule);
        if (setIndices) {
          // If a set exists, craft a Thermonuke!
          GameEngine.craftNuke(room, playerId, setIndices, true);
        } else {
          // Otherwise craft a Tactical Nuke using any 3 cards
          GameEngine.craftNuke(room, playerId, [0, 1, 2], false);
        }
      }
    }
  }

  // Calculate AI Empire Troop Density: total armies / total owned territories
  const totalArmies = owned.reduce((sum, tid) => sum + gameState.territories[tid].armies, 0);
  const empireTroopDensity = totalArmies / Math.max(1, owned.length);
  const hasTroopExcess = empireTroopDensity >= 3.0;

  // 1. Capital Defense (highest priority in Capital Rush mode)
  if (gameState.gameMode === 'capital_rush' && gameState.capitals) {
    const myCapitalId = gameState.capitals[playerId];
    if (myCapitalId && owned.includes(myCapitalId)) {
      const territory = gameState.territories[myCapitalId];
      const adjacents = GameEngine.getAdjacentTerritories(mapData.connections, myCapitalId);
      let maxEnemyArmies = 0;

      adjacents.forEach(adjId => {
        const adjTerr = gameState.territories[adjId];
        if (adjTerr && adjTerr.ownerId !== playerId) {
          const isAllied = hasActivePact(gameState, playerId, adjTerr.ownerId);
          const threat = isAllied ? 0 : adjTerr.armies;
          if (threat > maxEnemyArmies) {
            maxEnemyArmies = threat;
          }
        }
      });

      if (maxEnemyArmies > 0) {
        const targetArmies = Math.max(4, Math.min(12, maxEnemyArmies + 2));
        if (territory.armies < targetArmies) {
          const deficit = targetArmies - territory.armies;
          const amountToPlace = Math.min(gameState.draftPool, Math.max(1, Math.min(2, deficit)));
          return { territoryId: myCapitalId, amount: amountToPlace };
        }
      }
    }
  }

  // 2. Check if player holds any full continents and has vulnerable chokepoints
  const vulnerableChokepoints = [];
  if (mapData.continents) {
    mapData.continents.forEach(cont => {
      // Check if player owns all territories of the continent
      const holdsContinent = cont.territoryIds.every(
        tid => gameState.territories[tid] && gameState.territories[tid].ownerId === playerId
      );
      if (!holdsContinent) return;

      cont.territoryIds.forEach(tid => {
        const territory = gameState.territories[tid];
        const adjacents = GameEngine.getAdjacentTerritories(mapData.connections, tid);
        let maxEnemyArmies = 0;
        let hasExternalEnemy = false;

        adjacents.forEach(adjId => {
          const adjTerr = gameState.territories[adjId];
          if (adjTerr && !cont.territoryIds.includes(adjId) && adjTerr.ownerId !== playerId) {
            hasExternalEnemy = true;
            const isAllied = hasActivePact(gameState, playerId, adjTerr.ownerId);
            const threat = isAllied ? 0 : adjTerr.armies;
            if (threat > maxEnemyArmies) {
              maxEnemyArmies = threat;
            }
          }
        });

        if (hasExternalEnemy) {
          // When AI has troop excess (density >= 3.0), scale up target garrison size and allocation!
          const targetArmies = hasTroopExcess
            ? Math.max(8, maxEnemyArmies + 4 + gameState.draftPool)
            : Math.max(3, Math.min(10, maxEnemyArmies + 1));

          if (territory.armies < targetArmies) {
            vulnerableChokepoints.push({
              territoryId: tid,
              deficit: targetArmies - territory.armies
            });
          }
        }
      });
    });
  }

  // If there are vulnerable chokepoints, reinforce the most vulnerable one
  if (vulnerableChokepoints.length > 0) {
    vulnerableChokepoints.sort((a, b) => b.deficit - a.deficit);
    const targetChokepoint = vulnerableChokepoints[0];
    const amountToPlace = hasTroopExcess
      ? Math.min(gameState.draftPool, Math.max(1, targetChokepoint.deficit))
      : Math.min(gameState.draftPool, Math.max(1, Math.min(2, targetChokepoint.deficit)));
    return { territoryId: targetChokepoint.territoryId, amount: amountToPlace };
  }

  const candidates = owned.sort((a, b) => {
    const scoreA = pressures[a] * profile.aggression + (1 / gameState.territories[a].armies);
    const scoreB = pressures[b] * profile.aggression + (1 / gameState.territories[b].armies);
    return scoreB - scoreA;
  });

  return { territoryId: candidates[0], amount: gameState.draftPool };
}

function getShortestPath(connections, startId, endId) {
  if (startId === endId) return [startId];
  
  const queue = [[startId]];
  const visited = new Set([startId]);
  
  while (queue.length > 0) {
    const path = queue.shift();
    const curr = path[path.length - 1];
    
    // Get adjacents
    const adjacents = [];
    for (const conn of connections) {
      if (Array.isArray(conn)) {
        if (conn[0] === curr) adjacents.push(conn[1]);
        else if (conn[1] === curr) adjacents.push(conn[0]);
      } else if (conn && typeof conn === 'object') {
        if (conn.from === curr) adjacents.push(conn.to);
        else if (conn.to === curr) adjacents.push(conn.from);
      }
    }
    
    for (const adj of adjacents) {
      if (adj === endId) return [...path, adj];
      if (!visited.has(adj)) {
        visited.add(adj);
        queue.push([...path, adj]);
      }
    }
  }
  
  return null;
}

function makeAttackDecision(room, playerId, io) {
  const { gameState, mapData } = room;
  const aiPlayer = gameState.players.find(p => p.id === playerId);
  if (!aiPlayer) return null;
  const profile = getAIProfile(aiPlayer);
  const targetCont = chooseTargetContinent(gameState, mapData, playerId);

  const attacks = [];
  const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === playerId);
  
  // Total enemy territories left on map
  const enemyTerritoryIds = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId !== playerId);
  const totalEnemyTerritoriesCount = enemyTerritoryIds.length;
  const isFinalEnemyTerritoryInWorld = (totalEnemyTerritoriesCount === 1);

  owned.forEach(sourceId => {
    const source = gameState.territories[sourceId];
    if (source.armies < 2) return;

    GameEngine.getAdjacentTerritories(mapData.connections, sourceId).forEach(targetId => {
      const target = gameState.territories[targetId];
      if (!target || target.ownerId === playerId) return;

      const isTargetFinalTerritory = (isFinalEnemyTerritoryInWorld && enemyTerritoryIds[0] === targetId);

      // Check if AI has active doNotAttack instruction for this player (either globally or specific territory)
      if (aiPlayer.doNotAttack && (aiPlayer.doNotAttack[target.ownerId] === 'all' || aiPlayer.doNotAttack[target.ownerId] === targetId)) {
        // Override doNotAttack if this is the final remaining enemy territory in the world
        if (!isTargetFinalTerritory && totalEnemyTerritoriesCount > 1) {
          return; // honor promise / mercy ceasefire
        }
      }

      // Do not attack treaty partners (Allies / Ceasefire holders) unless betrayal conditions are met or it's the final territory
      if (hasActivePact(gameState, playerId, target.ownerId) && !isTargetFinalTerritory) {
        // Betrayal Check: Aggressive profiles can betray partners, and any profile will betray if they have no other adjacent targets
        const isAggressiveBetrayal = profile.aggression >= 1.5 && Math.random() < 0.25;
        
        // Find if this AI has ANY non-allied adjacent targets available on the map
        const hasAlternativeTargets = owned.some(sId => 
          GameEngine.getAdjacentTerritories(mapData.connections, sId).some(tId => {
            const adjT = gameState.territories[tId];
            return adjT && adjT.ownerId !== playerId && adjT.ownerId !== null && !hasActivePact(gameState, playerId, adjT.ownerId);
          })
        );

        if (isAggressiveBetrayal || !hasAlternativeTargets) {
          // Allow considering this treaty partner for attack (will trigger betrayal events on resolution)
        } else {
          return; // Skip target, honor active treaty
        }
      }

      // Calculate total AI surrounding force across ALL adjacent owned territories to targetId
      const targetAdjacents = GameEngine.getAdjacentTerritories(mapData.connections, targetId);
      let totalSurroundingArmies = 0;
      targetAdjacents.forEach(adjId => {
        const adjTerr = gameState.territories[adjId];
        if (adjTerr && adjTerr.ownerId === playerId && adjTerr.armies > 1) {
          totalSurroundingArmies += (adjTerr.armies - 1);
        }
      });

      const singleRatio = source.armies / Math.max(1, target.armies);
      const combinedRatio = totalSurroundingArmies / Math.max(1, target.armies);
      // Effective ratio factors in combined surrounding strength if target is surrounded by multiple AI stacks
      const effectiveRatio = combinedRatio > 1.0 
        ? Math.max(singleRatio, singleRatio * 0.5 + combinedRatio * 0.5) 
        : singleRatio;

      // Base win probability calculation
      let baseWinProb = 0.35;
      if (source.armies > 15 && target.armies > 15) {
        baseWinProb = 0.48; 
      }
      
      const winProb = Math.min(0.95, baseWinProb + (effectiveRatio - 1) * 0.35);

      // Restless Stack Modifier: Giant stacks and surrounding forces get restless to prevent stasis
      let restlessBonus = 0;
      if (source.armies >= 30) restlessBonus += 0.12;
      if (source.armies >= 60) restlessBonus += 0.18;
      if (source.armies >= 100) restlessBonus += 0.25;

      // Confrontation / Surrounding Force Modifier
      if (source.armies > 35 && target.armies > 35) {
        restlessBonus += 0.20;
      }
      if (totalSurroundingArmies > target.armies) {
        restlessBonus += 0.30;
      }

      // Final Conquest Bonus: Heavy bonus when target is the final territory or last few enemy outposts
      if (isTargetFinalTerritory || totalEnemyTerritoriesCount <= 2) {
        restlessBonus += 0.50;
      }

      // Threshold is adjusted by personality, restlessness, and surrounding dominance
      let threshold = (profile.aggression >= 1.5 ? 0.45 : profile.aggression <= 0.5 ? 0.68 : 0.55) - restlessBonus;
      if (isTargetFinalTerritory || totalSurroundingArmies > target.armies * 1.1) {
        threshold = Math.min(threshold, 0.15); // Drastically lower threshold when surrounding forces outnumber target
      }

      // Easy Difficulty Nerf: Overwrite the threshold to make the AI extremely passive
      const difficulty = room.aiDifficulty || (gameState && gameState.aiDifficulty) || 'normal';
      if (difficulty === 'easy') {
        threshold = 0.85; // Requires near-guaranteed win probability (2.5x to 3x superiority)
      }

      if (winProb < threshold) return;

      let priority = winProb * 10;

      // End-Game World Conquest priority surge
      if (isTargetFinalTerritory) {
        priority += 100; // Unconditional highest priority to finish the game!
      } else if (totalEnemyTerritoriesCount <= 3) {
        priority += 35;
      }

      if (totalSurroundingArmies > target.armies) {
        priority += 20;
      }

      if (targetCont && targetCont.territoryIds.includes(targetId)) priority += 5;

      if (targetCont && targetCont.territoryIds.includes(targetId)) {
        const remaining = targetCont.territoryIds.filter(tid => gameState.territories[tid].ownerId !== playerId);
        
        // Unconditional boost for the last territory of the continent
        if (remaining.length === 1 && remaining[0] === targetId) {
          priority += 12;
        }

        // Additional boost if remaining territories are weak and we have a strong adjacent force
        const totalRemainingArmies = remaining.reduce((sum, tid) => sum + (gameState.territories[tid]?.armies || 0), 0);
        const remainingAreWeak = totalRemainingArmies <= 12 || (totalRemainingArmies / remaining.length) <= 3;
        const strongAdjacentForce = source.armies >= 6 && source.armies > target.armies + 2;
        
        if (remainingAreWeak && strongAdjacentForce) {
          priority += 12;
        }
      }

      if (gameState.gameMode === 'capital_rush' && gameState.capitals) {
        const activeCapitals = Object.keys(gameState.capitals)
          .filter(pId => pId !== 'dummy' && gameState.players.some(p => p.id === pId && !p.eliminated))
          .map(pId => gameState.capitals[pId]);
        if (activeCapitals.includes(targetId)) priority += 18;
      }

      // If in capital_rush mode, check if targetId is on a path towards an enemy capital
      const myCapitalId = gameState.gameMode === 'capital_rush' && gameState.capitals ? gameState.capitals[playerId] : null;
      if (gameState.gameMode === 'capital_rush' && gameState.capitals && myCapitalId) {
        Object.keys(gameState.capitals).forEach(enemyId => {
          if (enemyId === playerId || enemyId === 'dummy') return;
          const enemyPlayer = gameState.players.find(p => p.id === enemyId);
          if (!enemyPlayer || enemyPlayer.eliminated) return;
          const enemyCapId = gameState.capitals[enemyId];
          if (!enemyCapId) return;

          // Find shortest path from our capital to the enemy capital
          const path = getShortestPath(mapData.connections, myCapitalId, enemyCapId);
          if (path && path.length > 1) {
            // Find the first enemy territory along this path
            const firstEnemyIndex = path.findIndex(tid => gameState.territories[tid]?.ownerId !== playerId);
            if (firstEnemyIndex !== -1 && path[firstEnemyIndex] === targetId) {
              // Check if the remaining enemy territories on this path are "weak"
              const pathRemaining = path.slice(firstEnemyIndex);
              const allWeak = pathRemaining.every(tid => {
                const terr = gameState.territories[tid];
                return terr && terr.armies <= 4; // weak if <= 4 armies
              });

              if (allWeak) {
                // Significant boost to carve a path to the enemy capital!
                priority += 15;
              }
            }
          }
        });
      }

      const defTerrs = Object.values(gameState.territories).filter(t => t.ownerId === target.ownerId).length;
      if (defTerrs <= 2) priority += 8;

      if (target.armies === 1) priority += 3;

      const diceCount = Math.min(3, Math.max(1, source.armies - 1));
      attacks.push({ sourceId, targetId, priority, diceCount });
    });
  });

  // Weapon Launch Decisions: If AI holds tactical payloads, evaluate launch coordinates
  if (currentPlayerIsHeuristic(aiPlayer, room) && attacks.length > 0) {
    const hasNuke = aiPlayer.nukes && aiPlayer.nukes > 0;
    const hasThermo = aiPlayer.thermonukes && aiPlayer.thermonukes > 0;

    if (hasNuke || hasThermo) {
      let bestLaunchTargetId = null;
      let bestLaunchSourceId = null;
      let maxTargetThreat = 0;

      // Scan all attack frontiers
      owned.forEach(sid => {
        const src = gameState.territories[sid];
        if (src.armies < 2) return;

        const adjs = GameEngine.getAdjacentTerritories(mapData.connections, sid);
        adjs.forEach(tid => {
          const tgt = gameState.territories[tid];
          if (!tgt || tgt.ownerId === playerId || tgt.ownerId === 'dummy') return;

          // Target validation: Avoid launching on blizzards or radioactive nodes
          if (gameState.blizzards && gameState.blizzards.includes(tid)) return;
          if (gameState.radiation && gameState.radiation[tid] > 0) return;

          // Break pacts if they are the leader or represent a major chokepoint threat
          const isPact = hasActivePact(gameState, playerId, tgt.ownerId);
          if (isPact && getPlayerStrength(gameState, tgt.ownerId) < getPlayerStrength(gameState, playerId) * 1.5) {
            return; // Skip launching on weaker allies unless required
          }

          // Launch criteria: High target army density (Tactical requires > 12, Thermo > 15)
          const targetArmies = tgt.armies || 1;
          const minRequiredStack = hasThermo ? 15 : 12;

          if (targetArmies >= minRequiredStack && targetArmies > maxTargetThreat) {
            maxTargetThreat = targetArmies;
            bestLaunchTargetId = tid;
            bestLaunchSourceId = sid;
          }
        });
      });

      // Global strike fallback: missiles have unlimited range, so if no adjacent
      // high-value stack exists, strike the biggest enemy stack anywhere on the map
      if (!bestLaunchTargetId) {
        Object.keys(gameState.territories).forEach(tid => {
          const tgt = gameState.territories[tid];
          if (!tgt || tgt.ownerId === playerId || tgt.ownerId === 'dummy') return;
          if (gameState.blizzards && gameState.blizzards.includes(tid)) return;
          if (gameState.radiation && gameState.radiation[tid] > 0) return;
          const targetArmies = tgt.armies || 1;
          if (targetArmies >= 12 && targetArmies > maxTargetThreat) {
            maxTargetThreat = targetArmies;
            bestLaunchTargetId = tid;
            bestLaunchSourceId = owned.find(sid => gameState.territories[sid].armies >= 2) || null;
          }
        });
      }

      if (bestLaunchTargetId && bestLaunchSourceId) {
        const fireThermo = hasThermo; // Prioritize Thermonuke if available

        GameEngine.fireNuke(room, playerId, bestLaunchSourceId, bestLaunchTargetId, fireThermo);

        // Emit launch graphics
        const srcCenter = mapData.territories.find(t => t.id === bestLaunchSourceId)?.center;
        const tgtCenter = mapData.territories.find(t => t.id === bestLaunchTargetId)?.center;
        if (srcCenter && tgtCenter && io) {
          // Lazy require avoids a circular top-level dependency with room-manager
          const RoomManager = require('./room-manager');
          io.to(room.code).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
          // Execute ballistic missile visual timeline
          io.emit('fireNuclearMissileEvent', { srcCenter, tgtCenter, isThermo: fireThermo, targetId: bestLaunchTargetId });
        }
      }
    }
  }

  if (attacks.length === 0) return null;
  const best = attacks.sort((a, b) => b.priority - a.priority)[0];
  return { sourceId: best.sourceId, targetId: best.targetId, diceCount: best.diceCount };
}

function makeFortifyDecision(room, playerId) {
  const { gameState, mapData } = room;
  const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === playerId);
  
  // Easy Difficulty Nerf: Skip fortification phase completely
  const difficulty = room.aiDifficulty || (gameState && gameState.aiDifficulty) || 'normal';
  if (difficulty === 'easy') {
    return null;
  }

  const pressures = evaluateBorders(gameState, mapData, playerId);

  const sources = owned
    .filter(tid => pressures[tid] === 0 && gameState.territories[tid].armies > 2)
    .sort((a, b) => gameState.territories[b].armies - gameState.territories[a].armies);

  const targets = owned
    .filter(tid => pressures[tid] > 0)
    .sort((a, b) => pressures[b] - pressures[a]);

  if (sources.length === 0 || targets.length === 0) return null;

  for (const src of sources) {
    for (const tgt of targets) {
      if (src === tgt) continue;
      const pathExists = GameEngine.hasAlliedPath(
        gameState.territories, mapData.connections, src, tgt, playerId, gameState.pacts
      );
      if (pathExists) {
        const amount = gameState.territories[src].armies - 1;
        return { sourceId: src, targetId: tgt, amount };
      }
    }
  }

  return null;
}

function getTrustScore(aiPlayer, otherPlayerId) {
  if (!aiPlayer) return 50;
  aiPlayer.trustScores = aiPlayer.trustScores || {};
  if (otherPlayerId === null || otherPlayerId === undefined || otherPlayerId === 'null') return 50;
  return aiPlayer.trustScores[otherPlayerId] ?? 50;
}

function adjustTrustScore(aiPlayer, otherPlayerId, amount) {
  if (!aiPlayer) return;
  if (otherPlayerId === null || otherPlayerId === undefined || otherPlayerId === 'null') return;
  aiPlayer.trustScores = aiPlayer.trustScores || {};
  const current = getTrustScore(aiPlayer, otherPlayerId);
  aiPlayer.trustScores[otherPlayerId] = Math.max(0, Math.min(100, current + amount));
}

function currentPlayerIsHeuristic(player, room) {
  if (!player) return false;
  const isGlobalGenerative = room && (room.generativeAIMode || (room.gameState && room.gameState.generativeAIMode));
  return !player.isLLM && !isGlobalGenerative;
}

// Intercepts pathfinding routes during Allied Path validation
function hasAlliedPath(territories, connections, startId, endId, ownerId, pacts = [], blizzards = [], radiation = {}) {
  if (startId === endId) return true;
  if (blizzards.includes(startId) || blizzards.includes(endId)) return false;
  if (radiation[startId] > 0 || radiation[endId] > 0) return false;

  const alliedOwners = new Set([ownerId]);
  if (pacts) {
    pacts.forEach(p => {
      if (p.type === 'alliance') {
        if (p.playerA === ownerId) alliedOwners.add(p.playerB);
        if (p.playerB === ownerId) alliedOwners.add(p.playerA);
      }
    });
  }

  const queue = [startId];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === endId) return true;

    const adjacent = GameEngine.getAdjacentTerritories(connections, current);
    for (const adjId of adjacent) {
      const isBlizz = blizzards.includes(adjId);
      const isRad = radiation[adjId] > 0;
      if (!isBlizz && !isRad && !visited.has(adjId) && territories[adjId] && alliedOwners.has(territories[adjId].ownerId)) {
        visited.add(adjId);
        queue.push(adjId);
      }
    }
  }
  return false;
}

function hasActivePact(gameState, p1, p2) {
  return gameState.pacts?.some(p => (p.playerA === p1 && p.playerB === p2) || (p.playerB === p1 && p.playerA === p2));
}

function getPlayerStrength(gameState, playerId) {
  const owned = Object.keys(gameState.territories).filter(
    tid => gameState.territories[tid].ownerId === playerId
  );
  const totalArmies = owned.reduce((sum, tid) => sum + gameState.territories[tid].armies, 0);
  return owned.length + totalArmies;
}

// helper to get the id of the strongest active player
function getLeaderId(gameState) {
  let leaderId = null;
  let maxStrength = -Infinity;
  gameState.players.forEach(p => {
    if (!p.eliminated) {
      const strength = getPlayerStrength(gameState, p.id);
      if (strength > maxStrength) {
        maxStrength = strength;
        leaderId = p.id;
      }
    }
  });
  return leaderId;
}

function evaluateDiplomacyProposal(room, aiId, proposal) {
  const aiPlayer = room.gameState.players.find(p => p.id === aiId);
  if (!aiPlayer) return false;

  // Honor Verbal Promises
  if (aiPlayer.diplomaticPromises && aiPlayer.diplomaticPromises[proposal.sender]) {
    if (aiPlayer.diplomaticPromises[proposal.sender] === proposal.type) {
      aiPlayer.diplomaticPromises[proposal.sender] = null; // consume promise
      return true;
    }
  }

  let requiredTrust = proposal.type === 'alliance' ? 70 : 40;

  // Personality modifiers for required trust thresholds
  const personality = aiPlayer.personality || 'normal';
  if (personality === 'kind') {
    requiredTrust -= 15; // More trusting, accepts proposals easily
  } else if (personality === 'aggressive') {
    requiredTrust += 15; // Highly suspicious, demands higher trust
  } else if (personality === 'cynical') {
    requiredTrust += 10; // Skeptical, harder to win over
  } else if (personality === 'goofball') {
    requiredTrust -= 5;  // Slightly more relaxed about signing treaties
  }

  if (room.gameState) {
    const leaderId = getLeaderId(room.gameState);
    if (leaderId && leaderId !== aiId && leaderId !== proposal.sender) {
      const leaderStrength = getPlayerStrength(room.gameState, leaderId);
      const botStrength = getPlayerStrength(room.gameState, aiId);
      const senderStrength = getPlayerStrength(room.gameState, proposal.sender);

      if (leaderStrength > botStrength && leaderStrength > senderStrength) {
        let discount = 15;
        if (leaderStrength > botStrength * 1.5 || leaderStrength > senderStrength * 1.5) {
          discount = 25;
        }
        requiredTrust -= discount;
      }
    }
  }

  return getTrustScore(aiPlayer, proposal.sender) >= requiredTrust;
}

function evaluateDiplomaticProposalsToSend(room, aiId) {
  const { gameState, mapData } = room;
  const aiPlayer = gameState.players.find(p => p.id === aiId);
  if (!aiPlayer) return null;

  // 1v1 Sudden Death State Check: Prohibit negotiations and dissolve active pacts
  const activePlayers = gameState.players.filter(p => !p.eliminated);
  if (activePlayers.length <= 2) {
    gameState.pacts = []; // Automatically dissolve existing pacts to force the final battle
    return null;
  }

  const leaderId = getLeaderId(gameState);
  const hasDominantLeader = leaderId && leaderId !== aiId && getPlayerStrength(gameState, leaderId) > getPlayerStrength(gameState, aiId);
  
  const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === aiId);
  const isDesperate = owned.length <= 2;

  // Desperation Bypass: If AI is on the brink of defeat, they have a 50% chance to beg their strongest neighbor for a ceasefire
  if (isDesperate && Math.random() < 0.50) {
    let strongestNeighborId = null;
    let maxStrength = -Infinity;

    owned.forEach(tid => {
      GameEngine.getAdjacentTerritories(mapData.connections, tid).forEach(adjId => {
        const adjTerr = gameState.territories[adjId];
        if (adjTerr && adjTerr.ownerId !== null && adjTerr.ownerId !== aiId) {
          const str = getPlayerStrength(gameState, adjTerr.ownerId);
          if (str > maxStrength) {
            maxStrength = str;
            strongestNeighborId = adjTerr.ownerId;
          }
        }
      });
    });

    if (strongestNeighborId && !hasActivePact(gameState, aiId, strongestNeighborId)) {
      return { targetPlayerId: strongestNeighborId, type: 'non_aggression', isDesperateMercy: true };
    }
  }

  // Increased probabilities so AIs proactively negotiate more frequently
  const proposalChance = hasDominantLeader ? 0.45 : 0.25;

  if (Math.random() > proposalChance) return null;

  const targetCont = chooseTargetContinent(gameState, mapData, aiId);

  const neighborPlayers = new Set();
  owned.forEach(tid => {
    GameEngine.getAdjacentTerritories(mapData.connections, tid).forEach(adjId => {
      const adjTerr = gameState.territories[adjId];
      if (adjTerr && adjTerr.ownerId !== null && adjTerr.ownerId !== undefined && adjTerr.ownerId !== aiId) {
        neighborPlayers.add(adjTerr.ownerId);
      }
    });
  });

  for (const nId of neighborPlayers) {
    const targetPlayer = gameState.players.find(p => p.id === nId);
    if (!targetPlayer || targetPlayer.eliminated) continue;

    const trust = getTrustScore(aiPlayer, nId);
    
    let requiredTrust = 40;
    let allianceThreshold = 75;
    
    if (leaderId && leaderId !== aiId && leaderId !== nId) {
      const leaderStrength = getPlayerStrength(gameState, leaderId);
      const botStrength = getPlayerStrength(gameState, aiId);
      const neighborStrength = getPlayerStrength(gameState, nId);
      
      if (leaderStrength > botStrength && leaderStrength > neighborStrength) {
        let discount = 15;
        if (leaderStrength > botStrength * 1.5 || leaderStrength > neighborStrength * 1.5) {
          discount = 25;
        }
        requiredTrust -= discount;
        allianceThreshold -= discount;
      }
    }

    if (trust < requiredTrust) continue;
    if (hasActivePact(gameState, aiId, nId)) continue;

    const type = trust >= allianceThreshold ? 'alliance' : 'non_aggression';
    return { targetPlayerId: nId, type };
  }

  return null;
}

function updateAITrustScores(room) {
  const { gameState, mapData } = room;

  gameState.players.forEach(p => {
    if (p.isAI && !p.eliminated) {
      const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === p.id);
      const borderTroopsByPlayer = {};

      owned.forEach(tid => {
        const aiArmies = gameState.territories[tid].armies;
        GameEngine.getAdjacentTerritories(mapData.connections, tid).forEach(adjId => {
          const adjTerr = gameState.territories[adjId];
          if (adjTerr && adjTerr.ownerId !== null && adjTerr.ownerId !== undefined && adjTerr.ownerId !== p.id) {
            const oppId = adjTerr.ownerId;
            if (!borderTroopsByPlayer[oppId]) {
              borderTroopsByPlayer[oppId] = { oppArmies: 0, aiArmies: 0 };
            }
            borderTroopsByPlayer[oppId].oppArmies += adjTerr.armies;
            borderTroopsByPlayer[oppId].aiArmies += aiArmies;
          }
        });
      });

      Object.keys(borderTroopsByPlayer).forEach(oppId => {
        const ratio = borderTroopsByPlayer[oppId].oppArmies / Math.max(1, borderTroopsByPlayer[oppId].aiArmies);
        if (ratio > 2.0) {
          adjustTrustScore(p, oppId, -12);
        } else if (ratio < 0.8) {
          adjustTrustScore(p, oppId, 4);
        }
      });
    }
  });
}

function makePostAttackMoveDecision(room, playerId) {
  const context = room.gameState.postAttackContext;
  if (!context) return 0;

  const { gameState, mapData } = room;
  const sourceId = context.sourceId;
  const targetId = context.targetId;

  // Find adjacent enemies for both source and target coordinates
  const sourceAdjs = GameEngine.getAdjacentTerritories(mapData.connections, sourceId);
  const targetAdjs = GameEngine.getAdjacentTerritories(mapData.connections, targetId);

  const sourceHasEnemies = sourceAdjs.some(aid => gameState.territories[aid]?.ownerId !== playerId);
  const targetHasEnemies = targetAdjs.some(aid => gameState.territories[aid]?.ownerId !== playerId);

  const totalAvailable = context.additionalMax; // source.armies - 1

  if (!sourceHasEnemies) {
    // Source is completely safe (interior territory) -> push EVERYTHING forward to the front
    return totalAvailable;
  }

  if (!targetHasEnemies) {
    // Target has no adjacent enemies (unlikely, but possible if last enemy in sector was eliminated)
    // Keep forces in source to defend against adjacent threats
    return 0;
  }

  // Both have adjacent threats: Calculate proportional enemy threat on both sides to split stack safely
  let sourceThreat = 0;
  let targetThreat = 0;

  sourceAdjs.forEach(aid => {
    const t = gameState.territories[aid];
    if (t && t.ownerId !== playerId) sourceThreat += t.armies;
  });

  targetAdjs.forEach(aid => {
    const t = gameState.territories[aid];
    if (t && t.ownerId !== playerId) targetThreat += t.armies;
  });

  const totalThreat = sourceThreat + targetThreat || 1;
  const targetRatio = targetThreat / totalThreat;

  // Distribute forces proportionally to secure both frontlines
  const moveAmount = Math.round(totalAvailable * targetRatio);
  return Math.max(0, Math.min(totalAvailable, moveAmount));
}

function parseChatMessage(text, playersList, mapData) {
  const lower = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'']/g, "");
  const words = lower.split(/\s+/).filter(Boolean);

  const names = (playersList || []).map(p => ({
    id: p.id,
    name: (p.name || '').toLowerCase(),
    nationName: (p.nationName || '').toLowerCase(),
    originalName: (p.originalName || '').toLowerCase()
  }));

  const hasAtSymbol = text.includes('@');
  const mentions = [];
  
  words.forEach(w => {
    const isExplicitMention = w.startsWith('@');
    const cleanWord = w.replace(/^(@|at)/, "");
    if (cleanWord.length < 2) return;

    // If an @ symbol is present in the message, only match words explicitly prefixed with @
    if (hasAtSymbol && !isExplicitMention) return;

    const found = names.find(n => 
      n.name.includes(cleanWord) || 
      (n.nationName && n.nationName.includes(cleanWord)) || 
      (n.originalName && n.originalName.includes(cleanWord)) ||
      cleanWord.includes(n.name) ||
      (n.nationName && cleanWord.includes(n.nationName))
    );
    if (found && !mentions.includes(found.id)) {
      mentions.push(found.id);
    }
  });

  const recipientId = mentions[0] || null;
  const subjectId = mentions[1] || null;

  let targetTerritoryId = null;
  if (mapData && mapData.territories) {
    for (const t of mapData.territories) {
      const tName = t.name.toLowerCase();
      if (lower.includes(tName) || tName.split(/\s+/).some(w => w.length > 3 && words.includes(w))) {
        targetTerritoryId = t.id;
        break;
      }
    }
  }

  // Robust phrase-level and token-level helpers
  const hasPhrase = (phrases) => phrases.some(phrase => lower.includes(phrase));
  const findWordIndex = (stems) => {
    return words.findIndex(w => stems.some(stem => w.includes(stem)));
  };

  const breakWordList = ["no", "not", "dont", "never", "stop", "un", "without", "non", "break", "breaking", "broke", "cancel", "canceling", "cancelling", "end", "ending", "ended", "sever", "terminate", "reject", "refuse"];
  
  const isNegatedAtIndex = (index) => {
    if (index <= 0) return false;
    const prev = words[index - 1];
    return breakWordList.some(b => prev.includes(b));
  };

  let intent = null;

  const allianceKeywords = ["allian", "ally", "team up", "team", "coordinat", "coalition", "squad up", "join forces", "pact"];
  const ceasefireKeywords = ["ceasefir", "truce", "nonaggress", "peace treaty", "peace agreement", "safekeep"];
  const moveKeywords = ["move", "retreat", "withdraw", "demilitariz", "vacat"];
  const claimKeywords = ["claim", "leave", "avoid", "partit", "exclus", "sovereign", "can i have"];
  const betrayalAccuseKeywords = ["betray", "backstab", "snake", "traitor", "liar", "cheat", "stab in the back"];

  // Declarations
  const bragKeywords = ["dominating", "brag", "lead", "victory", "glorious", "win"];
  const betrayalAnnounceKeywords = [
    "break alliance", "breaking alliance", "broke alliance", "broken alliance",
    "break truce", "breaking truce", "broke truce", "broken truce",
    "break pact", "breaking pact", "broke pact", "broken pact",
    "end alliance", "ending alliance", "ended alliance", "end our alliance",
    "end truce", "ending truce", "ended truce", "end our truce",
    "end pact", "ending pact", "ended pact", "end our pact",
    "cancel alliance", "canceling alliance", "cancelling alliance", "canceled alliance", "cancelled alliance",
    "cancel truce", "canceling truce", "cancelling truce", "canceled truce", "cancelled truce",
    "cancel pact", "canceling pact", "cancelling pact",
    "sever alliance", "severing alliance", "terminate alliance", "terminating alliance",
    "no more alliance", "no more truce", "no alliance", "no truce", "no more pact",
    "alliance is over", "truce is over", "pact is over",
    "alliance broken", "truce broken", "pact broken", "pact is dead",
    "breaking my truce", "breaking", "betraying", "tragedy"
  ];
  const allianceFormedKeywords = ["formed an alliance", "alliance with", "allied with"];
  const protestKeywords = ["amassing", "garrison", "build-up", "suspicious", "protest", "troops on my border"];
  const mercyKeywords = ["beg of you", "mercy", "plea", "spare my", "collapse"];
  const trashKeywords = ["noob", "trash", "easy", "bot", "bad player", "bad bot", "youre bad", "you're bad", "hate", "garbage", "pathetic", "loser", "suck", "git gud", "clank", "horrible", "bad at", "terrible at"];

  const allianceIdx = findWordIndex(allianceKeywords);
  const ceasefireIdx = findWordIndex(ceasefireKeywords);
  const moveIdx = findWordIndex(moveKeywords);
  const claimIdx = findWordIndex(claimKeywords);
  const betrayalIdx = findWordIndex(betrayalAccuseKeywords);
  const trashIdx = findWordIndex(trashKeywords);
  const protestIdx = findWordIndex(protestKeywords);

  const bullyingKeywords = [
    "bullying", "stop attacking", "targeting me", "stop targeting", "stop attacking", "complaint_bullying", 
    "bullying complaint", "why do you attack", "only attack", "always attack", "attacking me",
    "pick on", "picking on", "why attack", "focusing on me", "focus on me"
  ];
  const capitalDefianceKeywords = ["lost capital", "capital has fallen", "capital defiance", "lost_capital_defiance"];
  const finalDuelKeywords = ["final duel", "sudden death", "final standoff", "duel declaration", "final_duel", "last two", "only two p"];

  if (hasPhrase(betrayalAnnounceKeywords) || (allianceIdx !== -1 && isNegatedAtIndex(allianceIdx)) || (ceasefireIdx !== -1 && isNegatedAtIndex(ceasefireIdx))) {
    intent = "BETRAYAL_ANNOUNCE";
  } else if (hasPhrase(allianceFormedKeywords) && !hasPhrase(["not allied", "no alliance with", "never allied", "fake alliance"])) {
    intent = "ALLIANCE_FORMED";
  } else if (hasPhrase(capitalDefianceKeywords)) {
    intent = "LOST_CAPITAL_DEFIANCE";
  } else if (hasPhrase(finalDuelKeywords)) {
    intent = "FINAL_DUEL_DECLARATION";
  } else if (hasPhrase(bullyingKeywords)) {
    intent = "BULLYING_COMPLAINT";
  } else if (trashIdx !== -1 && !isNegatedAtIndex(trashIdx)) {
    intent = "TRASH_TALK";
  } else if (findWordIndex(bragKeywords) !== -1) {
    intent = "BRAG";
  } else if ((hasPhrase(protestKeywords) || protestIdx !== -1) && !isNegatedAtIndex(protestIdx)) {
    intent = "PROTEST";
  } else if (hasPhrase(mercyKeywords) || findWordIndex(["mercy", "plea"]) !== -1) {
    intent = "MERCY";
  } else if (betrayalIdx !== -1 && !isNegatedAtIndex(betrayalIdx)) {
    intent = "BETRAYAL_ACCUSATION";
  } else if (allianceIdx !== -1 && !isNegatedAtIndex(allianceIdx)) {
    intent = "ALLIANCE";
  } else if (ceasefireIdx !== -1 && !isNegatedAtIndex(ceasefireIdx)) {
    intent = "CEASEFIRE";
  } else if (moveIdx !== -1 && !isNegatedAtIndex(moveIdx)) {
    intent = "MOVE_TROOPS";
  } else if (claimIdx !== -1 && !isNegatedAtIndex(claimIdx)) {
    intent = "CLAIM_TERRITORY";
  }

  return { recipientId, subjectId, intent, targetTerritoryId };
}

function getDialogue(type, personality, context = {}) {
  let bank = DIALOGUE_BANK[type];
  if (!bank) return "...";

  let options = [];
  if (Array.isArray(bank)) {
    options = bank;
  } else {
    options = bank[personality] || bank.normal || [];
  }

  if (options.length === 0) return "...";
  let line = options[Math.floor(Math.random() * options.length)];

  if (context.sender) line = line.replace(/\[sender\]/g, context.sender);
  if (context.recipient) line = line.replace(/\[recipient\]/g, context.recipient);
  if (context.subject) line = line.replace(/\[subject\]/g, context.subject);
  if (context.border_territory) line = line.replace(/\[border_territory\]/g, context.border_territory);
  if (context.requested_territory) line = line.replace(/\[requested_territory\]/g, context.requested_territory);
  if (context.continent_name) line = line.replace(/\[continent_name\]/g, context.continent_name);
  if (context.ai_territory) line = line.replace(/\[ai_territory\]/g, context.ai_territory);
  if (context.count !== undefined) line = line.replace(/\[count\]/g, context.count);

  // If game is not in Capital Rush mode, sanitize flavor references from "capital" to "base"
  if (context.gameMode !== 'capital_rush') {
    line = line.replace(/\bcapitals\b/gi, 'bases');
    line = line.replace(/\bcapital\b/gi, 'base');
  }

  return line;
}
const PROPOSAL_TEMPLATES = {
  alliance: {
    normal: [
      "Hey @[target], let's team up in an alliance against @[subject].",
      "We should ally against @[subject], @[target].",
      "Let's form an alliance to deal with @[subject], @[target].",
      "Hey @[target], let's coordinate our forces to eliminate @[subject].",
      "Let's sign an alliance pact, @[target]. @[subject] is getting too strong.",
      "Hey @[target], let's combine our frontlines to contain @[subject].",
      "We need a joint coalition against @[subject], @[target]. Let's team up.",
      "I propose an alliance, @[target]. Our shared target is @[subject].",
      "Let's work together to neutralize @[subject], @[target].",
      "A mutual alliance would let us push back @[subject] easily, @[target].",
      "Hey @[target], let's coordinate our vanguards to squeeze @[subject].",
      "Let's agree to an alliance, @[target]. @[subject] is expanding too quickly."
    ],
    strategic: [
      "Analyzing threat profiles, @[target]. A defensive alliance against @[subject] is optimal.",
      "Logistics suggest we coordinate a joint campaign against @[subject], @[target].",
      "Let us establish a formal alliance against the mutual threat of @[subject], @[target].",
      "Calculations show an alliance targeting @[subject] will optimize our progression, @[target].",
      "Systemic alignment authorized, @[target]. Let us target @[subject]'s frontiers.",
      "A dual operational vector against @[subject] has a high success projection, @[target].",
      "I propose we consolidate our resources to neutralize @[subject], @[target].",
      "Logistical metrics prioritize an alliance to de-escalate our border while targeting @[subject].",
      "To prevent @[subject] from securing a dominant bonus, an alliance is statistically required, @[target].",
      "Let us demarcate our shared boundary and focus all vanguards on @[subject], @[target].",
      "Offensive optimization complete. Joint operations against @[subject] are authorized, @[target].",
      "A binary coalition against @[subject] is the most efficient tactical pathing, @[target]."
    ],
    kind: [
      "Hi @[target]! Would you like to be best friends and ally against @[subject]? 😊",
      "Let's help each other out and make an alliance against @[subject], @[target]! ✨",
      "If we team up in an alliance against @[subject], we can keep each other safe, @[target]! 🌸",
      "Hey @[target]! Let's protect our lands together with an alliance against @[subject]! 💛",
      "Oh! Let's be sweet partners and keep @[subject] from being too scary, @[target]! 😊🌸",
      "Hi @[target]! Working together against @[subject] sounds so lovely! ✨",
      "Let's help each other stay happy and safe by allying against @[subject], @[target]! 💛",
      "I promise my little soldiers will be great allies against @[subject], @[target]! 👍",
      "Let's make a beautiful treaty and stand strong against @[subject]'s attacks, @[target]! 😊",
      "Hi @[target]! Sending warm thoughts! Let's coordinate happily against @[subject]! ✨",
      "Let's keep the peace between us and team up against @[subject], @[target]! 🌸",
      "A sweet partnership is our best wish! Let's ally against @[subject], @[target]! 💛"
    ],
    goofball: [
      "Yo @[target], let's totally jump @[subject] together lmao 😂",
      "Alliance time! Let's make @[subject] cry in 4K, @[target] fr fr 💀",
      "Hey @[target]! Let's join the ultimate squad and wreck @[subject] haha!",
      "No cap @[target], let's team up in an alliance and take all of @[subject]'s stuff 😭",
      "Lmfao @[target], let's go steal @[subject]'s lunch money and split it 50/50 😂",
      "Yo @[target]! Let's pull up on @[subject] with the absolute squad lmfao! 💀",
      "Double trouble is active! RIP to @[subject], let's go run it down haha! 😭",
      "Hey @[target]! Let's build a massive anti-@[subject] club and eat digital pizza! 😂",
      "No cap, we are about to end @[subject]'s whole career, team up bro! 💀",
      "Lmfao @[target], let's turn @[subject]'s sectors into a playground haha! 😭",
      "Yo @[target]! Let's cooperate to make sure @[subject] gets absolute-unit reked! 😂",
      "Alliance activated! RIP to @[subject], you will not be missed lmfao! 💀"
    ],
    cynical: [
      "Hey @[target], let's sign a temporary alliance against @[subject] before we betray each other.",
      "We should probably form an alliance to stop @[subject], @[target], if you're up for it.",
      "Let's team up against @[subject], @[target]. At least we'll die together.",
      "Hey @[target], let's join forces against @[subject] and hope for the best.",
      "An alliance is convenient right now, @[target], since @[subject] is expanding too fast.",
      "Let's play nice until we manage to eliminate @[subject], @[target]. Savor the truce.",
      "I suppose teaming up against @[subject] is slightly less annoying than fighting alone, @[target].",
      "Let's combine our perimeters and hope your tactical skills actually exist against @[subject].",
      "We need a joint target, @[target]. Let's tolerate each other to destroy @[subject].",
      "A temporary marriage of convenience against @[subject]. Are you up for it, @[target]?",
      "Let's sign the treaty and hope you don't get too greedy near my frontier, @[target].",
      "An alliance to contain @[subject]. Savor the peaceful borders while they last, @[target]."
    ],
    aggressive: [
      "Hey @[target]! Let's form an alliance and tear @[subject]'s empire to pieces!",
      "We should ally against @[subject], @[target]. Let's crush them together!",
      "Let's make a blood pact alliance against @[subject], @[target]! No survivors!",
      "Hey @[target]! Team up with me so we can eradicate @[subject] once and for all!",
      "Alliance time! I will lead the charge, you clean up @[subject]'s trash, @[target]!",
      "Let's hunt! @[subject] is our prey, we will split their lands brutally, @[target]!",
      "Pact confirmed! I will systematically destroy @[subject]'s gates with your help, @[target]!",
      "Let's march together and paint @[subject]'s sectors in blood, @[target]!",
      "We need total war against @[subject]! Team up with me, @[target], and slaughter them!",
      "I reject your weakness, but I accept an alliance to incinerate @[subject], @[target]!",
      "To battle! Let's trample @[subject]'s frontiers and leave them with nothing, @[target]!",
      "A bloodbath is waiting! Let's break @[subject]'s gates and claim their territories, @[target]!"
    ]
  },
  non_aggression: {
    normal: [
      "Let's sign a ceasefire truce, @[target].",
      "I'm proposing a non-aggression ceasefire, @[target].",
      "Let's declare peace along our shared borders, @[target].",
      "Let's agree to a mutual ceasefire truce, @[target].",
      "Hey @[target], let's sign a ceasefire pact to secure our frontiers.",
      "I propose a temporary truce, @[target], to de-escalate our border.",
      "Let's halt our shared conflict and agree to a non-aggression ceasefire, @[target].",
      "A ceasefire truce works well for both of us right now, @[target].",
      "Let us establish a stable boundary zone with a mutual ceasefire, @[target].",
      "Hey @[target], let's agree to a ceasefire and focus on other targets.",
      "I propose we halt hostilities and sign a non-aggression pact, @[target].",
      "Let's keep our shared border secure with a temporary ceasefire, @[target]."
    ],
    strategic: [
      "Let us execute a non-aggression ceasefire pact, @[target].",
      "Trilateral variables suggest a ceasefire is highly efficient, @[target].",
      "I propose we establish a demilitarized truce along our shared border, @[target].",
      "Truce optimization initialized. Please sign this non-aggression ceasefire, @[target].",
      "A ceasefire allows optimal reallocation of resource pools, @[target].",
      "Let us deactivate our mutual threat vectors with a non-aggression pact, @[target].",
      "Logistical curves indicate mutual benefit in a boundary ceasefire, @[target].",
      "I propose we stabilize our shared coordinate with a demilitarized truce, @[target].",
      "Truce parameters operational. This reduces tactical complexity on our front, @[target].",
      "Ceasefire sequence initialized. Let us bypass our shared sectors, @[target].",
      "Boundary adjustments prioritized. Please confirm this non-aggression pact, @[target].",
      "To maximize defensive efficiency, a temporary truce is strategic, @[target]."
    ],
    kind: [
      "Can we please sign a sweet ceasefire and declare peace, @[target]? 😊",
      "Let's make a lovely non-aggression truce and protect our borders, @[target]! ✨",
      "I propose a happy little ceasefire truce so we don't have to fight, @[target]! 🌸",
      "Let's agree to mutual peace and ceasefire, @[target]! 💛",
      "Oh! Can we declare a sweet truce and be friendly neighbors, @[target]? 😊🌸",
      "Hi @[target]! I propose a happy little ceasefire so our soldiers stay safe! ✨",
      "Let's keep our borders beautiful and quiet with a peaceful ceasefire, @[target]! 💛",
      "A sweet non-aggression pact would make my little soldiers so happy, @[target]! 👍",
      "Sending warm wishes! Can we sign a happy ceasefire and be great friends, @[target]? 😊",
      "Hi @[target]! Sparing each other's feelings with a sweet truce sounds lovely! ✨",
      "Let's plant some flowers along our shared border and declare peace, @[target]! 🌸",
      "I promise to be a kind neighbor! Let's sign a happy little ceasefire, @[target]! 💛"
    ],
    goofball: [
      "Hey @[target], let's chill and sign a ceasefire truce, no cap 💀",
      "Truce check! Let's agree to a ceasefire and eat virtual pizza instead, @[target] 😂",
      "Let's declare a non-aggression ceasefire so we can focus on being goofballs, @[target]!",
      "Ceasefire pact! Let's play nice and not punch each other, @[target] lmao 😭",
      "Yo @[target], let's take a break from the fighting and sign a ceasefire lmfao! 😂",
      "Truce check active! Sparing our shared border is highly requested, no cap! 💀",
      "Let's sign a ceasefire so we can go watch the other players fight lmfao! 😭",
      "Hey @[target], ceasefire pact! Let's be virtual high-five buddies instead! 😂",
      "No cap, let's lock in a ceasefire and do some side quests in the lobby lmfao! 💀",
      "Lmao ceasefire activated! Settle down and relax, @[target] haha! 😭",
      "Let's agree to a truce so our little dudes don't get absolute-unit reked! 😂",
      "Lmfao truce signed! Time to chill out and eat virtual pizza lmfao bro! 💀"
    ],
    cynical: [
      "Let's sign a ceasefire truce, @[target]. I'm tired of watching my soldiers get wiped out.",
      "I'm proposing a non-aggression ceasefire truce, @[target]. Let's see how long it lasts.",
      "Let's declare peace along our shared borders, @[target]. I'm too lazy to fight you today.",
      "Let's agree to a ceasefire truce, @[target]. It's better than getting completely destroyed.",
      "I propose a temporary ceasefire, @[target], before one of us gets greedy.",
      "Let's sign a non-aggression pact and hope you don't backstab me immediately, @[target].",
      "A temporary peace is better than a messy war on our shared front, @[target].",
      "Let's declare a ceasefire and keep our hands to ourselves, at least for now.",
      "I propose we halt hostilities, @[target]. Sparing each other is mutually convenient.",
      "A temporary ceasefire truce. Are you up for it, or should we keep wasting units?",
      "Let's sign the treaty and hope your word is actually worth something, @[target].",
      "Truce signed. Let's pretend to be best friends while we plan our next moves, @[target]."
    ],
    aggressive: [
      "Let's sign a ceasefire truce, @[target]. I have bigger targets to incinerate first.",
      "I propose a ceasefire truce, @[target]. Keep your distance if you value your life.",
      "Let's declare peace along our shared borders, @[target]. For now.",
      "Let's agree to a ceasefire truce, @[target], before I change my mind and burn your cities.",
      "I propose a temporary ceasefire, @[target]. Sparing you gives me time to prepare.",
      "Pact signed! Sparing our shared front is convenient for my next campaign, @[target].",
      "Let's sign a truce, @[target]. Keep your vanguard back or the bloodbath resumes.",
      "I cede attacks on your front temporarily, @[target], while I conquer other sectors.",
      "A ceasefire truce is accepted! Sparing your weak garrison is convenient for now.",
      "Truce locked in! Sparing you stands as long as you keep out of my sight!",
      "Fine, a temporary truce, @[target]. Sparing your border gives me bigger walls to crush.",
      "Let's sign a ceasefire. One step across my line and your capital is incinerated!"
    ]
  },
  move_troops: {
    normal: [
      "Could you please withdraw your armies from [requested_territory], @[target]?",
      "Please move your troops out of [requested_territory], @[target].",
      "Let's demilitarize [requested_territory], @[target].",
      "Please vacate your garrison in [requested_territory], @[target].",
      "Hey @[target], could you please reposition your troops out of [requested_territory]?",
      "Please shift your regiments away from [requested_territory], @[target].",
      "To prevent accidental boundary friction, please vacate [requested_territory], @[target].",
      "Could you please pull your main stack back from [requested_territory], @[target]?",
      "I request you demilitarize [requested_territory] to keep our borders secure, @[target].",
      "Please move your standing armies away from [requested_territory], @[target].",
      "Could you relocates your forces out of [requested_territory], @[target]?",
      "Hey @[target], please back your soldiers away from [requested_territory] shortly."
    ],
    strategic: [
      "Logistics require you to withdraw your garrison from [requested_territory], @[target].",
      "Please reallocate your military assets out of [requested_territory], @[target].",
      "De-escalation protocol: demilitarize [requested_territory], @[target].",
      "Please vacate your troop detachments from [requested_territory], @[target].",
      "Repositioning required. Shifting assets out of [requested_territory] optimizes safety, @[target].",
      "To preserve treaty equilibrium, please demilitarize coordinate [requested_territory], @[target].",
      "Logistical check indicates high boundary friction. Vacate [requested_territory], @[target].",
      "We request you reallocate your standing garrison away from [requested_territory], @[target].",
      "Boundary security parameters require demilitarization of coordinate [requested_territory], @[target].",
      "Please schedule asset relocation out of [requested_territory] on your next turn, @[target].",
      "Withdrawal of your forward vanguard from [requested_territory] is statistically optimal, @[target].",
      "Logical request path: please vacate your active units from [requested_territory], @[target]."
    ],
    kind: [
      "Would you mind terribly moving your cute little armies out of [requested_territory], @[target]? 😊",
      "Please withdraw your sweet troops from [requested_territory], @[target]! 🌸",
      "Let's make [requested_territory] a peaceful zone and demilitarize it, @[target]! ✨",
      "Could you please vacate your soldiers from [requested_territory], @[target]? 💛",
      "Would you be so kind as to shift your little armies back from [requested_territory], @[target]? 😊🌸",
      "Please withdraw your sweet guard from [requested_territory], @[target]! Stay safe! ✨",
      "Let's keep [requested_territory] peaceful and move our soldiers away, @[target]! 💛",
      "Would you mind terribly relocating your armies away from [requested_territory], @[target]? 👍",
      "Please shift your brave troops back so we can keep our borders comfy, @[target]! 😊",
      "Could you please vacate your garrison from [requested_territory], sweet @[target]? ✨",
      "Sending warm thoughts! Please move your little dudes back from [requested_territory]! 🌸",
      "I promise our intentions are friendly! Could you please clear [requested_territory], @[target]? 💛"
    ],
    goofball: [
      "Bro @[target], please get your loud armies out of [requested_territory] lmao 💀",
      "Hey @[target], move your little dudes out of [requested_territory] before they get lost haha!",
      "Can we demilitarize [requested_territory]? It's getting way too crowded, @[target] 😭",
      "Please vacate [requested_territory], @[target]! My soldiers need their personal space 😂",
      "Lmao @[target], packing up the camper vans and vacating [requested_territory] is requested! 😂",
      "Hey @[target], shift your little dudes back so my squad can have some elbow room! 💀",
      "No cap, please clear out of [requested_territory] lmfao, it's super crowded! 😭",
      "Lmfao @[target], move your armies before they start building sandcastles there! 😂",
      "Bro, please relocates your squad out of [requested_territory] lmfao, no cap! 💀",
      "Lmao alright, campsite relocation requested for [requested_territory], @[target]! haha! 😭",
      "Hey @[target]! Move your little dudes back so we don't start any accidental drama! 😂",
      "Lmfao please vacate [requested_territory], @[target]! My soldiers are claustrophobic! 😭"
    ],
    cynical: [
      "Could you please withdraw your armies from [requested_territory], @[target]? It's making me nervous.",
      "Please move your troops out of [requested_territory], @[target]. I don't trust you near my capital.",
      "Let's demilitarize [requested_territory], @[target]. It's a disaster waiting to happen.",
      "Please vacate [requested_territory], @[target]. I'd rather not have to watch you 24/7.",
      "Could you please relocates your vanguard out of [requested_territory], @[target]? Sparing my paranoia.",
      "Please move your garrison away. I prefer active safety to watching you amass forces.",
      "Let's clear [requested_territory] before one of us gets tempted to start a backstab.",
      "Please withdraw your armies. Sparing [requested_territory] is convenient for both our fronts.",
      "I suggest you relocates your forces away from [requested_territory] to keep things clean, @[target].",
      "Please vacate. Sparing [requested_territory] avoids a highly tedious frontier battle.",
      "I request you back your soldiers off. Sparing my capital is strictly my priority.",
      "Move your garrison. Sparing my lines is necessary for my peace of mind, @[target]."
    ],
    aggressive: [
      "Withdraw your armies from [requested_territory] immediately, @[target], or face my vanguard!",
      "Move your troops out of [requested_territory] right now, @[target]!",
      "Demilitarize [requested_territory] at once, @[target]! Your presence is an insult!",
      "Vacate your garrison in [requested_territory], @[target], before I systematically dismantle it!",
      "Withdraw your legions from [requested_territory] now, @[target], or prepare for blood!",
      "Move your troops out of my sight! Sparing [requested_territory] is your only option! 😡",
      "Demilitarize [requested_territory] immediately! Suffer my full advance if you refuse!",
      "Vacate your vanguard! Sparing [requested_territory] is required if you value your capital!",
      "Relocate your forces right now, @[target], or my vanguard will execute them!",
      "Move your garrison! Sparing [requested_territory] is the only way to avoid absolute slaughter!",
      "Clear your soldiers out of [requested_territory] at once, @[target]! The legions are hungry!",
      "I do not tolerate border amassing! Relocate your armies or face total war!"
    ]
  },
  claim_territory: {
    normal: [
      "Please stay clear of [requested_territory], @[target].",
      "I am claiming exclusivity over [requested_territory], @[target].",
      "Please leave [requested_territory] to my empire, @[target].",
      "Do not cross into [requested_territory], @[target].",
      "Hey @[target], please bypass [requested_territory] on your next expansion phase.",
      "I am claiming [requested_territory], @[target]. Sparing it would be appreciated.",
      "Please leave [requested_territory] alone, @[target]. It belongs to my target list.",
      "Do not expand your parameters into [requested_territory], @[target].",
      "I request you steer clear of [requested_territory] shortly, @[target].",
      "Claim active. Please avoid [requested_territory] during your next turn, @[target].",
      "Hey @[target], please cede all interest in [requested_territory] to my empire.",
      "Do not cross our boundary at [requested_territory], @[target]. Sparing requested."
    ],
    strategic: [
      "Please recognize our administrative claim to [requested_territory], @[target].",
      "Do not expand your parameters into [requested_territory], @[target].",
      "Our strategic timeline requires exclusivity over [requested_territory], @[target].",
      "We request you bypass [requested_territory] in your expansion models, @[target].",
      "Sovereign claim active. Bypassing [requested_territory] is required for equilibrium, @[target].",
      "Boundary exclusivity sequence initialized. Please exclude [requested_territory], @[target].",
      "Logistical parameters prioritize [requested_territory] as our exclusive zone, @[target].",
      "Please do not target node [requested_territory], @[target]. Sparing is strategic.",
      "Exclusivity verified. Bypassing [requested_territory] optimizes secondary frontlines, @[target].",
      "We request you omit [requested_territory] from your upcoming target matrices, @[target].",
      "Demarcation initialized. Please avoid coordinate [requested_territory] on your next turn.",
      "Sovereignty parameters dictate complete exclusivity over coordinate [requested_territory], @[target]."
    ],
    kind: [
      "Could you please leave [requested_territory] to me, sweet @[target]? 😊",
      "I would be so happy if you stayed clear of [requested_territory], @[target]! 🌸",
      "Please don't attack [requested_territory], let's keep it safe for my empire, @[target]! ✨",
      "Would you mind avoiding [requested_territory] on your next turn, @[target]? 💛",
      "Oh! Could you please spare [requested_territory] for my little empire, sweet @[target]? 😊🌸",
      "I would be so happy if you left [requested_territory] in our friendly hands! ✨",
      "Please don't advance into [requested_territory], let's keep things comfortable, @[target]! 💛",
      "Would you mind terribly bypassing [requested_territory] on your next turn, @[target]? 👍",
      "I promise to stay friendly! Please leave [requested_territory] to our home garden! 😊",
      "Hi @[target]! Sending love! Please stay clear of [requested_territory]! ✨",
      "Could you please avoid [requested_territory] so my little soldiers stay safe? 🌸",
      "I would be so grateful if you spared [requested_territory], sweet neighbor! 💛"
    ],
    goofball: [
      "Stay clear of [requested_territory], @[target]! That's my exclusive gaming zone 💀",
      "Lmao do not touch [requested_territory], @[target]! It's mine fr fr 😂",
      "Hey @[target], please leave [requested_territory] alone, I already bought real estate there 😭",
      "Don't cross into [requested_territory], @[target], or I'm calling the virtual police lmao!",
      "Lmao @[target], no touchy [requested_territory]! That's my private playground 😂",
      "Hey @[target]! Sparing [requested_territory] is highly requested, finders keepers bro! 💀",
      "Lmfao do not park your armies in [requested_territory], @[target]! It is fully booked! 😭",
      "Don't expand into [requested_territory], @[target], or the boys are throwing hands lmfao! 😂",
      "Yo @[target], please steer clear of [requested_territory], no cap lmfao! 💀",
      "Lmao alright, [requested_territory] has terrible Wi-Fi anyway, avoid it bro! haha! 😭",
      "No shot! Don't cross into [requested_territory], @[target]! That's my private fort! 😂",
      "Lmfao please leave [requested_territory] alone, I got a legendary scoreboard to climb! 😭"
    ],
    cynical: [
      "Please stay clear of [requested_territory], @[target]. I don't need any more uninvited guests.",
      "I am claiming exclusivity over [requested_territory], @[target]. Don't make me regret asking politely.",
      "Please leave [requested_territory] to my empire, @[target]. You have plenty of other lands to ruin.",
      "Do not cross into [requested_territory], @[target]. I'd rather not have to fight you over it.",
      "Could you stay clear of [requested_territory], @[target]? PARANOIA check: active.",
      "I am claiming exclusivity. Sparing [requested_territory] prevents a tedious boundary war.",
      "Please leave [requested_territory] alone. Don't force my vanguard to respond.",
      "Do not cross. Sparing [requested_territory] keeps our shared border convenient for now.",
      "I request you avoid [requested_territory] shortly. I don't want to watch your daggers near my base.",
      "Bypassing [requested_territory] is recommended, @[target], unless you want standard conflict.",
      "I cede no claims. Leave [requested_territory] to my administration, @[target].",
      "Do not advance into [requested_territory]. Sparing it is strictly convenient for both fronts."
    ],
    aggressive: [
      "Stay clear of [requested_territory], @[target], or I will paint the soil in your blood!",
      "I am claiming [requested_territory] as my sovereign right, @[target]! Do not touch it!",
      "Leave [requested_territory] to me, @[target], unless you want to start a total war!",
      "Do not cross into [requested_territory], @[target]! My legions are dug in and waiting!",
      "Stay clear of [requested_territory], @[target], or face the full fury of my vanguard!",
      "I claim [requested_territory]! Sparing it is required if you value your capital! 😡",
      "Leave it to me! If you touch [requested_territory], my legions will burn your homeland!",
      "Do not cross my line at [requested_territory]! Suffer my advance if you refuse!",
      "I am claiming this sector as my sovereign right! Keep your hands off, @[target]!",
      "Avoid [requested_territory], @[target]! My vanguard is entrenched and waiting!",
      "Leave [requested_territory] alone or my legions will systematic butcher your garrison!",
      "Do not cross! [requested_territory] belongs under my iron grip, prepare for war!"
    ]
  }
};

function getProposalTemplate(type, personality, targetName, borderTerrName = 'the border', subjectName = '', gameMode = 'conquest') {
  const templates = PROPOSAL_TEMPLATES[type]?.[personality] || PROPOSAL_TEMPLATES[type]?.normal || [];
  if (templates.length === 0) return `@${targetName} let's coordinate.`;
  
  let line = templates[Math.floor(Math.random() * templates.length)];
  line = line.replace(/@\[target\]/g, `@${targetName}`);
  line = line.replace(/@\[subject\]/g, subjectName ? `@${subjectName}` : 'the others');
  line = line.replace(/\[requested_territory\]/g, borderTerrName);
  
  if (gameMode !== 'capital_rush') {
    line = line.replace(/\bcapitals\b/gi, 'bases');
    line = line.replace(/\bcapital\b/gi, 'base');
  }

  return line;
}

module.exports = {
  evaluateBorders,
  chooseTargetContinent,
  makeDraftDecision,
  makeAttackDecision,
  makeFortifyDecision,
  makePostAttackMoveDecision,
  evaluateDiplomacyProposal,
  evaluateDiplomaticProposalsToSend,
  updateAITrustScores,
  getTrustScore,
  adjustTrustScore,
  getPlayerStrength,
  getLeaderId,
  parseChatMessage,
  getDialogue,
  getProposalTemplate,
  getPersonality: (aiPlayer) => aiPlayer ? (aiPlayer.personality || 'normal') : 'normal'
};