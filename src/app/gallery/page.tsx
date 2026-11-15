import PageShell from "@/components/PageShell";
import Icon from "@/components/Icons";
import { galleryPlaceholders } from "@/data";
import { getSection } from "@/server/content";

export const metadata = { title: "Gallery — Turture SMP" };
// Edited in Admin > Site content; the page refreshes at most once a minute (and right after a save).
export const revalidate = 60;

export default async function Gallery() {
  const gallery = await getSection("gallery");
  return (
    <PageShell title="Gallery" intro="Builds and moments from the world of Turture SMP." art="diamond">
      <div className="grid">
        {gallery.length > 0
          ? gallery.map((g, i) => (
              <figure className="card shot" key={`${i}-${g.src}`} data-reveal>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.caption} loading="lazy" />
                <figcaption>{g.caption}</figcaption>
              </figure>
            ))
          : galleryPlaceholders.map((c, i) => (
              <figure className="card shot" key={c} data-reveal>
                <div className={`scene-ph s${i % 6}`}>
                  <Icon name="camera" />
                </div>
                <figcaption>{c} <span className="muted">· screenshot coming soon</span></figcaption>
              </figure>
            ))}
      </div>
      <p className="muted center-text">Want to be featured? Share your best builds in our Discord.</p>
    </PageShell>
  );
}
