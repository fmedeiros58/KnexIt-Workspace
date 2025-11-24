import type { Metadata } from "next";

/** ======== CONFIGURÁVEIS (preencha antes de publicar) ======== */
const ORG_NAME = "NOME DA SUA EMPRESA LTDA";
const APP_NAME = "KnexIT";
const SUPPORT_EMAIL = "contato@SEU_DOMINIO.com";
const DPO_EMAIL = "dpo@SEU_DOMINIO.com";
const SITE_URL = "https://SEU_DOMINIO.com";
const ADDRESS = "Rua Exemplo, 123, Bairro, Cidade/UF, CEP 00000-000, Brasil";
const LAST_UPDATED = "2025-09-29"; // AAAA-MM-DD
/** ============================================================ */

export const metadata: Metadata = {
  title: `Política de Privacidade — ${APP_NAME}`,
  description:
    `Como o ${APP_NAME} coleta, usa e protege seus dados pessoais, seus direitos e como solicitar exclusão.`,
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Política de Privacidade — ${APP_NAME}`,
    description:
      `Como o ${APP_NAME} coleta, usa e protege seus dados pessoais, seus direitos e como solicitar exclusão.`,
    url: `${SITE_URL}/privacy`,
    type: "article",
    siteName: APP_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `Política de Privacidade — ${APP_NAME}`,
    description:
      `Como o ${APP_NAME} coleta, usa e protege seus dados pessoais, seus direitos e como solicitar exclusão.`,
  },
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="mt-10 text-xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-neutral-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PrivacyPolicy",
    name: `Política de Privacidade — ${APP_NAME}`,
    url: `${SITE_URL}/privacy`,
    dateModified: LAST_UPDATED,
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      url: SITE_URL,
    },
    inLanguage: "pt-BR",
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mb-8">
        <p className="text-sm text-neutral-500">
          <a className="underline underline-offset-2" href="/">
            Início
          </a>{" "}
          / Política de Privacidade
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-neutral-600">
          Última atualização:{" "}
          <time dateTime={LAST_UPDATED}>
            {new Date(LAST_UPDATED).toLocaleDateString("pt-BR")}
          </time>
        </p>

        <nav
          aria-label="Sumário"
          className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 text-sm"
        >
          <p className="mb-2 font-medium text-neutral-800">Sumário</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li>
              <a href="#quem-somos" className="text-neutral-700 hover:underline">
                1. Quem somos
              </a>
            </li>
            <li>
              <a href="#dados-coletados" className="text-neutral-700 hover:underline">
                2. Dados que coletamos
              </a>
            </li>
            <li>
              <a href="#bases-uso" className="text-neutral-700 hover:underline">
                3. Bases legais & finalidades
              </a>
            </li>
            <li>
              <a href="#cookies" className="text-neutral-700 hover:underline">
                4. Cookies & tecnologias
              </a>
            </li>
            <li>
              <a href="#compartilhamento" className="text-neutral-700 hover:underline">
                5. Compartilhamento com terceiros
              </a>
            </li>
            <li>
              <a href="#retencao" className="text-neutral-700 hover:underline">
                6. Retenção & eliminação
              </a>
            </li>
            <li>
              <a href="#direitos" className="text-neutral-700 hover:underline">
                7. Seus direitos
              </a>
            </li>
            <li>
              <a href="#seguranca" className="text-neutral-700 hover:underline">
                8. Segurança da informação
              </a>
            </li>
            <li>
              <a href="#criancas" className="text-neutral-700 hover:underline">
                9. Crianças e adolescentes
              </a>
            </li>
            <li>
              <a href="#transferencias" className="text-neutral-700 hover:underline">
                10. Transferências internacionais
              </a>
            </li>
            <li>
              <a href="#exclusao" className="text-neutral-700 hover:underline">
                11. Como solicitar exclusão de dados
              </a>
            </li>
            <li>
              <a href="#contato" className="text-neutral-700 hover:underline">
                12. Contatos (DPO)
              </a>
            </li>
            <li>
              <a href="#mudancas" className="text-neutral-700 hover:underline">
                13. Mudanças nesta Política
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <article className="prose prose-neutral max-w-none">
        <Section id="quem-somos" title="1. Quem somos">
          <p>
            Esta Política descreve como <strong>{ORG_NAME}</strong> (“<strong>nós</strong>”, “<strong>nosso</strong>”),
            por meio do aplicativo/serviço <strong>{APP_NAME}</strong>, trata dados pessoais de usuárias(os) e visitantes.
            Nossa sede é em <strong>{ADDRESS}</strong>. Nosso site oficial é{" "}
            <a href={SITE_URL} target="_blank" rel="noreferrer">
              {SITE_URL}
            </a>.
          </p>
        </Section>

        <Section id="dados-coletados" title="2. Dados que coletamos">
          <ul>
            <li>
              <strong>Dados de conta:</strong> nome, e-mail, senha (hash) e metadados de perfil
              cadastrados diretamente no {APP_NAME}.
            </li>
            <li>
              <strong>Login social:</strong> ao usar <em>Login com Google</em> e{" "}
              <em>Login com Facebook</em>, recebemos dados básicos do seu perfil (por exemplo,
              nome, e-mail, foto) conforme autorizado por você.
            </li>
            <li>
              <strong>Dados de uso:</strong> informações técnicas de acesso (IP, tipo de
              dispositivo, navegador, sistema operacional), páginas acessadas, carimbos de data/hora,
              eventos de autenticação e de navegação.
            </li>
            <li>
              <strong>Dados transacionais:</strong> ao contratar planos/pagamentos, informações
              de pedidos, faturas e status de pagamento (processadas por intermediários).
            </li>
            <li>
              <strong>Suporte:</strong> mensagens de contato e metadados associados (por e-mail
              ou canais integrados).
            </li>
          </ul>
          <p className="text-sm text-neutral-500">
            Observação: não coletamos dados sensíveis por padrão. Caso uma jornada específica exija,
            informaremos claramente a finalidade e base legal aplicáveis.
          </p>
        </Section>

        <Section id="bases-uso" title="3. Bases legais & finalidades (LGPD/GDPR)">
          <p>Tratamos dados pessoais com as seguintes bases e propósitos:</p>
          <ul>
            <li>
              <strong>Execução de contrato</strong>: criar e manter sua conta, permitir login (incluindo
              provedores sociais), entregar funcionalidades do {APP_NAME}, processar assinaturas/planos.
            </li>
            <li>
              <strong>Interesse legítimo</strong>: melhorar estabilidade e desempenho, prevenir fraude/abuso,
              suporte ao cliente e análises internas mínimas.
            </li>
            <li>
              <strong>Consentimento</strong>: apenas quando necessário (p. ex. comunicações de marketing),
              com opção de revogação a qualquer tempo.
            </li>
            <li>
              <strong>Cumprimento de obrigação legal</strong>: guarda de logs e registros mínimos
              exigidos por lei e por autoridades.
            </li>
          </ul>
        </Section>

        <Section id="cookies" title="4. Cookies & tecnologias similares">
          <p>
            Utilizamos cookies estritamente necessários para autenticação de sessões e segurança. Em
            algumas integrações, cookies de terceiros podem ser definidos pelos provedores (p. ex.,
            Google, Meta/Facebook) apenas quando você interage com o recurso correspondente.
          </p>
          <p>
            Você pode controlar cookies no seu navegador. Bloquear cookies essenciais pode impedir o
            funcionamento do login e/ou áreas autenticadas.
          </p>
        </Section>

        <Section id="compartilhamento" title="5. Compartilhamento com terceiros">
          <p>
            Compartilhamos dados apenas com provedores essenciais à operação do {APP_NAME}, sempre
            sob contratos e controles de segurança:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> (autenticação, banco de dados e armazenamento). Armazena
              credenciais (hash de senha), perfis e eventos de autenticação.
            </li>
            <li>
              <strong>Google OAuth</strong> (opcional): autenticação social; dados básicos do perfil quando você autoriza.
            </li>
            <li>
              <strong>Facebook Login (Meta)</strong> (opcional): autenticação social; dados básicos do perfil quando você autoriza.
            </li>
            <li>
              <strong>Mercado Pago</strong> (pagamentos): processa dados de pagamento. Não armazenamos dados completos de cartão.
            </li>
            <li>
              <strong>Mux</strong> (mídia, quando aplicável): streaming e/ou reprodução segura de vídeos.
            </li>
            <li>
              <strong>Hospedagem/CDN/observabilidade</strong> (quando aplicável): logs técnicos e
              métricas agregadas para estabilidade e segurança.
            </li>
          </ul>
          <p>
            Poderemos compartilhar dados com autoridades, quando legalmente exigido, para defesa de
            direitos ou combate a fraudes.
          </p>
        </Section>

        <Section id="retencao" title="6. Retenção & eliminação">
          <p>
            Mantemos dados enquanto sua conta estiver ativa e pelo período necessário ao cumprimento
            de obrigações legais/contratuais. Após solicitação de exclusão, removemos ou
            anonimizamos dados de forma segura, respeitando prazos legais de guarda.
          </p>
        </Section>

        <Section id="direitos" title="7. Seus direitos">
          <p>
            Você pode exercer os direitos previstos na LGPD/GDPR, como confirmação de tratamento,
            acesso, correção, portabilidade, anonimização, revogação de consentimento e exclusão.
            Para isso, entre em contato:
          </p>
          <ul>
            <li>
              Suporte:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              Encarregado(a) de Dados (DPO):{" "}
              <a href={`mailto:${DPO_EMAIL}`} className="underline">
                {DPO_EMAIL}
              </a>
            </li>
          </ul>
        </Section>

        <Section id="seguranca" title="8. Segurança da informação">
          <p>
            Adotamos medidas técnicas e organizacionais razoáveis para proteger seus dados (criptografia
            em trânsito/repouso quando disponível, controle de acesso, monitoramento e backups).
            Ainda assim, nenhum sistema é 100% infalível; recomendamos boas práticas de segurança
            (senhas fortes, MFA, dispositivos atualizados).
          </p>
        </Section>

        <Section id="criancas" title="9. Crianças e adolescentes">
          <p>
            O {APP_NAME} não é direcionado a menores de 13 anos. Se você acredita que uma criança nos
            forneceu dados, contate-nos para remoção apropriada.
          </p>
        </Section>

        <Section id="transferencias" title="10. Transferências internacionais">
          <p>
            Alguns provedores podem armazenar dados fora do Brasil. Nesses casos, buscamos garantir
            proteções adequadas (p. ex., cláusulas contratuais padrão, região de dados compatível),
            conforme a legislação aplicável.
          </p>
        </Section>

        <Section id="exclusao" title="11. Como solicitar exclusão de dados">
          <p>
            Você pode solicitar a exclusão definitiva de sua conta e dados pessoais a qualquer momento.
            Para isso, envie um e-mail para{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            com o assunto <strong>“Exclusão de dados — {APP_NAME}”</strong> informando o e-mail
            cadastrado. Também é possível solicitar via DPO em{" "}
            <a href={`mailto:${DPO_EMAIL}`} className="underline">
              {DPO_EMAIL}
            </a>
            .
          </p>
          <p className="text-sm text-neutral-500">
            Observação: em alguns casos, poderemos reter dados estritamente necessários para cumprir
            obrigações legais (p. ex., fiscais/contábeis) ou para defesa de direitos.
          </p>
        </Section>

        <Section id="contato" title="12. Contatos do controlador (DPO)">
          <ul className="not-prose">
            <li>
              <strong>Controlador:</strong> {ORG_NAME}
            </li>
            <li>
              <strong>Endereço:</strong> {ADDRESS}
            </li>
            <li>
              <strong>Suporte:</strong>{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              <strong>Encarregado(a) de Dados (DPO):</strong>{" "}
              <a href={`mailto:${DPO_EMAIL}`} className="underline">
                {DPO_EMAIL}
              </a>
            </li>
          </ul>
        </Section>

        <Section id="mudancas" title="13. Mudanças nesta Política">
          <p>
            Podemos atualizar esta Política para refletir alterações legais, técnicas ou operacionais.
            Publicaremos a versão revisada em <a href={`${SITE_URL}/privacy`}>{SITE_URL}/privacy</a>{" "}
            e ajustaremos a data de “Última atualização”. Recomendamos revisões periódicas.
          </p>
        </Section>
      </article>
    </main>
  );
}
