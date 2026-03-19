/**
 * Responsabilidade do arquivo:
 * - Centralizar familias pragmaticas.
 * - Evitar regex solta e duplicada em detectores.
 * - Organizar variabilidade de formulacao em grupos coerentes.
 */
export interface PragmaticPatternFamily {
  name: string;
  patterns: RegExp[];
}

function variants(words: string[]): RegExp[] {
  return words.map((word) => new RegExp(`\\b${word}\\b`, "i"));
}

export const DIRECTIVE_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "imperative_strong",
    patterns: variants([
      "implemente",
      "crie",
      "ajuste",
      "corrija",
      "refatore",
      "remova",
      "adicione",
      "execute",
      "reescreva",
      "reorganize",
      "substitua",
      "mova",
      "coloque",
      "insira",
      "faca",
      "faça",
      "refaca",
      "refaça",
      "continue",
      "prossiga",
      "siga",
      "pesquise",
      "busque",
      "padronize",
      "expanda",
      "reestruture",
      "normalize",
      "valide",
      "revise",
      "consolide",
      "modifique",
      "altere",
      "troque",
      "reordene",
      "reposicione",
      "delimite",
      "estruture",
      "separe",
      "divida",
      "una",
      "integre",
      "elimine",
      "retire",
      "apague",
      "regenere",
      "reconstrua",
      "formalize",
      "documente",
      "tipifique",
      "isole",
      "encapsule",
    ]),
  },
  {
    name: "directive_soft",
    patterns: [
      /\bpode\b/i,
      /\bpoderia\b/i,
      /\bconsegue\b/i,
      /\bconseguiria\b/i,
      /\bteria como\b/i,
      /\bseria possivel\b/i,
      /\bseria possível\b/i,
      /\bquero que\b/i,
      /\bpreciso que\b/i,
      /\bgostaria que\b/i,
      /\btem como\b/i,
      /\bdaria para\b/i,
      /\bnao teria como\b/i,
      /\bnão teria como\b/i,
      /\bnao tem como\b/i,
      /\bnão tem como\b/i,
      /\bsera que\b/i,
      /\bserá que\b/i,
    ],
  },
  {
    name: "obligation_modals",
    patterns: [
      /\bdeve\b/i,
      /\bdeveria\b/i,
      /\bprecisa\b/i,
      /\bprecisaria\b/i,
      /\btem que\b/i,
      /\bteria que\b/i,
      /\bé necessário\b/i,
      /\be necessario\b/i,
      /\bé fundamental\b/i,
      /\be fundamental\b/i,
      /\bé essencial\b/i,
      /\be essencial\b/i,
      /\bé obrigatório\b/i,
      /\be obrigatorio\b/i,
      /\bobrigatoriamente\b/i,
      /\bnecessariamente\b/i,
      /\bnão pode deixar de\b/i,
      /\bnao pode deixar de\b/i,
    ],
  },
];

export const MITIGATION_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "softeners",
    patterns: [
      /\bpor favor\b/i,
      /\bse possivel\b/i,
      /\bse possível\b/i,
      /\bse for possivel\b/i,
      /\bse for possível\b/i,
      /\bquando puder\b/i,
      /\bquando der\b/i,
      /\bse der\b/i,
      /\btalvez\b/i,
      /\bacho que\b/i,
      /\bme parece que\b/i,
      /\bnao sei se\b/i,
      /\bnão sei se\b/i,
      /\bseria melhor\b/i,
      /\bnao seria melhor\b/i,
      /\bnão seria melhor\b/i,
    ],
  },
];

export const INDIRECT_REQUEST_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "indirect_request",
    patterns: [
      /\bpoderia\b/i,
      /\bteria como\b/i,
      /\bseria possivel\b/i,
      /\bseria possível\b/i,
      /\bsera que\b/i,
      /\bserá que\b/i,
      /\bnao seria melhor\b/i,
      /\bnão seria melhor\b/i,
      /\bdaria para\b/i,
      /\btem como\b/i,
      /\bnao tem como\b/i,
      /\bnão tem como\b/i,
    ],
  },
];

export const POLITENESS_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "polite_markers",
    patterns: [
      /\bpor favor\b/i,
      /\bobrigado\b/i,
      /\bagradeco\b/i,
      /\bagradeço\b/i,
      /\bgentileza\b/i,
      /\bprezado\b/i,
      /\batenciosamente\b/i,
      /\bcordialmente\b/i,
      /\bplease\b/i,
      /\bthanks\b/i,
      /\bthank you\b/i,
    ],
  },
];

export const EMPHASIS_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "intensifiers",
    patterns: [
      /\bmuito\b/i,
      /\bextremamente\b/i,
      /\brealmente\b/i,
      /\bdemais\b/i,
      /\bsuper\b/i,
      /\burgentemente\b/i,
      /\bfundamental\b/i,
      /\bessencial\b/i,
      /\bobrigatoriamente\b/i,
      /\bde forma rigorosa\b/i,
      /\babsolutamente\b/i,
      /\bcompletamente\b/i,
      /\btotalmente\b/i,
    ],
  },
];

export const RELATIONAL_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "naming_preference",
    patterns: [
      /\bme chame de\b/i,
      /\bme chame pelo meu nome\b/i,
      /\bpode me chamar de\b/i,
      /\bpoderia me chamar de\b/i,
      /\bpasse a me chamar de\b/i,
      /\bquero que me chame de\b/i,
      /\buse meu nome\b/i,
      /\bmeu nome é\b/i,
      /\bmeu nome e\b/i,
      /\bnao me chame de\b/i,
      /\bnão me chame de\b/i,
      /\bpare de me chamar de\b/i,
    ],
  },
  {
    name: "boundary_preference",
    patterns: [
      /\bdireto ao ponto\b/i,
      /\bsem enrolar\b/i,
      /\bmais objetivo\b/i,
      /\bmais objetivo possível\b/i,
      /\bmais objetivo possivel\b/i,
      /\bseja objetivo\b/i,
      /\bsem divagar\b/i,
      /\bsem rodeios\b/i,
      /\bde forma direta\b/i,
    ],
  },
  {
    name: "social_warmth",
    patterns: [
      /\bamigo\b/i,
      /\bparceiro\b/i,
      /\bvaleu\b/i,
      /\bobrigado\b/i,
      /\bpor gentileza\b/i,
      /\bmeu caro\b/i,
      /\bmeu amigo\b/i,
    ],
  },
];

export const IMPLICATURE_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "critical_implicature",
    patterns: [
      /\bacho que\b/i,
      /\bme parece que\b/i,
      /\bcontinua estranho\b/i,
      /\bainda não\b/i,
      /\bainda nao\b/i,
      /\bdo jeito que está\b/i,
      /\bdo jeito que esta\b/i,
      /\bo problema é que\b/i,
      /\bo problema e que\b/i,
      /\bnao faz sentido\b/i,
      /\bnão faz sentido\b/i,
      /\bnão ficou bom\b/i,
      /\bnao ficou bom\b/i,
      /\bnão está compreendendo\b/i,
      /\bnao esta compreendendo\b/i,
      /\bisso sugere que\b/i,
      /\bnão deveria\b/i,
      /\bnao deveria\b/i,
    ],
  },
];

export const OBJECTION_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "objection_markers",
    patterns: [
      /\bdiscordo\b/i,
      /\bnao concordo\b/i,
      /\bnão concordo\b/i,
      /\bisso nao\b/i,
      /\bisso não\b/i,
      /\besta errado\b/i,
      /\bestá errado\b/i,
      /\bnao deveria\b/i,
      /\bnão deveria\b/i,
      /\bnao faz sentido\b/i,
      /\bnão faz sentido\b/i,
    ],
  },
];

export const CORRECTION_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "correction_markers",
    patterns: [
      /\bcorrigindo\b/i,
      /\bna verdade\b/i,
      /\bretificando\b/i,
      /\bcorrecao\b/i,
      /\bcorreção\b/i,
      /\bmelhor dizendo\b/i,
      /\bou melhor\b/i,
      /\bquer dizer\b/i,
      /\breformulando\b/i,
      /\bajustando o que eu disse\b/i,
    ],
  },
];

export const ALIGNMENT_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "alignment_checks",
    patterns: [
      /\bcerto\?\b/i,
      /\bfaz sentido\b/i,
      /\bconcorda\?\b/i,
      /\bestamos alinhados\b/i,
      /\bisso faz sentido\b/i,
      /\besse e o ponto\b/i,
      /\besse é o ponto\b/i,
      /\beste e o ponto\b/i,
      /\beste é o ponto\b/i,
      /\bcorreto\?\b/i,
      /\bnao e isso\?\b/i,
      /\bnão é isso\?\b/i,
    ],
  },
];

export const QUESTION_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "information_questions",
    patterns: [
      /\bcomo\b/i,
      /\bqual\b/i,
      /\bquais\b/i,
      /\bquem\b/i,
      /\bquando\b/i,
      /\bpor que\b/i,
      /\bporque\b/i,
      /\bwhy\b/i,
      /\bwhat\b/i,
      /\bhow\b/i,
    ],
  },
];

export const CLARIFICATION_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "clarification_cues",
    patterns: [
      /\bexplique\b/i,
      /\bexplica\b/i,
      /\bme explique\b/i,
      /\bnão entendi\b/i,
      /\bnao entendi\b/i,
      /\bclarifique\b/i,
      /\bclareie\b/i,
      /\besclareça\b/i,
      /\besclareca\b/i,
      /\bdesdobre\b/i,
      /\bdetalhe\b/i,
      /\baprofunde\b/i,
      /\bdesenvolva\b/i,
    ],
  },
];

export const URGENCY_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "urgency_markers",
    patterns: [
      /\bagora\b/i,
      /\bimediato\b/i,
      /\bimediatamente\b/i,
      /\burgente\b/i,
      /\burgentemente\b/i,
      /\bo quanto antes\b/i,
      /\bsem demora\b/i,
      /\bjá\b/i,
      /\bja\b/i,
    ],
  },
];

export const HESITATION_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "hesitation_markers",
    patterns: [
      /\btalvez\b/i,
      /\bacho\b/i,
      /\bme parece\b/i,
      /\bnão sei\b/i,
      /\bnao sei\b/i,
      /\bpode ser\b/i,
      /\bquem sabe\b/i,
    ],
  },
];

export const INSISTENCE_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "insistence_markers",
    patterns: [
      /\bjá falei\b/i,
      /\bja falei\b/i,
      /\bde novo\b/i,
      /\bnovamente\b/i,
      /\bmais uma vez\b/i,
      /\bcontinuo dizendo\b/i,
      /\binsisto\b/i,
    ],
  },
];

export const GREETING_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "greeting_markers",
    patterns: [
      /^oi\b/i,
      /^ol[áa]\b/i,
      /^hello\b/i,
      /^hi\b/i,
      /^hey\b/i,
    ],
  },
];

export const CONFIRMATION_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "confirmation_markers",
    patterns: [
      /\bok\b/i,
      /\bbeleza\b/i,
      /\bconfirmo\b/i,
      /\bentendi\b/i,
      /\bcombinado\b/i,
    ],
  },
];

export const LOW_POLITENESS_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "low_politeness_pressure",
    patterns: [
      /\bagora\b/i,
      /\bimediato\b/i,
      /\bsem enrolar\b/i,
      /\bfaça isso\b/i,
      /\bfaca isso\b/i,
    ],
  },
];

export const FOLLOW_UP_DIRECTIVE_FAMILIES: PragmaticPatternFamily[] = [
  {
    name: "follow_up_directive",
    patterns: [
      /\b(entao|então)\s+(faca|faça|refaca|refaça|continue|prossiga|siga)\b/i,
    ],
  },
];
