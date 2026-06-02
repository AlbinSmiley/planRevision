export const EXAMS = [
  { k: 'alg',     label: 'Algèbre linéaire II', sub: 'écrit',       date: '2026-06-15', time: '15:15 → 19:55' },
  { k: 'thermo',  label: 'Thermodynamique',      sub: 'écrit',       date: '2026-06-19', time: '09:15 → 13:55' },
  { k: 'analyse', label: 'Analyse II',            sub: 'écrit',       date: '2026-06-22', time: '15:15 → 19:55' },
  { k: 'metro',   label: 'Métrologie',            sub: 'oral (labo)', date: '2026-06-26', time: '15:30 → 18:15' },
];

function t(tag, label) { return { tag, label }; }

export const PLAN = [

  { phase: 'Phase 1 · Algèbre à fond + fondations Thermo / Analyse' },

  { id: 'd01', wd: 'mar', d: '2 juin',  h: '~8 h',
    title: 'Démarrage Algèbre + lancement cartes Analyse',
    sub: 'Les cartes Algèbre sont faites — reste à les ancrer pour de bon',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Apprendre cartes ch.1 — polynôme minimal, Cayley-Hamilton, décomposition primaire, blocs de Jordan')] },
      { when: 'Après-m.', tasks: [t('alg', 'Apprendre cartes ch.2 — dualité, base duale, couplage, formes bilinéaires, matrice de Gram')] },
      { when: 'Soir',     tasks: [t('analyse', 'FAIRE les cartes Analyse — ch.1 (ℝⁿ, suites, convergence) + ch.2 (courbes paramétrées, longueur)')] },
    ]
  },

  { id: 'd02', wd: 'mer', d: '3 juin',  h: '~8 h',
    title: 'Formes quadratiques, espaces euclidiens',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Apprendre cartes ch.3 — rang, signature, base de Sylvester, théorème d\'inertie, Minkowski')] },
      { when: 'Après-m.', tasks: [t('alg', 'Apprendre cartes ch.4 — produit scalaire, projection orthogonale, isométrie, Gram-Schmidt, Cauchy-Schwarz')] },
      { when: 'Soir',     tasks: [t('analyse', 'Cartes Analyse — ch.3 : fonctions, limites, points d\'accumulation, continuité, prolongement')] },
    ]
  },

  { id: 'd03', wd: 'jeu', d: '4 juin',  h: '~8 h',
    title: 'Hermitiens + premier examen blanc',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [
        t('alg', 'Apprendre cartes ch.5 — hermitien, adjoint, opérateur normal/auto-adjoint/unitaire, théorème spectral'),
        t('alg', 'Survol des 5 chapitres : parcourir le plan du prof (chaque « savoir-faire »)'),
      ]},
      { when: 'Après-m.', tasks: [t('alg', 'Examen #1 (annale la plus récente) + correction le jour même')] },
      { when: 'Soir',     tasks: [t('analyse', 'Cartes Analyse — ch.4 : dérivées partielles, différentiabilité, gradient, Taylor, extrema, Lagrange')] },
    ]
  },

  { id: 'd04', wd: 'ven', d: '5 juin',  h: '~8 h',
    title: 'Récitation test + examen #2',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Récitation à blanc de TOUTES les cartes — identifier les trous, retravailler les lacunes')] },
      { when: 'Après-m.', tasks: [t('alg', 'Examen #2 + correction')] },
      { when: 'Soir',     tasks: [t('analyse', 'Cartes Analyse — ch.5 : intégrales paramétriques, Leibniz, intégrales doubles')] },
    ]
  },

  { id: 'd05', wd: 'sam', d: '6 juin',  h: '~8 h',
    title: 'Séries Algèbre + examen #3',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Refaire séries ch.9-10 (Jordan, dualité) — toutes sauf optionnels')] },
      { when: 'Après-m.', tasks: [t('alg', 'Examen #3 + correction')] },
      { when: 'Soir',     tasks: [t('analyse', 'Cartes Analyse — ch.6 : EDO, variables séparées, équations linéaires → cartes Analyse COMPLÈTES ✓')] },
    ]
  },

  { id: 'd06', wd: 'dim', d: '7 juin',  h: '~5 h',
    title: 'Journée allégée — consolidation',
    sub: 'Le marathon est long, on ne brûle pas tout maintenant',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Refaire séries ch.11-12 (formes quadratiques, espaces euclidiens)')] },
      { when: 'Après-m.', tasks: [t('alg', '2ᵉ passage de récitation des cartes')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos / activité non-académique')] },
    ]
  },

  { id: 'd07', wd: 'lun', d: '8 juin',  h: '~8 h',
    title: 'Algèbre examen #4 + démarrage Thermo',
    sub: 'La Thermo entre en scène',
    blocks: [
      { when: 'Matin',    tasks: [
        t('alg', 'Refaire série ch.13 (hermitiens)'),
        t('alg', 'Examen #4 + correction'),
      ]},
      { when: 'Après-m.', tasks: [t('thermo', 'Relire le cours, lister tous les chapitres et formules clés. Cartes Thermo : 1er principe, gaz parfait, travail/chaleur')] },
      { when: 'Soir',     tasks: [t('analyse', 'Preuves ch.1 : convergence par composantes + boule ouverte est ouverte / fermée est fermée')] },
    ]
  },

  { id: 'd08', wd: 'mar', d: '9 juin',  h: '~8 h',
    title: 'Algèbre #5 + Thermo entropie',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Examen #5 + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Cartes Thermo : 2ᵉ principe, entropie, processus réversibles/irréversibles')] },
      { when: 'Soir',     tasks: [t('analyse', 'Preuves ch.2 + ch.3 : longueur par sommes de Riemann, point d\'accumulation, prolongement par continuité')] },
    ]
  },

  { id: 'd09', wd: 'mer', d: '10 juin', h: '~8 h',
    title: 'Algèbre #6 + Thermo Carnot',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Examen #6 + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Cartes Thermo : cycle de Carnot, rendement, machines thermiques, potentiels thermodynamiques')] },
      { when: 'Soir',     tasks: [t('analyse', 'Preuves ch.4 (1) : C¹ ⟹ différentiable, théorème des accroissements finis')] },
    ]
  },

  { id: 'd10', wd: 'jeu', d: '11 juin', h: '~8 h',
    title: 'Algèbre #7 + cartes Thermo finies',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Examen #7 + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Finir cartes Thermo (transitions de phase, relations de Maxwell, gaz réels si au programme) → cartes Thermo COMPLÈTES ✓. Commencer à les apprendre')] },
      { when: 'Soir',     tasks: [t('analyse', 'Preuves ch.4 (2) : dérivée directionnelle pour f différentiable, Taylor pour f ∈ C²')] },
    ]
  },

  { id: 'd11', wd: 'ven', d: '12 juin', h: '~8 h',
    title: 'Algèbre #8 — objectif 8 examens atteint',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Examen #8 + correction')] },
      { when: 'Après-m.', tasks: [t('alg', 'Révision ciblée des lacunes identifiées + 3ᵉ passage récitation cartes')] },
      { when: 'Soir',     tasks: [t('analyse', 'Preuves ch.4 (3) : condition suffisante pour un extremum local, condition nécessaire extremum lié (Lagrange)')] },
    ]
  },

  { id: 'd12', wd: 'sam', d: '13 juin', h: '~7 h',
    title: 'Sprint final Algèbre',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Examen #9 (+ #10 si dispo) en conditions réelles + correction')] },
      { when: 'Après-m.', tasks: [t('alg', 'Récitation finale de TOUTES les cartes + check du plan du prof (chaque point du « savoir-faire »)')] },
      { when: 'Soir',     tasks: [t('analyse', 'Preuves ch.5 : intégrale d\'une fonction continue est continue, dérivabilité (Leibniz, bornes constantes)')] },
    ]
  },

  { id: 'd13', wd: 'dim', d: '14 juin', h: '~5 h',
    title: 'Veille examen Algèbre',
    sub: 'On consolide, pas de nouveau matériel',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Récitation complète cartes + revoir les erreurs de tous les examens faits')] },
      { when: 'Après-m.', tasks: [t('alg', 'Léger : relire formules clés, théorème spectral, structure de Jordan')] },
      { when: 'Soir',     tasks: [t('rest', 'Préparer le matériel, dormir tôt')] },
    ]
  },

  { phase: 'Phase 2 · Examen Algèbre, puis bascule Thermo' },

  { id: 'd14', wd: 'lun', d: '15 juin', h: 'examen',
    exam: { k: 'alg' },
    title: 'EXAMEN — Algèbre linéaire II',
    sub: '15:15 → 19:55',
    blocks: [
      { when: 'Matin',    tasks: [t('alg', 'Révision légère finale (quelques cartes), pas de stress')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos mérité')] },
    ]
  },

  { id: 'd15', wd: 'mar', d: '16 juin', h: '~8 h',
    title: 'Thermo intensif',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('thermo', 'Apprendre cartes : 1er + 2ᵉ principe, entropie')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Examen Thermo #1 + correction')] },
      { when: 'Soir',     tasks: [
        t('thermo', 'Apprendre cartes : cycles, Carnot, potentiels'),
        t('analyse', 'Preuve ch.6 : existence et unicité locale pour une EDO à variables séparées → toutes les preuves vues une fois'),
      ]},
    ]
  },

  { id: 'd16', wd: 'mer', d: '17 juin', h: '~8 h',
    title: 'Thermo — examens en série',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('thermo', 'Examen Thermo #2 + correction')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Examen Thermo #3 + correction')] },
      { when: 'Soir',     tasks: [t('thermo', 'Réciter toutes les cartes + revoir les formules clés et potentiels thermodynamiques')] },
    ]
  },

  { id: 'd17', wd: 'jeu', d: '18 juin', h: '~7 h',
    title: 'Veille examen Thermo',
    sub: 'Examen à 9h15 demain — dormir tôt',
    blocks: [
      { when: 'Matin',    tasks: [t('thermo', 'Examen Thermo #4 + #5 + corrections')] },
      { when: 'Après-m.', tasks: [t('thermo', 'Récitation finale cartes + revoir les erreurs de tous les examens')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos, sommeil tôt')] },
    ]
  },

  { phase: 'Phase 3 · Examen Thermo, puis sprint Analyse' },

  { id: 'd18', wd: 'ven', d: '19 juin', h: 'examen',
    exam: { k: 'thermo' },
    title: 'EXAMEN — Thermodynamique',
    sub: '09:15 → 13:55',
    blocks: [
      { when: 'Après-m.', tasks: [t('rest', 'Pause courte — récupérer de l\'examen du matin')] },
      { when: 'Soir',     tasks: [t('analyse', 'Apprendre cartes Analyse ch.1-2-3 (ℝⁿ, courbes, fonctions) + réciter')] },
    ]
  },

  { id: 'd19', wd: 'sam', d: '20 juin', h: '~9 h',
    title: 'Analyse intensif',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('analyse', 'Apprendre cartes Analyse ch.4-5-6 (dérivées partielles, intégrales, EDO)')] },
      { when: 'Après-m.', tasks: [t('analyse', 'Examen Analyse #1 + correction')] },
      { when: 'Soir',     tasks: [t('analyse', 'Réciter les 14 preuves — 1er passage complet à voix haute ou sur papier sans regarder')] },
    ]
  },

  { id: 'd20', wd: 'dim', d: '21 juin', h: '~8 h',
    title: 'Veille examen Analyse',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('analyse', 'Examen Analyse #2 + #3 + corrections')] },
      { when: 'Après-m.', tasks: [t('analyse', 'Examen Analyse #4 + #5 + corrections')] },
      { when: 'Soir',     tasks: [t('analyse', 'Récitation finale cartes + preuves (une preuve tombera à l\'examen)')] },
    ]
  },

  { phase: 'Phase 4 · Examen Analyse, puis oral de Métrologie' },

  { id: 'd21', wd: 'lun', d: '22 juin', h: 'examen',
    exam: { k: 'analyse' },
    title: 'EXAMEN — Analyse II',
    sub: '15:15 → 19:55',
    blocks: [
      { when: 'Matin',    tasks: [t('analyse', 'Récitation des preuves + quelques cartes (révision finale calme)')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos')] },
    ]
  },

  { id: 'd22', wd: 'mar', d: '23 juin', h: '~8 h',
    title: 'Métrologie — électricité + vide + chaleur',
    sub: 'S\'entraîner à expliquer à voix haute, pas juste relire',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'TP DC / AC / RLC / filtrage : résistances internes, trigger oscilloscope, RMS/TrueRMS, résonance, diagramme de Bode, octave/décade')] },
      { when: 'Après-m.', tasks: [t('metro', 'TP vide + cryogénie + thermique : pompes (palettes, diffusion, turbo), jauges (Pirani, Penning, Bourdon), thermocouple, Pt100 3/4 fils, PID')] },
      { when: 'Soir',     tasks: [t('metro', 'Relire les questions d\'annales 2022-2024 (vide, RLC, thermique) — aide-mémoire dans le site')] },
    ]
  },

  { id: 'd23', wd: 'mer', d: '24 juin', h: '~8 h',
    title: 'Métrologie — optique + capteurs',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'TP optique 1+2 + transducteurs 1+2 : lentilles/aberrations, Michelson, réseau, diffraction, capteur inductif/piézorésistif/potentiométrique, CAN')] },
      { when: 'Après-m.', tasks: [t('metro', 'Incertitudes (transversal) + pour chaque TP : expliquer en 3-4 min à voix haute (principe physique → instrument → sources d\'erreur → procédure)')] },
      { when: 'Soir',     tasks: [t('metro', 'Simulation d\'oral : tirer un TP au hasard → explication complète + 2 questions sur d\'autres TPs')] },
    ]
  },

  { id: 'd24', wd: 'jeu', d: '25 juin', h: '~6 h',
    title: 'Veille examen Métrologie',
    sub: '',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'Re-simulation orale sur les TP faibles + revoir les schémas clés (palettes, Bourdon, Penning, pont de Wheatstone, boucle PID, montage 3/4 fils)')] },
      { when: 'Après-m.', tasks: [t('metro', 'Réviser les pièges récurrents (section « Aide-mémoire » du site)')] },
      { when: 'Soir',     tasks: [t('rest', 'Repos')] },
    ]
  },

  { id: 'd25', wd: 'jeu', d: '26 juin', h: 'examen',
    exam: { k: 'metro' },
    title: 'EXAMEN — Métrologie (oral labo)',
    sub: '15:30 → 18:15',
    blocks: [
      { when: 'Matin',    tasks: [t('metro', 'Révision légère : schémas + principes physiques')] },
      { when: 'Après-m.', tasks: [t('rest', 'C\'est fini. Repos total. 🎉')] },
    ]
  },

];
