import { C, TX } from "@/lib/tokens";

// Minimal stub for the account/settings surface so the sidebar account menu has
// a live destination. TODO(settings): build out Profil / Préférences / Thème /
// Espace de travail sections once the account layer is designed.
export default function ParametresPage() {
  return (
    <div style={{ maxWidth: 660, margin: "0 auto" }}>
      <h2 style={{ ...TX.h2, color: C.ink900, margin: 0 }}>Paramètres</h2>
      <p style={{ ...TX.body, color: C.ink500, marginTop: 8 }}>
        Cette section arrive bientôt. Vous pourrez y gérer votre profil, vos
        préférences, le thème et votre espace de travail.
      </p>
    </div>
  );
}
