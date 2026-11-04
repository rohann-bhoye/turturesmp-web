import Pixel, { ArtName } from "./PixelArt";

// Deterministic fireflies (no randomness, so server and client markup match).
const flies = [
  { x: "8%", y: "42%", dx: "40px", dy: "-30px", t: "7s", dl: "-1s" },
  { x: "17%", y: "62%", dx: "-30px", dy: "-50px", t: "9s", dl: "-4s" },
  { x: "26%", y: "35%", dx: "50px", dy: "30px", t: "8s", dl: "-2s" },
  { x: "36%", y: "70%", dx: "-40px", dy: "-20px", t: "10s", dl: "-6s" },
  { x: "47%", y: "48%", dx: "30px", dy: "-40px", t: "7.5s", dl: "-3s" },
  { x: "58%", y: "66%", dx: "-50px", dy: "-30px", t: "9.5s", dl: "-5s" },
  { x: "68%", y: "40%", dx: "40px", dy: "40px", t: "8.5s", dl: "-7s" },
  { x: "77%", y: "60%", dx: "-30px", dy: "-45px", t: "11s", dl: "-2.5s" },
  { x: "86%", y: "46%", dx: "35px", dy: "-25px", t: "7s", dl: "-4.5s" },
  { x: "93%", y: "68%", dx: "-45px", dy: "-35px", t: "10s", dl: "-1.5s" },
];

// Layered pixel landscape: sky, stars, moon, mountains, grass ground, fireflies.
export default function Scene({ left, right, fireflies = true, moon = true }: { left?: ArtName; right?: ArtName; fireflies?: boolean; moon?: boolean }) {
  return (
    <div className="scene" aria-hidden="true">
      <div className="stars" />
      <div className="glow" />
      {moon && <div className="moon" />}
      <div className="mtn far" />
      <div className="mtn near" />
      {fireflies && flies.map((f, i) => (
        <i
          key={i}
          className="fly"
          style={{ "--x": f.x, "--y": f.y, "--dx": f.dx, "--dy": f.dy, "--t": f.t, "--dl": f.dl } as React.CSSProperties}
        />
      ))}
      <div className="ground" />
      {(left || right) && (
        <div className="actors">
          {left ? <Pixel name={left} size={9} className="bob" /> : <span />}
          {right ? <Pixel name={right} size={9} className="bob b2" /> : <span />}
        </div>
      )}
    </div>
  );
}
