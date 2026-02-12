export type LikertScaleOption = {
  value: number
  labelFr: string
}

export type LikertQuestion = {
  id: string
  type: 'likert'
  textFr: string
  scale: LikertScaleOption[]
}

export type BipolarQuestion = {
  id: string
  type: 'bipolar'
  leftFr: string
  rightFr: string
  // Valeurs de l’échelle, typiquement [-3, -2, -1, 0, 1, 2, 3]
  scaleValues: number[]
}

export type QuestionnaireQuestion = LikertQuestion | BipolarQuestion

export type QuestionnaireDefinition = {
  id: 'sus' | 'deep' | 'umux' | 'umux_lite' | 'attrakdiff' | 'attrakdiff_abridged'
  nameFr: string
  descriptionHtmlFr: string
  questions: QuestionnaireQuestion[]
}

const LIKERT_5_SUS: LikertScaleOption[] = [
  { value: 0, labelFr: 'Pas du tout d\'accord' },
  { value: 1, labelFr: 'Plutôt pas d\'accord' },
  { value: 2, labelFr: 'Ni d\'accord ni pas d\'accord' },
  { value: 3, labelFr: 'Plutôt d\'accord' },
  { value: 4, labelFr: 'Tout à fait d\'accord' },
]

const LIKERT_6_DEEP: LikertScaleOption[] = [
  { value: 1, labelFr: 'Pas du tout d\'accord' },
  { value: 2, labelFr: 'Plutôt pas d\'accord' },
  { value: 3, labelFr: 'Plutôt en désaccord' },
  { value: 4, labelFr: 'Plutôt d\'accord' },
  { value: 5, labelFr: 'Tout à fait d\'accord' },
  // 0 = Non applicable (géré séparément dans l’UI)
]

const LIKERT_7_UMUX: LikertScaleOption[] = [
  { value: 0, labelFr: 'Pas du tout d\'accord' },
  { value: 1, labelFr: '...' },
  { value: 2, labelFr: '...' },
  { value: 3, labelFr: 'Ni d\'accord ni pas d\'accord' },
  { value: 4, labelFr: '...' },
  { value: 5, labelFr: '...' },
  { value: 6, labelFr: 'Tout à fait d\'accord' },
]

const SUS: QuestionnaireDefinition = {
  id: 'sus',
  nameFr: 'System Usability Scale (SUS)',
  descriptionHtmlFr:
    'Mesure de <strong>l’utilisabilité</strong> d’un <strong>système</strong>. Peut également fournir une mesure de l’apprentissage (<em>learnability</em>).',
  questions: [
    {
      id: 'Q1',
      type: 'likert',
      textFr: 'Je pense que j\'aimerais utiliser @product_type fréquemment.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q2',
      type: 'likert',
      textFr: 'J\'ai trouvé @product_type inutilement complexe.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q3',
      type: 'likert',
      textFr: 'J\'ai trouvé @product_type facile à utiliser.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q4',
      type: 'likert',
      textFr:
        'Je pense que j\'aurais besoin d\'un support technique pour être capable d\'utiliser @product_type.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q5',
      type: 'likert',
      textFr:
        'J\'ai trouvé que les différentes fonctions de @product_type étaient bien intégrées.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q6',
      type: 'likert',
      textFr: 'J\'ai trouvé qu\'il y avait trop d\'incohérence dans @product_type.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q7',
      type: 'likert',
      textFr:
        'Je suppose que la plupart des gens apprendraient très rapidement à utiliser @product_type.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q8',
      type: 'likert',
      textFr: 'J\'ai trouvé @product_type très contraignant à utiliser.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q9',
      type: 'likert',
      textFr: 'Je me suis senti(e) très confiant(e) en utilisant @product_type.',
      scale: LIKERT_5_SUS,
    },
    {
      id: 'Q10',
      type: 'likert',
      textFr:
        'J\'ai dû apprendre beaucoup de choses avant de me sentir familiarisé(e) avec @product_type.',
      scale: LIKERT_5_SUS,
    },
  ],
}

const DEEP: QuestionnaireDefinition = {
  id: 'deep',
  nameFr: 'Design-oriented Evaluation of Perceived Web Usability (DEEP)',
  descriptionHtmlFr:
    'Mesure de <strong>l’utilisabilité</strong> des <strong>sites web</strong> en six dimensions (contenu, structure, navigation, effort cognitif, cohérence, guidage visuel).',
  questions: [
    {
      id: 'Q1',
      type: 'likert',
      textFr: 'Le libellé du texte était clair.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q2',
      type: 'likert',
      textFr:
        'Le contenu (texte, images, sons, vidéos, etc.) était facile à comprendre.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q3',
      type: 'likert',
      textFr: 'Le texte était utile.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q4',
      type: 'likert',
      textFr: 'Le texte était pertinent.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q5',
      type: 'likert',
      textFr:
        'Je pouvais rapidement connaître la structure du site web en parcourant sa page d\'accueil.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q6',
      type: 'likert',
      textFr: 'L\'organisation du site web était claire.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q7',
      type: 'likert',
      textFr:
        'Dans chaque section du site web, les pages étaient bien organisées.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q8',
      type: 'likert',
      textFr:
        'Il était facile de trouver l\'information dont j\'avais besoin sur le site web.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q9',
      type: 'likert',
      textFr: 'Le site web m\'a aidé à trouver ce que je cherchais.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q10',
      type: 'likert',
      textFr:
        'J\'ai obtenu ce à quoi je m\'attendais quand je cliquais sur les éléments du site web.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q11',
      type: 'likert',
      textFr: 'Utiliser ce site web s\'est fait sans effort.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q12',
      type: 'likert',
      textFr: 'Utiliser ce site web m\'a fatigué.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q13',
      type: 'likert',
      textFr: 'J\'ai appris à utiliser ce site web rapidement.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q14',
      type: 'likert',
      textFr:
        'La mise en page à travers tout le site web était cohérente.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q15',
      type: 'likert',
      textFr:
        'J\'ai remarqué des changements soudains de mise en page à travers le site web.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q16',
      type: 'likert',
      textFr:
        'La mise en page de chaque section du site web était cohérente.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q17',
      type: 'likert',
      textFr:
        'Les couleurs m\'ont aidé à distinguer les différentes sections du site web.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q18',
      type: 'likert',
      textFr:
        'Les zones mises en évidence d\'une page m\'ont aidé à repérer l\'information dont j\'avais besoin.',
      scale: LIKERT_6_DEEP,
    },
    {
      id: 'Q19',
      type: 'likert',
      textFr:
        'J\'ai appris à connaître le contenu d\'une page en parcourant les zones mises en évidence.',
      scale: LIKERT_6_DEEP,
    },
  ],
}

const UMUX: QuestionnaireDefinition = {
  id: 'umux',
  nameFr: 'Usability Metric for User Experience (UMUX)',
  descriptionHtmlFr:
    'Mesure de <strong>l’utilisabilité</strong> d’un <strong>système</strong> en 4 items.',
  questions: [
    {
      id: 'Q1',
      type: 'likert',
      textFr: 'Les fonctionnalités de @product_type répondent à mes exigences.',
      scale: LIKERT_7_UMUX,
    },
    {
      id: 'Q2',
      type: 'likert',
      textFr: 'Utiliser @product_type est une expérience frustrante.',
      scale: LIKERT_7_UMUX,
    },
    {
      id: 'Q3',
      type: 'likert',
      textFr: '@product_type est facile à utiliser.',
      scale: LIKERT_7_UMUX,
    },
    {
      id: 'Q4',
      type: 'likert',
      textFr: 'Je dois passer trop de temps à corriger des choses sur @product_type.',
      scale: LIKERT_7_UMUX,
    },
  ],
}

const UMUX_LITE: QuestionnaireDefinition = {
  id: 'umux_lite',
  nameFr: 'Usability Metric for User Experience (UMUX-Lite)',
  descriptionHtmlFr:
    'Mesure synthétique de <strong>l’utilisabilité</strong> et de <strong>l’utilité</strong> d’un <strong>système</strong> (2 items).',
  questions: [
    {
      id: 'Q1',
      type: 'likert',
      textFr: 'Les fonctionnalités de @product_type répondent à mes exigences.',
      scale: LIKERT_7_UMUX,
    },
    {
      id: 'Q3',
      type: 'likert',
      textFr: '@product_type est facile à utiliser.',
      scale: LIKERT_7_UMUX,
    },
  ],
}

const ATTRAKDIFF: QuestionnaireDefinition = {
  id: 'attrakdiff',
  nameFr: 'AttrakDiff',
  descriptionHtmlFr:
    'Questionnaire différentiel bipolaire pour mesurer l’expérience utilisateur (qualités pragmatiques, hédoniques, attractivité globale).',
  questions: [
    { id: 'QP1', type: 'bipolar', leftFr: 'Technique', rightFr: 'Humain', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QP2', type: 'bipolar', leftFr: 'Compliqué', rightFr: 'Simple', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QP3', type: 'bipolar', leftFr: 'Pas pratique', rightFr: 'Pratique', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QP4', type: 'bipolar', leftFr: 'Fastidieux', rightFr: 'Efficace', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QP5', type: 'bipolar', leftFr: 'Imprévisible', rightFr: 'Prévisible', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QP6', type: 'bipolar', leftFr: 'Confus', rightFr: 'Clair', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QP7', type: 'bipolar', leftFr: 'Incontrôlable', rightFr: 'Maîtrisable', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },

    { id: 'QHI1', type: 'bipolar', leftFr: 'M’isole', rightFr: 'Me sociabilise', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHI2', type: 'bipolar', leftFr: 'Amateur', rightFr: 'Professionnel', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHI3', type: 'bipolar', leftFr: 'De mauvais goût', rightFr: 'De bon goût', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHI4', type: 'bipolar', leftFr: 'Bas de gamme', rightFr: 'Haut de gamme', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHI5', type: 'bipolar', leftFr: 'M’exclut', rightFr: 'M’intègre', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    {
      id: 'QHI6',
      type: 'bipolar',
      leftFr: 'Me sépare des autres',
      rightFr: 'Me rapproche des autres',
      scaleValues: [-3, -2, -1, 0, 1, 2, 3],
    },
    { id: 'QHI7', type: 'bipolar', leftFr: 'Non présentable', rightFr: 'Présentable', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },

    { id: 'QHS1', type: 'bipolar', leftFr: 'Conventionnel', rightFr: 'Original', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHS2', type: 'bipolar', leftFr: 'Sans imagination', rightFr: 'Créatif', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHS3', type: 'bipolar', leftFr: 'Prudent', rightFr: 'Audacieux', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHS4', type: 'bipolar', leftFr: 'Conservateur', rightFr: 'Novateur', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHS5', type: 'bipolar', leftFr: 'Ennuyeux', rightFr: 'Captivant', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHS6', type: 'bipolar', leftFr: 'Peu exigeant', rightFr: 'Challenging', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QHS7', type: 'bipolar', leftFr: 'Commun', rightFr: 'Nouveau', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },

    { id: 'ATT1', type: 'bipolar', leftFr: 'Déplaisant', rightFr: 'Plaisant', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'ATT2', type: 'bipolar', leftFr: 'Laid', rightFr: 'Beau', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'ATT3', type: 'bipolar', leftFr: 'Désagréable', rightFr: 'Agréable', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'ATT4', type: 'bipolar', leftFr: 'Rebutant', rightFr: 'Attirant', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'ATT5', type: 'bipolar', leftFr: 'Mauvais', rightFr: 'Bon', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'ATT6', type: 'bipolar', leftFr: 'Repoussant', rightFr: 'Attrayant', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'ATT7', type: 'bipolar', leftFr: 'Décourageant', rightFr: 'Motivant', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
  ],
}

const ATTRAKDIFF_ABRIGED: QuestionnaireDefinition = {
  id: 'attrakdiff_abridged',
  nameFr: 'AttrakDiff (abrégé)',
  descriptionHtmlFr:
    'Version abrégée d’AttrakDiff (10 paires de mots) couvrant les qualités pragmatiques, hédoniques et l’attractivité globale.',
  questions: [
    // ATT2, ATT5, QP2, QP3, QP5, QP6, QHS2, QHS5, QHI3, QHI4
    { id: 'QP2', type: 'bipolar', leftFr: 'Compliqué', rightFr: 'Simple', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'ATT2', type: 'bipolar', leftFr: 'Laid', rightFr: 'Beau', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    { id: 'QP3', type: 'bipolar', leftFr: 'Pas pratique', rightFr: 'Pratique', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    {
      id: 'QHI3',
      type: 'bipolar',
      leftFr: 'De mauvais goût',
      rightFr: 'De bon goût',
      scaleValues: [-3, -2, -1, 0, 1, 2, 3],
    },
    {
      id: 'QP5',
      type: 'bipolar',
      leftFr: 'Imprévisible',
      rightFr: 'Prévisible',
      scaleValues: [-3, -2, -1, 0, 1, 2, 3],
    },
    {
      id: 'QHI4',
      type: 'bipolar',
      leftFr: 'Bas de gamme',
      rightFr: 'Haut de gamme',
      scaleValues: [-3, -2, -1, 0, 1, 2, 3],
    },
    {
      id: 'QHS2',
      type: 'bipolar',
      leftFr: 'Sans imagination',
      rightFr: 'Créatif',
      scaleValues: [-3, -2, -1, 0, 1, 2, 3],
    },
    {
      id: 'ATT5',
      type: 'bipolar',
      leftFr: 'Mauvais',
      rightFr: 'Bon',
      scaleValues: [-3, -2, -1, 0, 1, 2, 3],
    },
    { id: 'QP6', type: 'bipolar', leftFr: 'Confus', rightFr: 'Clair', scaleValues: [-3, -2, -1, 0, 1, 2, 3] },
    {
      id: 'QHS5',
      type: 'bipolar',
      leftFr: 'Ennuyeux',
      rightFr: 'Captivant',
      scaleValues: [-3, -2, -1, 0, 1, 2, 3],
    },
  ],
}

export const QUESTIONNAIRES: QuestionnaireDefinition[] = [
  SUS,
  DEEP,
  UMUX,
  UMUX_LITE,
  ATTRAKDIFF,
  ATTRAKDIFF_ABRIGED,
]

export const getQuestionnaireById = (id: QuestionnaireDefinition['id']): QuestionnaireDefinition | undefined =>
  QUESTIONNAIRES.find((q) => q.id === id)

/**
 * Instructions par défaut pré-remplies à la création d'un projet.
 * Le placeholder @product_name est remplacé par le nom du projet côté répondant.
 */
export const DEFAULT_INSTRUCTIONS: Record<QuestionnaireDefinition['id'], string> = {
  sus: `Nous souhaitons évaluer de la facilité d'utilisation de @product_name.\nDes affirmations vont vous être présentées. Veuillez donner votre degré d'accord avec celles-ci (de "pas du tout d'accord" à "tout à fait d'accord").`,

  deep: `Veuillez répondre aux questions suivantes d'après votre expérience avec le site web @product_name.`,

  umux: `Nous souhaitons évaluer de la facilité d'utilisation de @product_name.\nDes affirmations vont vous être présentées. Veuillez donner votre degré d'accord avec celles-ci (de "pas du tout d'accord" à "tout à fait d'accord").`,

  umux_lite: `Nous souhaitons évaluer de la facilité d'utilisation de @product_name.\nDes affirmations vont vous être présentées. Veuillez donner votre degré d'accord avec celles-ci (de "pas du tout d'accord" à "tout à fait d'accord").`,

  attrakdiff: `Dans le cadre d'un projet sur l'expérience utilisateur, nous souhaiterions évaluer vos impressions sur @product_name.\n\n• Ce questionnaire se présente sous forme de paires de mots pour vous assister dans l'évaluation du système.\n• Chaque paire représente des contrastes. Les échelons entre les deux extrémités vous permettent de décrire l'intensité de la qualité choisie.\n• Ne pensez pas aux paires de mots et essayez simplement de donner une réponse spontanée.\n• Vous pourrez avoir l'impression que certains termes ne décrivent pas correctement le système. Dans ce cas, assurez-vous de donner tout de même une réponse.\n• Gardez à l'esprit qu'il n'y a pas de bonne ou mauvaise réponse. Seule votre opinion compte !`,

  attrakdiff_abridged: `Dans le cadre d'un projet sur l'expérience utilisateur, nous souhaiterions évaluer vos impressions sur @product_name.\n\n• Ce questionnaire se présente sous forme de paires de mots pour vous assister dans l'évaluation du système.\n• Chaque paire représente des contrastes. Les échelons entre les deux extrémités vous permettent de décrire l'intensité de la qualité choisie.\n• Ne pensez pas aux paires de mots et essayez simplement de donner une réponse spontanée.\n• Vous pourrez avoir l'impression que certains termes ne décrivent pas correctement le système. Dans ce cas, assurez-vous de donner tout de même une réponse.\n• Gardez à l'esprit qu'il n'y a pas de bonne ou mauvaise réponse. Seule votre opinion compte !`,
}

