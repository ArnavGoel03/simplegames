// The honest fallback for a game with no photograph yet.
//
// `CardFan` deals a real hand and is a true picture of a card game, which is
// exactly why it cannot stand in for a drawing game or a word game: a tile that
// shows Draw holding seven playing cards is a small lie on the one site that is
// not allowed to tell one. So a game with nothing real to show gets its own
// name, set large, which claims nothing at all.
//
// Decorative by construction: the tile prints the same name in its heading a
// few lines below, so this is hidden from assistive technology rather than read
// out twice.

export function TitlePlate({ name }: { name: string }) {
  return (
    <div className="plate" aria-hidden="true">
      <span className="plate__name">{name}</span>
    </div>
  );
}
