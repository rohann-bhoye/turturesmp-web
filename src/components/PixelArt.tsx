// Pixel art drawn in code, so no image files are needed.
type Art = { grid: string[]; pal: Record<string, string> };

const steve: Art = {
  pal: { H: "#3b2415", S: "#c68e6a", W: "#ffffff", B: "#3a3ab8", M: "#8a5a40", T: "#00a8a8", t: "#008888", P: "#3a3ab8", p: "#2c2c8f", G: "#6b6b6b" },
  grid: [
    "HHHHHHHH",
    "HHHHHHHH",
    "HSSSSSSH",
    "SSSSSSSS",
    "SWBSSBWS",
    "SSSMMSSS",
    "SSMMMMSS",
    "SSMSSMSS",
    "SSTTTTSS",
    "SSTTTTSS",
    "SSTttTSS",
    "SSTTTTSS",
    "..PPPP..",
    "..PppP..",
    "..PppP..",
    "..GGGG..",
  ],
};

const alex: Art = {
  pal: { H: "#d8742c", h: "#b45a1c", S: "#e8b894", W: "#ffffff", B: "#2f8f3f", M: "#b9785a", T: "#6ab04c", t: "#4f8f36", P: "#6b4a2b", p: "#4f351c", G: "#555555" },
  grid: [
    "HHHHHHHH",
    "HHHHHHHH",
    "HHSSSSHH",
    "HSSSSSSH",
    "HWBSSBWH",
    "hSSMMSSh",
    "hSSMMSSh",
    "hHSSSSHh",
    "SSTTTTSS",
    "SSTTTTSS",
    "SSTttTSS",
    "SSTTTTSS",
    "..PPPP..",
    "..PppP..",
    "..PppP..",
    "..GGGG..",
  ],
};

const creeper: Art = {
  pal: { G: "#4cb83a", g: "#3a9a2b", D: "#1a3a14", d: "#2a6b20" },
  grid: [
    "GgGGgGGg",
    "GGgGGgGG",
    "gDDGGDDG",
    "GDDgGDDG",
    "GGGDDGgG",
    "gGDDDDGG",
    "GGDDDDgG",
    "GgDGGDGG",
  ],
};

const grass: Art = {
  pal: { G: "#4cb83a", g: "#3a9a2b", D: "#7a5230", d: "#5c3d22", s: "#8f6238" },
  grid: [
    "GGgGGGgG",
    "GgGGgGGG",
    "DGDDGDDG",
    "DDsDDdDD",
    "sDDdDsDD",
    "DDDsDDdD",
    "dDDDDsDD",
    "DsDdDDDD",
  ],
};

const diamond: Art = {
  pal: { C: "#5ef2f2", c: "#2bc4d0", W: "#d8ffff", D: "#168a96" },
  grid: [
    "...CC...",
    "..CWCC..",
    ".CWCcCC.",
    "CWCcccCC",
    "CCcccccD",
    ".CcccccD",
    "..ccccD.",
    "...cDD..",
  ],
};

const arts = { steve, alex, creeper, grass, diamond };
export type ArtName = keyof typeof arts;

export default function Pixel({ name, size = 8, className = "", title }: { name: ArtName; size?: number; className?: string; title?: string }) {
  const { grid, pal } = arts[name];
  const w = grid[0].length;
  const h = grid.length;
  const rects: React.ReactNode[] = [];
  grid.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (pal[c]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={pal[c]} />);
    })
  );
  return (
    <svg
      className={`pixel-art ${className}`}
      width={w * size}
      height={h * size}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}
