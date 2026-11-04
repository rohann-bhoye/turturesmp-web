import Nav from "./Nav";
import Footer from "./Footer";
import Pixel, { ArtName } from "./PixelArt";

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
  return (
    <>
      <Nav />
      <header className="page-hero">
        <div className="leaves" aria-hidden="true" />
        <div className="container page-hero-in">
          <Pixel name={art} size={10} className="bob" />
          <div>
            <h1 className="pixel">{title}</h1>
            {intro && <p className="lead">{intro}</p>}
          </div>
          <Pixel name={art} size={10} className="bob b2" />
        </div>
      </header>
      <main className="container page">{children}</main>
      <Footer />
    </>
  );
}
