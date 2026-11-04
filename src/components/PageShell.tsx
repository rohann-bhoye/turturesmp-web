import Nav from "./Nav";
import Footer from "./Footer";
import Scene from "./Scene";
import Reveal from "./Reveal";
import { ArtName } from "./PixelArt";

export default function PageShell({
  title,
  intro,
  art = "grass",
  children,
}: {
  title: string;
  intro?: string;
  art?: ArtName;
  children: React.ReactNode;
}) {
  const words = title.split(" ");
  const last = words.pop();
  return (
    <>
      <Nav />
      <header className="page-hero">
        <div className="mini-scene">
          <Scene left={art} right={art} fireflies={false} moon={false} />
        </div>
        <div className="container page-hero-in">
          <h1>
            {words.length > 0 && <>{words.join(" ")} </>}
            <em>{last}</em>
          </h1>
          {intro && <p className="lead">{intro}</p>}
        </div>
      </header>
      <main className="container page">{children}</main>
      <Footer />
      <Reveal />
    </>
  );
}
