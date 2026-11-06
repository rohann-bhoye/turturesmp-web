import { connectDB } from "@/server/db";
import { ServerSettings } from "@/server/models";
import { requireRole } from "@/server/guard";
import { saveSettings } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireRole("admin");
  const { saved, error } = await searchParams;
  await connectDB();
  const s = (await ServerSettings.findOne({ key: "main" }).lean()) ?? (new ServerSettings({ key: "main" }).toObject());
  const sw = ["paper", "spigot", "purpur", "fabric", "forge", "neoforge", "other"];
  const panels = ["none", "pterodactyl", "pelican", "amp", "other"];

  return (
    <>
      <h1 className="admin-h">Server settings</h1>
      {saved && <p className="notice ok" role="status">Settings saved.</p>}
      {error && <p className="notice err" role="alert">{error}</p>}
      <form action={saveSettings} className="settings">
        <fieldset className="card">
          <legend>Server</legend>
          <label className="field"><span>Server name</span><input name="name" defaultValue={s.name} required maxLength={40} /></label>
          <div className="row">
            <label className="field"><span>Java IP / hostname</span><input name="javaIp" defaultValue={s.java?.ip} required /></label>
            <label className="field narrow"><span>Java port</span><input name="javaPort" type="number" min={1} max={65535} defaultValue={s.java?.port} required /></label>
          </div>
          <div className="row">
            <label className="field"><span>Bedrock IP / hostname</span><input name="bedrockIp" defaultValue={s.bedrock?.ip} required /></label>
            <label className="field narrow"><span>Bedrock port</span><input name="bedrockPort" type="number" min={1} max={65535} defaultValue={s.bedrock?.port} required /></label>
          </div>
          <div className="row">
            <label className="field"><span>Minecraft version</span><input name="version" defaultValue={s.version} maxLength={16} /></label>
            <label className="field"><span>Software</span>
              <select name="software" defaultValue={s.software}>{sw.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="field narrow"><span>Max players</span><input name="maxPlayers" type="number" min={1} max={5000} defaultValue={s.maxPlayers} required /></label>
          </div>
          <label className="field"><span>MOTD (server list text)</span><input name="motd" defaultValue={s.motd} maxLength={200} /></label>
        </fieldset>

        <fieldset className="card">
          <legend>Access &amp; bans</legend>
          <label className="check"><input type="checkbox" name="whitelistEnabled" defaultChecked={s.access?.whitelistEnabled} /><span><b>Whitelist</b><small>Only approved players can join.</small></span></label>
          <label className="check"><input type="checkbox" name="maintenanceMode" defaultChecked={s.access?.maintenanceMode} /><span><b>Maintenance mode</b><small>Only staff can join while this is on.</small></span></label>
          <label className="check"><input type="checkbox" name="allowBedrock" defaultChecked={s.access?.allowBedrock} /><span><b>Allow Bedrock players</b><small>Geyser / mobile and console.</small></span></label>
          <label className="check"><input type="checkbox" name="requireDiscordLink" defaultChecked={s.access?.requireDiscordLink} /><span><b>Require linked Discord</b><small>Players must link their account on the website first.</small></span></label>
          <label className="field"><span>Maintenance message</span><input name="maintenanceMessage" defaultValue={s.access?.maintenanceMessage} maxLength={200} /></label>
          <label className="field"><span>Default ban reason</span><input name="defaultBanReason" defaultValue={s.access?.defaultBanReason} maxLength={200} /></label>
        </fieldset>

        <fieldset className="card">
          <legend>Hosting panel &amp; links</legend>
          <div className="row">
            <label className="field narrow"><span>Panel type</span>
              <select name="panelType" defaultValue={s.panel?.type}>{panels.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="field"><span>Panel URL</span><input name="panelUrl" type="url" placeholder="https://panel.example.com" defaultValue={s.panel?.url || ""} /></label>
            <label className="field narrow"><span>Panel server ID</span><input name="panelServerId" defaultValue={s.panel?.serverId || ""} /></label>
          </div>
          <p className="muted small">The panel API key is never stored here. It goes in the host&apos;s environment variables.</p>
          <div className="row">
            <label className="field"><span>Discord invite</span><input name="discordInvite" type="url" placeholder="https://discord.gg/..." defaultValue={s.links?.discordInvite || ""} /></label>
            <label className="field"><span>Store URL</span><input name="storeUrl" type="url" defaultValue={s.links?.storeUrl || ""} /></label>
          </div>
        </fieldset>

        <button className="btn primary" type="submit">Save settings</button>
      </form>
    </>
  );
}
