export default function ComingSoon({ title, phase, items }: { title: string; phase: string; items: string[] }) {
  return (
    <>
      <h1 className="admin-h">{title}</h1>
      <div className="card">
        <span className="tag">{phase}</span>
        <h3 style={{ marginTop: 14 }}>Planned for this page</h3>
        <ul className="plain">
          {items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </div>
    </>
  );
}
