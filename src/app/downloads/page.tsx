import PageShell from "@/components/PageShell";

export const metadata = { title: "Downloads — Turture SMP" };

export default function Downloads() {
  return (
    <PageShell
      title="Plugin Downloads"
      intro="Official server software for connecting Turture SMP to this website."
    >
      <div className="grid">
        <section className="card" data-reveal>
          <h2>TurtureBridge 1.1.0</h2>
          <p>Paper bridge plugin built against Paper API 1.21.4 and Java 21.</p>
          <p>Optional GrimAC 2.x integration sends repeated flags to the admin dashboard for staff review.</p>
          <p>
            Vault and an economy provider are optional. Balance sync is available only when both are installed.
          </p>
          <a className="btn primary" href="/downloads/TurtureBridge-1.1.0.jar" download>
            Download plugin
          </a>
        </section>

        <section className="card" data-reveal>
          <h2>Installation</h2>
          <ol>
            <li>Put the downloaded JAR in your Paper server&apos;s <code>plugins</code> folder.</li>
            <li>
              Start the server, then set the website&apos;s HTTPS URL and shared secret in{" "}
              <code>plugins/TurtureBridge/config.yml</code>.
            </li>
            <li>
              Restart or run <code>/tsmp reload</code>, then verify with <code>/tsmp status</code>.
            </li>
          </ol>
          <p>Keep the shared secret private. HTTP URLs are rejected by the plugin.</p>
        </section>
      </div>
    </PageShell>
  );
}
