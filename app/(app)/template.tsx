// A `template` (unlike `layout`) remounts on every navigation, so this enter
// animation replays each time you switch view — giving the app a felt route
// transition. Pure CSS without `forwards`, so the transform reverts to `none`
// once it finishes and never lingers to break `position:fixed` descendants
// (e.g. a modal opened within a view).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
