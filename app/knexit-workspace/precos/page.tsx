import "./precos.css";

export default function PrecosPage() {
  return (
    <div className="pricing-page">
      <section className="pricing-hero">
        <h1>
          Tenha <em>muito</em> mais armazenamento
        </h1>
        <p>E ferramentas de colaboração modernas para ajudar sua empresa a crescer.</p>
        <div className="hero-subline">Teste o Google Workspace por 14 dias</div>
        <div className="usage-pill">
          <span className="usage-dot" aria-hidden="true" />
          Você está usando 84,1 GB de 100 GB disponíveis para
          <span className="usage-user">
            <img
              src="https://lh3.googleusercontent.com/a/ACg8ocJvVUYyu910xc1Su5xEbY1FoXN2i3cieHlTaNpG2Ymr-lCGsT3Bnw=s96"
              alt=""
              width={22}
              height={22}
            />
            FMedeiros58@gmail.com
          </span>
        </div>
      </section>

      <section className="pricing-controls">
        <div className="user-control">
          <label htmlFor="user-count">Usuários</label>
          <div className="user-input">
            <input id="user-count" type="number" defaultValue={1} min={1} max={300} />
            <div className="user-buttons" aria-hidden="true">
              <button type="button">▲</button>
              <button type="button">▼</button>
            </div>
            <button type="button" className="info-btn" aria-label="Ajuste o número de usuários">
              i
            </button>
          </div>
        </div>

        <div className="app-icons" aria-hidden="true">
          <img src="https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg" alt="" />
          <img src="https://www.gstatic.com/images/branding/productlogos/calendar_2020q4/v13/192px.svg" alt="" />
          <img src="https://www.gstatic.com/images/branding/productlogos/drive_2020q4/v10/192px.svg" alt="" />
          <img src="https://www.gstatic.com/images/branding/productlogos/meet_2020q4/v8/192px.svg" alt="" />
          <img src="https://www.gstatic.com/images/branding/productlogos/editors_2020q4/v6/192px.svg" alt="" />
          <img src="https://www.gstatic.com/images/branding/productlogos/gemini_2025/v1/192px.svg" alt="" />
        </div>

        <div className="billing-toggle">
          <span>Anual</span>
          <span className="save">(economize 16% no contrato de 1 ano)</span>
          <label className="switch">
            <input type="checkbox" defaultChecked />
            <span className="slider" />
          </label>
        </div>
      </section>

      <section className="pricing-grid">
        <article className="plan-card">
          <div className="plan-title">Starter</div>
          <div className="plan-badge">20% de desconto por 12 meses</div>
          <div className="plan-price">
            R$ 32,72 <span className="muted">R$ 40,90**</span>
          </div>
          <div className="plan-sub">/ usuário por mês</div>
          <button className="plan-cta">Iniciar um teste</button>
          <div className="plan-section">O plano Starter inclui:</div>
          <ul className="plan-features">
            <li>
              <span className="icon storage" />
              <strong>30 GB</strong> de armazenamento em pool por pessoa
            </li>
            <li>
              <span className="icon gmail" />
              E-mail comercial personalizado e seguro
            </li>
            <li>
              <span className="icon gemini" />
              Assistente de IA Gemini no Gmail
            </li>
            <li>
              <span className="icon gemini" />
              Converse com a IA no app Gemini
            </li>
            <li>
              <span className="icon meet" />
              Videochamadas com até 100 participantes
            </li>
            <li>
              <span className="icon vids" />
              Google Vids: criador e editor de vídeos com tecnologia de IA
            </li>
            <li>
              <span className="icon admin" />
              Controles de segurança e gerenciamento
            </li>
          </ul>
        </article>

        <article className="plan-card is-featured">
          <div className="plan-top-tag">mais usados</div>
          <div className="plan-title">Standard</div>
          <div className="plan-price">R$ 81,80</div>
          <div className="plan-sub">/ usuário por mês</div>
          <button className="plan-cta primary">Iniciar um teste</button>
          <div className="plan-section">Todos os recursos do Starter, e também:</div>
          <ul className="plan-features">
            <li>
              <span className="icon storage" />
              <strong>2 TB</strong> de armazenamento em pool por pessoa
              <span className="pill">20x mais do que sua quantidade atual</span>
            </li>
            <li>
              <span className="icon gmail" />
              E-mail comercial personalizado e seguro
            </li>
            <li>
              <span className="icon gemini" />
              Assistente de IA Gemini no Gmail, Documentos, Meet e mais
            </li>
            <li>
              <span className="icon notebook" />
              NotebookLM com acesso ampliado a recursos
            </li>
            <li>
              <span className="icon meet" />
              Videochamadas com gravação e até 150 participantes
            </li>
            <li>
              <span className="icon calendar" />
              Páginas de agendamento de horário
            </li>
            <li>
              <span className="icon docs" />
              Assinatura eletrônica no app Documentos e em PDFs
            </li>
            <li>
              <span className="icon admin" />
              Ferramenta Google Workspace Migrate
            </li>
          </ul>
        </article>

        <article className="plan-card">
          <div className="plan-title">Plus</div>
          <div className="plan-price">R$ 128,40</div>
          <div className="plan-sub">/ usuário por mês</div>
          <button className="plan-cta">Iniciar um teste</button>
          <div className="plan-section">Todos os recursos do Standard, e também:</div>
          <ul className="plan-features">
            <li>
              <span className="icon storage" />
              <strong>5 TB</strong> de armazenamento em pool por pessoa
              <span className="pill">51x mais do que o espaço atual</span>
            </li>
            <li>
              <span className="icon gmail" />
              E-mail corporativo personalizado e seguro
            </li>
            <li>
              <span className="icon meet" />
              Videochamadas com até 500 participantes
            </li>
            <li>
              <span className="icon vault" />
              Vault para retenção e pesquisa de dados
            </li>
            <li>
              <span className="icon admin" />
              LDAP seguro
            </li>
            <li>
              <span className="icon check" />
              Gerenciamento avançado de endpoints
            </li>
            <li>
              <span className="icon check" />
              Controles aprimorados de segurança e gerenciamento
            </li>
          </ul>
        </article>

        <article className="plan-card">
          <div className="plan-title">Enterprise</div>
          <div className="plan-price">Vamos conversar</div>
          <div className="plan-sub">&nbsp;</div>
          <button className="plan-cta">Entre em contato com a equipe de vendas</button>
          <div className="plan-section">Todos os recursos mencionados, e também:</div>
          <ul className="plan-features">
            <li>
              <span className="icon storage" />
              <strong>5 TB</strong> ou faça upgrade para ter mais espaço
            </li>
            <li>
              <span className="icon gmail" />
              E-mail corporativo personalizado e seguro
            </li>
            <li>
              <span className="icon meet" />
              Videochamadas com até 1.000 participantes
            </li>
            <li>
              <span className="icon admin" />
              Prevenção contra perda de dados (DLP)
            </li>
            <li>
              <span className="icon check" />
              Acesso baseado no contexto
            </li>
            <li>
              <span className="icon check" />
              Regiões de dados corporativas
            </li>
            <li>
              <span className="icon check" />
              Cloud Identity Premium
            </li>
            <li>
              <span className="icon check" />
              Gerenciamento corporativo de endpoints
            </li>
          </ul>
        </article>
      </section>

      <div className="pricing-footnote">
        <span>Todos os planos são cobrados mensalmente.</span>
        <span>Todos os preços em R$BRL.</span>
      </div>

    </div>
  );
}
