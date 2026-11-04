import PageShell from "@/components/PageShell";
import { gallery, galleryPlaceholders } from "@/data";

export const metadata = { title: "Gallery — Turture SMP" };

export default function Gallery() {
  return (
    <PageShell title="Gallery" intro="Builds and moments from the world of Turture SMP." art="diamond">
      <div className="grid">
        {gallery.length > 0
          ? gallery.map((g) => (
              <figure className="card shot" key={g.src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.caption} loading="lazy" />
                <figcaption>{g.caption}</figcaption>
              </figure>
            ))
          : galleryPlaceholders.map((c, i) => (
              <figure className="card shot" key={c}>
                <div className={`scene s${i % 6}`}>
                  <span className="pixel">📷</span>
                </div>
                <figcaption>{c} <span className="muted">· screenshot coming soon</span></figcaption>
              </figure>
            ))}
      </div>
      <p className="muted center-text">Want to be featured? Share your best builds in our Discord.</p>
    </PageShell>
  );
}
