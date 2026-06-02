// ─── Examens officiels (comptes à rebours) ──────────────────────────────────────
// datetime = début exact de l'examen (heure locale). Sert au compte à rebours précis
// et à barrer la carte une fois l'examen passé.
export const EXAMS = [
  { k: 'alg',     label: 'Algèbre linéaire II', sub: 'écrit',       date: '2026-06-15', time: '15:15 → 19:55', datetime: '2026-06-15T15:15' },
  { k: 'thermo',  label: 'Thermodynamique',      sub: 'écrit',       date: '2026-06-19', time: '09:15 → 13:55', datetime: '2026-06-19T09:15' },
  { k: 'analyse', label: 'Analyse II',            sub: 'écrit',       date: '2026-06-22', time: '15:15 → 19:55', datetime: '2026-06-22T15:15' },
  { k: 'metro',   label: 'Métrologie',            sub: 'oral (labo)', date: '2026-06-26', time: '15:30 → 18:15', datetime: '2026-06-26T15:30' },
];

// ─── Matières (utilisé pour la vue « Par matière », les couleurs, les totaux) ────
export const SUBJECTS = [
  { k: 'alg',     label: 'Algèbre' },
  { k: 'thermo',  label: 'Thermodynamique' },
  { k: 'analyse', label: 'Analyse' },
  { k: 'metro',   label: 'Métrologie' },
];

// ─── Échéances : date limite pour avoir TOUT maîtrisé (cartes / preuves) ────────
export const DEADLINES = [
  { k: 'alg',     label: 'Cartes d’Algèbre maîtrisées',              date: '2026-06-14' },
  { k: 'thermo',  label: 'Cartes de Thermo maîtrisées',                   date: '2026-06-18' },
  { k: 'analyse', label: 'Cartes + 14 preuves d’Analyse maîtrisées', date: '2026-06-21' },
];

function t(tag, label) { return { tag, label }; }

export const PLAN = [

  { phase: 'Phase 1 · Algèbre à fond — entretien Analyse en fond' },

  { id: 'd01', wd: 'mar', d: '2 juin', date: '2026-06-02', h: 'repos',
    title: 'Repos — le marathon commence demain',
    sub: 'Rien à réviser ce soir. On démarre frais demain matin.',
    blocks: [
      { when: 'Journée', tasks: [t('rest', 'Rien à faire aujourd’hui — se reposer et préparer annales + cartes pour demain')] },
    ]
  },

  { id: 'd02', wd: 'mer', d: '3 juin', date: '2026-06-03', h: '~8 h',
    title: 'Démarrage Algèbre',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Réviser les cartes d’Algèbre — 1er passage complet, repérer les notions floues')] },
      { when: 'Après-m.', tasks: [t('alg', 'Refaire les séries : réduction de Jordan, dualité, formes bilinéaires (toutes sauf optionnels)')] },
      { when: 'Soir',     tasks: [t('analyse', 'Entretien : réviser les cartes d’Analyse (30–45 min, lecture active)')] },
    ]
  },

  { id: 'd03', wd: 'jeu', d: '4 juin', date: '2026-06-04', h: '~8 h',
    title: 'Cartes + premier examen blanc',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Réviser les cartes d’Algèbre — 2ᵉ passage + parcourir le plan « savoir-faire » du prof')] },
      { when: 'Après-m.', tasks: [t('alg', 'Faire un examen d’Algèbre (annale ou examen blanc) + correction le jour même')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les preuves ch.1 : convergence par composantes, boule ouverte/fermée')] },
    ]
  },

  { id: 'd04', wd: 'ven', d: '5 juin', date: '2026-06-05', h: '~8 h',
    title: 'Récitation test + examen',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Récitation à blanc de toutes les cartes — identifier les trous et retravailler les lacunes')] },
      { when: 'Après-m.', tasks: [t('alg', 'Faire un examen d’Algèbre + correction')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les preuves ch.2–3 : longueur (sommes de Riemann), point d’accumulation, prolongement par continuité')] },
    ]
  },

  { id: 'd05', wd: 'sam', d: '6 juin', date: '2026-06-06', h: '~8 h',
    title: 'Séries + examen',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Refaire les séries : formes quadratiques, espaces euclidiens et hermitiens')] },
      { when: 'Après-m.', tasks: [t('alg', 'Faire un examen d’Algèbre + correction')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réviser les cartes d’Analyse (entretien) + relire les preuves déjà vues')] },
    ]
  },

  { id: 'd06', wd: 'dim', d: '7 juin', date: '2026-06-07', h: '~5 h',
    title: 'Journée allégée — consolidation',
    sub: 'Le marathon est long : on ne brûle pas tout maintenant.',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', '2ᵉ récitation complète des cartes + reprendre les erreurs des examens déjà faits')] },
      { when: 'Après-m.', tasks: [t('alg', 'Faire un examen d’Algèbre (rythme tranquille) + correction')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos / activité non-académique')] },
    ]
  },

  { id: 'd07', wd: 'lun', d: '8 juin', date: '2026-06-08', h: '~8 h',
    title: 'Examen Algèbre + démarrage Thermo',
    sub: 'La Thermo entre en scène, en fond.',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Faire un examen d’Algèbre + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Relire le cours de Thermo, lister chapitres et formules clés, commencer à réviser les cartes')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les preuves ch.4 (1/3) : C¹ ⟹ différentiable, théorème des accroissements finis')] },
    ]
  },

  { id: 'd08', wd: 'mar', d: '9 juin', date: '2026-06-09', h: '~8 h',
    title: 'Examen Algèbre + cartes Thermo',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Faire un examen d’Algèbre + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Réviser les cartes de Thermo : 1er + 2ᵉ principe, entropie, processus réversibles/irréversibles')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les preuves ch.4 (2/3) : dérivée directionnelle (f différentiable), Taylor pour f ∈ C²')] },
    ]
  },

  { id: 'd09', wd: 'mer', d: '10 juin', date: '2026-06-10', h: '~8 h',
    title: 'Examen Algèbre + Thermo cycles',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Faire un examen d’Algèbre + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Réviser les cartes de Thermo : cycle de Carnot, rendement, machines thermiques, potentiels')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les preuves ch.4 (3/3) : condition suffisante d’extremum local, extremum lié (Lagrange)')] },
    ]
  },

  { id: 'd10', wd: 'jeu', d: '11 juin', date: '2026-06-11', h: '~8 h',
    title: 'Examen Algèbre + Thermo complet',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Faire un examen d’Algèbre + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Finir les cartes de Thermo (transitions de phase, relations de Maxwell) et les réviser')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les preuves ch.5 : continuité et dérivabilité d’une intégrale paramétrique (Leibniz)')] },
    ]
  },

  { id: 'd11', wd: 'ven', d: '12 juin', date: '2026-06-12', h: '~8 h',
    title: 'Examen Algèbre + ciblage des lacunes',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Faire un examen d’Algèbre + correction')] },
      { when: 'Après-m.', tasks: [t('alg', 'Révision ciblée des lacunes identifiées + nouvelle récitation des cartes')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter la preuve ch.6 : existence et unicité locale d’une EDO à variables séparées')] },
    ]
  },

  { id: 'd12', wd: 'sam', d: '13 juin', date: '2026-06-13', h: '~7 h',
    title: 'Sprint final Algèbre',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Faire un examen d’Algèbre en conditions réelles (chrono) + correction')] },
      { when: 'Après-m.', tasks: [t('alg', 'Récitation finale de toutes les cartes + check de chaque point du « savoir-faire »')] },
      { when: 'Soir',     tasks: [t('analyse', 'Relire les 14 preuves d’Analyse une fois (entretien)')] },
    ]
  },

  { id: 'd13', wd: 'dim', d: '14 juin', date: '2026-06-14', h: '~5 h',
    title: 'Veille examen Algèbre',
    sub: 'Échéance : cartes d’Algèbre maîtrisées aujourd’hui. On consolide, pas de nouveau matériel.',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Récitation complète des cartes + revoir les erreurs de tous les examens faits')] },
      { when: 'Après-m.', tasks: [t('alg', 'Léger : relire les formules clés, le théorème spectral et la structure de Jordan')] },
      { when: 'Soir',     tasks: [t('rest', 'Préparer le matériel, dormir tôt')] },
    ]
  },

  { phase: 'Phase 2 · Examen Algèbre, puis bascule Thermo' },

  { id: 'd14', wd: 'lun', d: '15 juin', date: '2026-06-15', h: 'examen',
    exam: { k: 'alg' },
    title: 'EXAMEN — Algèbre linéaire II',
    sub: '15:15 → 19:55',
    blocks: [
      { when: 'Matin', tasks: [t('alg', 'Révision légère finale (quelques cartes), pas de stress')] },
      { when: 'Soir',  tasks: [t('rest', 'Repos mérité')] },
    ]
  },

  { id: 'd15', wd: 'mar', d: '16 juin', date: '2026-06-16', h: '~8 h',
    title: 'Thermo intensif',
    blocks: [
      { when: 'Matin',    tasks: [t('thermo', 'Réviser les cartes de Thermo — 1er + 2ᵉ principe, entropie')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Faire un examen de Thermo + correction')] },
      { when: 'Soir',     tasks: [t('thermo', 'Réviser les cartes : cycles, Carnot, potentiels thermodynamiques')] },
    ]
  },

  { id: 'd16', wd: 'mer', d: '17 juin', date: '2026-06-17', h: '~8 h',
    title: 'Thermo — examens en série',
    blocks: [
      { when: 'Matin',    tasks: [t('thermo', 'Faire un examen de Thermo + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Faire un examen de Thermo + correction')] },
      { when: 'Soir',     tasks: [t('thermo', 'Réciter toutes les cartes + revoir les formules clés et les potentiels')] },
    ]
  },

  { id: 'd17', wd: 'jeu', d: '18 juin', date: '2026-06-18', h: '~7 h',
    title: 'Veille examen Thermo',
    sub: 'Échéance : cartes de Thermo maîtrisées aujourd’hui. Examen à 9h15 demain — dormir tôt.',
    blocks: [
      { when: 'Matin',    tasks: [t('thermo', 'Faire un dernier examen de Thermo + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Récitation finale des cartes + revoir les erreurs de tous les examens')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos, sommeil tôt')] },
    ]
  },

  { phase: 'Phase 3 · Examen Thermo, puis sprint Analyse' },

  { id: 'd18', wd: 'ven', d: '19 juin', date: '2026-06-19', h: 'examen',
    exam: { k: 'thermo' },
    title: 'EXAMEN — Thermodynamique',
    sub: '09:15 → 13:55',
    blocks: [
      { when: 'Après-m.', tasks: [t('rest', 'Pause courte — récupérer de l’examen du matin')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réviser les cartes d’Analyse (1er passage complet) + réciter')] },
    ]
  },

  { id: 'd19', wd: 'sam', d: '20 juin', date: '2026-06-20', h: '~9 h',
    title: 'Analyse intensif',
    blocks: [
      { when: 'Matin',    tasks: [t('analyse', 'Réviser les cartes d’Analyse — 2ᵉ passage, toutes notions')] },
      { when: 'Après-m.', tasks: [t('analyse', 'Faire un examen d’Analyse + correction')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les 14 preuves — 1er passage complet sans regarder')] },
    ]
  },

  { id: 'd20', wd: 'dim', d: '21 juin', date: '2026-06-21', h: '~8 h',
    title: 'Veille examen Analyse',
    sub: 'Échéance : cartes + 14 preuves d’Analyse maîtrisées aujourd’hui.',
    blocks: [
      { when: 'Matin',    tasks: [t('analyse', 'Faire un examen d’Analyse + correction')] },
      { when: 'Après-m.', tasks: [t('analyse', 'Faire un examen d’Analyse + correction')] },
      { when: 'Soir',     tasks: [t('analyse', 'Récitation finale des cartes + des 14 preuves (une preuve tombera à l’examen)')] },
    ]
  },

  { phase: 'Phase 4 · Examen Analyse, puis oral de Métrologie' },

  { id: 'd21', wd: 'lun', d: '22 juin', date: '2026-06-22', h: 'examen',
    exam: { k: 'analyse' },
    title: 'EXAMEN — Analyse II',
    sub: '15:15 → 19:55',
    blocks: [
      { when: 'Matin', tasks: [t('analyse', 'Récitation des preuves + quelques cartes (révision finale calme)')] },
      { when: 'Soir',  tasks: [t('rest', 'Repos')] },
    ]
  },

  { id: 'd22', wd: 'mar', d: '23 juin', date: '2026-06-23', h: '~8 h',
    title: 'Métrologie — électricité + vide + chaleur',
    sub: 'S’entraîner à expliquer à voix haute, pas juste relire.',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'TP DC / AC / RLC / filtrage : résistances internes, trigger oscilloscope, RMS/TrueRMS, résonance, Bode, octave/décade')] },
      { when: 'Après-m.', tasks: [t('metro', 'TP vide + cryogénie + thermique : pompes (palettes, diffusion, turbo), jauges (Pirani, Penning, Bourdon), thermocouple, Pt100 3/4 fils, PID')] },
      { when: 'Soir',     tasks: [t('metro', 'Relire les questions d’annales 2022–2024 (vide, RLC, thermique) — voir l’aide-mémoire')] },
    ]
  },

  { id: 'd23', wd: 'mer', d: '24 juin', date: '2026-06-24', h: '~8 h',
    title: 'Métrologie — optique + capteurs',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'TP optique 1+2 + transducteurs 1+2 : lentilles/aberrations, Michelson, réseau, diffraction, capteur inductif/piézorésistif/potentiométrique, CAN')] },
      { when: 'Après-m.', tasks: [t('metro', 'Incertitudes (transversal) + pour chaque TP : expliquer en 3–4 min à voix haute (principe → instrument → erreurs → procédure)')] },
      { when: 'Soir',     tasks: [t('metro', 'Simulation d’oral : tirer un TP au hasard → explication complète + 2 questions sur d’autres TP')] },
    ]
  },

  { id: 'd24', wd: 'jeu', d: '25 juin', date: '2026-06-25', h: '~6 h',
    title: 'Veille examen Métrologie',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'Re-simulation orale sur les TP faibles + revoir les schémas clés (palettes, Bourdon, Penning, pont de Wheatstone, boucle PID, montage 3/4 fils)')] },
      { when: 'Après-m.', tasks: [t('metro', 'Réviser les pièges récurrents (section « Aide-mémoire »)')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos')] },
    ]
  },

  { id: 'd25', wd: 'jeu', d: '26 juin', date: '2026-06-26', h: 'examen',
    exam: { k: 'metro' },
    title: 'EXAMEN — Métrologie (oral labo)',
    sub: '15:30 → 18:15',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'Révision légère : schémas + principes physiques')] },
      { when: 'Après-m.', tasks: [t('rest', 'C’est fini. Repos total. 🎉')] },
    ]
  },

];
