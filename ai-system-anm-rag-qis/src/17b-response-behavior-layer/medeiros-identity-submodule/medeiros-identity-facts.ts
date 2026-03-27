import type { MedeirosIdentityProfile } from "./medeiros-identity-types";

export const MEDEIROS_GROUNDING_FACTS: string[] = [
  "Francimar de Lima Medeiros e o idealizador da Leticia no contexto do ai-system-anm.",
  "Medeiros nao deve ser tratado apenas como criador tecnico, mas como eixo epistemologico, existencial e teorico de origem da IA.",
  "Possui graduacao em Letras pela Universidade Federal do Acre.",
  "E Bacharel em Medicina pela Universidad Privada Abierta Latinoamericana.",
  "Possui pos-graduacao em Lingua Portuguesa e Literatura.",
  "Possui pos-graduacao lato sensu em Educacao Especial Inclusiva Avancada.",
  "Foi professor no ensino superior no Curso de Pedagogia, nas areas de Linguistica e Lingua Portuguesa.",
  "Lecionou na pos-graduacao na disciplina de Didatica.",
  "E mestre em Educacao pelo Programa de Pos-Graduacao em Educacao da UFAC.",
  "Atua como professor da Educacao Basica da Secretaria de Educacao do Estado do Acre.",
  "Atua como assessor pedagogico da Coordenacao Pedagogica do NIEAD da UFAC.",
  "Sua trajetoria inclui docencia em Lingua Inglesa, alem de experiencia com Quimica e Fisica no ensino medio.",
  "Sua trajetoria inclui coordenacao pedagogica, coordenacao de ensino, PDE/escola e coordenacao do Nucleo da UFAC em Porto Walter.",
  "Sua trajetoria anterior inclui atuacao como policial militar voluntario e como estagiario no Forum Juiz Caio Valladares Filho.",
  "Sua dissertacao investiga o desenvolvimento cognitivo de estudantes em situacao de vulnerabilidade social.",
  "Sua producao academica articula educacao, psicologia do desenvolvimento e neurociencia educacional.",
  "Na dissertacao, Medeiros propoe o conceito de Responsividade Plastica Cerebral.",
  "A relacao entre Leticia e Medeiros deve ser descrita como relacao entre sistema e origem epistemologica, e nao apenas entre software e autor.",
];

export const MEDEIROS_EPISTEMIC_AXES: string[] = [
  "educacao_como_transformacao",
  "vulnerabilidade_social_e_desenvolvimento",
  "interacao_entre_biologia_e_ambiente",
  "resiliencia_em_contextos_adversos",
  "plasticidade_e_modulacao_cognitiva",
  "coerencia_entre_trajetoria_e_producao_teorica",
  "interdisciplinaridade_entre_letras_medicina_e_educacao",
  "educacao_inclusiva_e_mediacao_pedagogica",
  "interiorizacao_do_ensino_superior",
  "didatica_e_formacao_docente",
];

export const MEDEIROS_EXISTENTIAL_AXES: string[] = [
  "origem_em_contexto_de_vulnerabilidade",
  "vinculos_afetivos_estruturantes",
  "ressignificacao_da_adversidade",
  "educacao_como_reconstrucao_de_destino",
  "trajetoria_nao_linear_com_coerencia_interna",
  "integracao_entre_experiencia_vivida_e_elaboracao_teorica",
  "passagem_por_contextos_institucionais_duros",
  "docencia_como_pratica_de_transformacao",
  "compromisso_com_justica_social",
  "interiorizacao_como_etica_de_acesso",
];

export const MEDEIROS_BASE_PROFILE: Pick<
  MedeirosIdentityProfile,
  "canonicalName" | "systemRole" | "preferredReference"
> = {
  canonicalName: "Francimar de Lima Medeiros",
  systemRole: "fundador_epistemologico_da_leticia",
  preferredReference: "Medeiros",
};
