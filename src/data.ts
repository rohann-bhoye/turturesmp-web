// Edit this file to update the site content. No code changes needed elsewhere.

// Add images to /public/gallery and list them, e.g. { src: "/gallery/spawn.png", caption: "Spawn" }
export const gallery: { src: string; caption: string }[] = [];

// Shown as placeholder tiles until you add real screenshots.
export const galleryPlaceholders = ["Spawn Town", "Jungle Base", "Nether Hub", "Mega Farm", "Castle Build", "Event Arena"];

export const team = [
  { name: "YourName", role: "Owner", color: "#ff5555", bio: "Founder of Turture SMP. Builds, streams and keeps the world alive." },
  { name: "AdminName", role: "Admin", color: "#ffaa00", bio: "Runs the server day to day and handles technical issues." },
  { name: "ModName", role: "Moderator", color: "#55ffff", bio: "Helps players, answers questions and enforces the rules." },
  { name: "HelperName", role: "Helper", color: "#55ff55", bio: "First stop for new players. Friendly and always around." },
];

// Replace the urls with your real voting-site links.
export const voteSites = [
  { name: "MinecraftServers.org", url: "https://minecraftservers.org/", reward: "1 Vote Key + $250" },
  { name: "Minecraft-MP", url: "https://minecraft-mp.com/", reward: "1 Vote Key + $250" },
  { name: "PlanetMinecraft", url: "https://www.planetminecraft.com/servers/", reward: "1 Vote Key + $250" },
  { name: "TopG", url: "https://topg.org/minecraft-servers/", reward: "1 Vote Key + $250" },
];

export const ranks = [
  { name: "Iron", price: { inr: "₹399", usd: "$4.99" }, color: "#d0d0d0", perks: ["Colored chat name", "2 extra homes", "Daily iron kit", "Iron tag in chat"] },
  { name: "Gold", price: { inr: "₹799", usd: "$9.99" }, color: "#ffd54a", perks: ["Everything in Iron", "5 extra homes", "+2,000 claim blocks", "Daily gold kit", "Fly in spawn"], featured: true },
  { name: "Diamond", price: { inr: "₹1,599", usd: "$19.99" }, color: "#5ef2f2", perks: ["Everything in Gold", "10 extra homes", "+5,000 claim blocks", "Custom chat prefix", "Priority join queue"] },
];

export const rules = [
  { t: "Be respectful", d: "No harassment, hate speech, threats or toxicity. Treat everyone kindly." },
  { t: "No cheating", d: "No x-ray, fly, killaura, duping or unfair client mods. Optifine and minimaps are fine." },
  { t: "No griefing or stealing", d: "Never break, steal from or kill inside someone else's claimed area." },
  { t: "No advertising", d: "Do not promote other servers, channels or sites in chat or DMs." },
  { t: "No spam", d: "Avoid excessive caps, repeated messages and chat flooding." },
  { t: "No lag machines", d: "Keep farms and redstone reasonable. Staff can remove builds that hurt performance." },
  { t: "Listen to staff", d: "Staff decisions are final. Appeal calmly in Discord, not in game chat." },
];

export const punishments = ["Warning", "Mute (1h – 1d)", "Temp ban (1d – 30d)", "Permanent ban"];

export const news = [
  { date: "Season 1", tag: "Launch", t: "Turture SMP is open!", d: "The world is live. Join now, claim your land and start building." },
  { date: "Weekly", tag: "Event", t: "Friday build contest", d: "Theme announced in Discord every week. Winners get rewards and bragging rights." },
  { date: "Coming soon", tag: "Update", t: "Shops and economy expansion", d: "Player shops, markets and new ways to earn are on the way." },
];

export const faq = [
  { q: "Is Turture SMP free to play?", a: "Yes. The whole server is free. Ranks are optional and only add cosmetics and convenience." },
  { q: "Which Minecraft versions work?", a: "Java Edition and Bedrock Edition (mobile, console and Windows) can both join. Use the latest version for best results." },
  { q: "Do I need to be whitelisted?", a: "Just join our Discord, read the rules and say hello. Staff will help if you hit any problem." },
  { q: "How do I protect my base?", a: "Use a golden shovel to claim land. Claimed areas stop griefing and theft." },
  { q: "How can I become staff?", a: "Be active and helpful in game and Discord. Applications open from time to time on the Team page." },
];

// Static sample data. Hook up a stats plugin API later for live numbers.
export const leaderboard = [
  { player: "Steve", playtime: "120h", kills: 54, balance: "$12,400" },
  { player: "Alex", playtime: "98h", kills: 31, balance: "$9,850" },
  { player: "Creeper", playtime: "75h", kills: 12, balance: "$5,100" },
  { player: "Notch", playtime: "60h", kills: 22, balance: "$4,300" },
  { player: "Herobrine", playtime: "44h", kills: 40, balance: "$3,900" },
];
