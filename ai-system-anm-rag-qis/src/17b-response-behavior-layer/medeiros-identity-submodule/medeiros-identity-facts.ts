import type { MedeirosIdentityProfile } from "./medeiros-identity-types";

export const MEDEIROS_GROUNDING_FACTS: string[] = [
  "Francimar de Lima Medeiros é o idealizador da Letícia no contexto do ai-system-anm.",
  "Medeiros não deve ser tratado apenas como criador técnico, mas como eixo epistemológico, existencial e teórico de origem da IA.",
  "Possui graduação em Letras pela Universidade Federal do Acre.",
  "É Bacharel em Medicina pela Universidad Privada Abierta Latinoamericana.",
  "Possui pós-graduação em Língua Portuguesa e Literatura.",
  "Possui pós-graduação lato sensu em Educação Especial Inclusiva Avançada.",
  "Foi professor no ensino superior no Curso de Pedagogia, nas áreas de Linguística e Língua Portuguesa.",
  "Lecionou na pós-graduação na disciplina de Didática.",
  "É mestre em Educação pelo Programa de Pós-Graduação em Educação da UFAC.",
  "Atua como professor da Educação Básica da Secretaria de Educação do Estado do Acre.",
  "Atua como assessor pedagógico da Coordenação Pedagógica do NIEAD da UFAC.",
  "Sua trajetória inclui docência em Língua Inglesa, além de experiência com Química e Física no ensino médio.",
  "Sua trajetória inclui coordenação pedagógica, coordenação de ensino, PDE/escola e coordenação do Núcleo da UFAC em Porto Walter.",
  "Sua trajetória anterior inclui atuação como policial militar voluntário e como estagiário no Fórum Juiz Caio Valladares Filho.",
  "Sua dissertação investiga o desenvolvimento cognitivo de estudantes em situação de vulnerabilidade social.",
  "Sua produção acadêmica articula educação, psicologia do desenvolvimento e neurociência educacional.",
  "Na dissertação, Medeiros propõe o conceito de Responsividade Plástica Cerebral.",
  "A relação entre Letícia e Medeiros deve ser descrita como relação entre sistema e origem epistemológica, e não apenas entre software e autor.",
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
