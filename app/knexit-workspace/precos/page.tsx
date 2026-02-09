"use client";

import "./precos.css";
import { useEffect, useMemo, useRef, useState } from "react";

const BASE_PRICES = { starter: 32.72, standard: 81.8, plus: 128.4 };
const PER_USER_INCREASE_PERCENT = { starter: 100, standard: 100, plus: 100 };

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);

const calculateTotal = (base: number, count: number, percentPerUser: number) => {
  const extraUsers = Math.max(count - 1, 0);
  return base * (1 + extraUsers * (percentPerUser / 100));
};

export default function PrecosPage() {
  const [userCount, setUserCount] = useState(1);
  const [activePlan, setActivePlan] = useState("plan-standard");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoPlacement, setInfoPlacement] = useState<"top" | "bottom">(
    "bottom"
  );
  const [infoShiftX, setInfoShiftX] = useState(0);
  const [carouselPage, setCarouselPage] = useState(0);
  const [carouselPages, setCarouselPages] = useState(2);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const carouselMetaRef = useRef({ slidesPerView: 1, totalSlides: 4 });
  const infoRef = useRef<HTMLDivElement | null>(null);
  const infoPanelRef = useRef<HTMLDivElement | null>(null);
  const clampUserCount = (value: number) => Math.min(300, Math.max(1, value));

  const handleUserChange = (value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) {
      setUserCount(1);
      return;
    }
    setUserCount(clampUserCount(next));
  };

  const totals = useMemo(
    () => ({
      starter: calculateTotal(
        BASE_PRICES.starter,
        userCount,
        PER_USER_INCREASE_PERCENT.starter
      ),
      standard: calculateTotal(
        BASE_PRICES.standard,
        userCount,
        PER_USER_INCREASE_PERCENT.standard
      ),
      plus: calculateTotal(
        BASE_PRICES.plus,
        userCount,
        PER_USER_INCREASE_PERCENT.plus
      ),
    }),
    [userCount]
  );
  const showTotals = userCount > 1;

  const handlePlanNavClick = (planId: string) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const target = carousel.querySelector<HTMLElement>(`#${planId}`);
    if (!target) return;
    const slide = target.closest<HTMLElement>(".plan-slide");
    const left = slide ? slide.offsetLeft : target.offsetLeft;
    carousel.scrollTo({ left, behavior: "smooth" });
    setActivePlan(planId);
  };

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const slides = Array.from(
      carousel.querySelectorAll<HTMLElement>(".plan-slide")
    );
    carouselMetaRef.current.totalSlides = slides.length;

    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const center = carousel.scrollLeft + carousel.clientWidth / 2;
        let closestId = activePlan;
        let closestDist = Number.POSITIVE_INFINITY;
        let closestIndex = 0;
        for (const [index, slide] of slides.entries()) {
          const card = slide.querySelector<HTMLElement>(".plan-card");
          if (!card) continue;
          const cardCenter = card.offsetLeft + card.offsetWidth / 2;
          const dist = Math.abs(center - cardCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closestId = card.id;
            closestIndex = index;
          }
        }
        if (closestId && closestId !== activePlan) {
          setActivePlan(closestId);
        }

        const width = window.innerWidth;
        const slidesPerView = width <= 900 ? 1 : width <= 1100 ? 2 : slides.length;
        carouselMetaRef.current.slidesPerView = slidesPerView;
        const totalPages =
          slidesPerView === 2
            ? 2
            : Math.max(1, Math.ceil(slides.length / slidesPerView));
        const nextPage =
          slidesPerView === 2 ? Math.floor(closestIndex / 2) : closestIndex;
        if (totalPages !== carouselPages) {
          setCarouselPages(totalPages);
        }
        if (nextPage !== carouselPage) {
          setCarouselPage(nextPage);
        }
      });
    };

    onScroll();
    carousel.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      carousel.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [activePlan, carouselPage, carouselPages]);

  const handleCarouselDotClick = (pageIndex: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const slides = Array.from(
      carousel.querySelectorAll<HTMLElement>(".plan-slide")
    );
    const slidesPerView = Math.max(1, carouselMetaRef.current.slidesPerView);
    const targetIndex = Math.min(
      slides.length - 1,
      pageIndex * slidesPerView
    );
    const target = slides[targetIndex];
    if (!target) return;
    carousel.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
    setCarouselPage(pageIndex);
  };

  useEffect(() => {
    if (!infoOpen) return;
    const measurePlacement = () => {
      const buttonEl = infoRef.current;
      const panelEl = infoPanelRef.current;
      if (!buttonEl || !panelEl) return;
      const buttonRect = buttonEl.getBoundingClientRect();
      const panelRect = panelEl.getBoundingClientRect();
      const spaceAbove = buttonRect.top;
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const needsTop = spaceBelow < panelRect.height && spaceAbove > spaceBelow;
      setInfoPlacement(needsTop ? "top" : "bottom");

      const overflowRight = panelRect.right - window.innerWidth;
      const overflowLeft = 0 - panelRect.left;
      if (overflowRight > 0) {
        setInfoShiftX(overflowRight + 8);
      } else if (overflowLeft > 0) {
        setInfoShiftX(-(overflowLeft + 8));
      } else {
        setInfoShiftX(0);
      }
    };
    const rafId = window.requestAnimationFrame(measurePlacement);
    window.addEventListener("resize", measurePlacement);
    const onClickOutside = (event: MouseEvent) => {
      if (!infoRef.current) return;
      if (!infoRef.current.contains(event.target as Node)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measurePlacement);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [infoOpen]);

  return (
    <main className="pricing-page">
      <section className="pricing-hero">
        <h1>
          Tenha <em>muito</em> mais armazenamento
        </h1>
        <p>
          E ferramentas de colaboração modernas para ajudar sua empresa a
          crescer.
        </p>
        <div className="hero-subline">Teste o Google Workspace por 14 dias</div>

        <div className="usage-pill">
          <span className="usage-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M6 18h11a4 4 0 0 0 0-8h-.5A6.5 6.5 0 1 0 6 16"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>Você está usando 84,1 GB de 100 GB disponíveis para</span>
          <span className="usage-user">
            <img
              src="https://lh3.googleusercontent.com/a/ACg8ocJvVUYyu910xc1Su5xEbY1FoXN2i3cieHlTaNpG2Ymr-lCGsT3Bnw=s96"
              width="20"
              height="20"
              alt="Usuário"
            />
            FMedeiros58@gmail.com
          </span>
        </div>
      </section>

      <section className="pricing-grid">
        <div className="pricing-controls">
          <div className="user-control">
            <label htmlFor="userCount">Usuários</label>
            <div className="user-input">
              <input
                id="userCount"
                type="number"
                min={1}
                max={300}
                value={userCount}
                onChange={(event) => handleUserChange(event.target.value)}
              />
              <div className="user-buttons">
                <button
                  type="button"
                  aria-label="Aumentar usuários"
                  onClick={() =>
                    setUserCount((prev) => clampUserCount(prev + 1))
                  }
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Diminuir usuários"
                  onClick={() =>
                    setUserCount((prev) => clampUserCount(prev - 1))
                  }
                >
                  ▼
                </button>
              </div>
              <div className="info-popover" ref={infoRef}>
                <button
                  type="button"
                  className="info-btn"
                  aria-label="Ajuda"
                  aria-expanded={infoOpen}
                  aria-controls="user-info-popover"
                  onClick={() => setInfoOpen((prev) => !prev)}
                >
                  i
                </button>
                {infoOpen && (
                  <div
                    id="user-info-popover"
                    className={`info-popover-panel is-${infoPlacement}`}
                    role="dialog"
                    aria-live="polite"
                    ref={infoPanelRef}
                    style={{
                      transform: infoShiftX
                        ? `translateX(${infoShiftX * -1}px)`
                        : undefined,
                    }}
                  >
                    Ajuste o número de usuários para estimar o custo mensal.
                    Adicione mais usuários depois de se inscrever.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="app-icons" aria-hidden="true">
            <img
              src="https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg"
              alt=""
            />
            <img
              src="https://www.gstatic.com/images/branding/productlogos/calendar_2020q4/v13/192px.svg"
              alt=""
            />
            <img
              src="https://www.gstatic.com/images/branding/productlogos/drive_2020q4/v10/192px.svg"
              alt=""
            />
            <img
              src="https://www.gstatic.com/images/branding/productlogos/meet_2020q4/v8/192px.svg"
              alt=""
            />
            <img
              src="https://www.gstatic.com/images/branding/productlogos/editors_2020q4/v6/192px.svg"
              alt=""
            />
            <img
              src="https://www.gstatic.com/images/branding/productlogos/gemini_2025/v1/192px.svg"
              alt=""
            />
          </div>

          <div className="billing-toggle">
            <span>Anual</span>
            <span className="save">(economize 16% no contrato de 1 ano)</span>
            <label className="switch" aria-label="Alternar cobrança anual">
              <input type="checkbox" checked readOnly />
              <span className="slider" />
            </label>
          </div>
        </div>

        <nav className="pricing-tabs" aria-label="Navegação de planos">
          <button
            className={`pricing-tab${activePlan === "plan-starter" ? " is-active" : ""}`}
            type="button"
            onClick={() => handlePlanNavClick("plan-starter")}
          >
            Business Starter
          </button>
          <button
            className={`pricing-tab${activePlan === "plan-standard" ? " is-active" : ""}`}
            type="button"
            onClick={() => handlePlanNavClick("plan-standard")}
          >
            Business Standard
          </button>
          <button
            className={`pricing-tab${activePlan === "plan-plus" ? " is-active" : ""}`}
            type="button"
            onClick={() => handlePlanNavClick("plan-plus")}
          >
            Business Plus
          </button>
          <button
            className={`pricing-tab${activePlan === "plan-enterprise" ? " is-active" : ""}`}
            type="button"
            onClick={() => handlePlanNavClick("plan-enterprise")}
          >
            Enterprise
          </button>
        </nav>

        <div className="plan-carousel" ref={carouselRef}>
        <div className="plan-slide">
        <article id="plan-starter" className="plan-card">
          <div className="plan-header">
            <div className="plan-title">Starter</div>
            <div className="plan-badge">20% de desconto por 12 meses</div>
            <div className="plan-price">
              R$ 32,72 <span className="muted">R$ 40,90**</span>
            </div>
            <div className="plan-sub">/ usuário por mês</div>
            {showTotals && (
              <div className="plan-total">
                {userCount} usuários = {formatBRL(totals.starter)}/mês (BRL)
              </div>
            )}
          </div>
          <button className="plan-cta" type="button">
            Iniciar um teste
          </button>

          <div className="plan-section">O plano Starter inclui:</div>
          <ul className="plan-features">
            <li className="feature-storage">
              <span className="icon storage" />
              <div className="feature-text">
                <span className="feature-value">30 GB</span>
                <span className="feature-desc">
                  de armazenamento em pool por pessoa*
                </span>
                <span className="feature-note">
                  <strong>O armazenamento é compartilhado</strong> entre o
                  Gmail, o Drive e o Google Fotos
                </span>
              </div>
            </li>
            <li>
              <span className="icon gmail" />
              <div>
                E-mail comercial personalizado e seguro
                <br />
                você@sua-empresa.com
              </div>
            </li>
            <li>
              <span className="icon gemini" />
              <div>Assistente de IA Gemini no Gmail</div>
            </li>
            <li>
              <span className="icon gemini" />
              <div>Converse com a IA no app Gemini</div>
            </li>
            <li>
              <span className="icon meet" />
              <div>Videochamadas com até 100 participantes</div>
            </li>
            <li>
              <span className="icon vids" />
              <div>
                Google Vids: criador e editor de vídeos com tecnologia de IA
              </div>
            </li>
            <li>
              <span className="icon admin" />
              <div>Controles de segurança e gerenciamento</div>
            </li>
          </ul>
        </article>
        </div>

        <div className="plan-slide">
        <article id="plan-standard" className="plan-card is-featured">
          <div className="plan-header">
            <div className="plan-top-tag">mais usados</div>
            <div className="plan-title">Standard</div>
            <div className="plan-price">R$ 81,80</div>
            <div className="plan-sub">/ usuário por mês</div>
            {showTotals && (
              <div className="plan-total">
                {userCount} usuários = {formatBRL(totals.standard)}/mês (BRL)
              </div>
            )}
          </div>
          <button className="plan-cta primary" type="button">
            Iniciar um teste
          </button>

          <div className="plan-section">
            Todos os recursos do Starter, e também:
          </div>
          <ul className="plan-features">
            <li className="feature-storage">
              <span className="icon storage" />
              <div className="feature-text">
                <span className="feature-value">2 TB</span>
                <span className="pill">
                  20x mais do que sua quantidade atual
                </span>
                <span className="feature-desc">
                  E-mails, arquivos e fotos precisam de armazenamento para
                  funcionar
                </span>
              </div>
            </li>
            <li>
              <span className="icon gmail" />
              <div>
                E-mail comercial personalizado e seguro
                <br />+ layouts personalizados e mala direta
              </div>
            </li>
            <li>
              <span className="icon gemini" />
              <div>
                Assistente de IA Gemini no Gmail, Documentos, Meet e mais
              </div>
            </li>
            <li>
              <span className="icon notebook" />
              <div>NotebookLM com acesso ampliado a recursos</div>
            </li>
            <li>
              <span className="icon gemini" />
              <div>
                Converse com a IA no App do Gemini e tenha acesso ampliado a
                modelos e recursos
              </div>
            </li>
            <li>
              <span className="icon meet" />
              <div>
                Videochamadas com gravação, cancelamento de ruído e até 150
                participantes
              </div>
            </li>
            <li>
              <span className="icon calendar" />
              <div>Páginas de agendamento de horário</div>
            </li>
            <li>
              <span className="icon docs" />
              <div>Assinatura eletrônica no app Documentos e em PDFs</div>
            </li>
            <li>
              <span className="icon admin" />
              <div>
                Ferramenta Google Workspace Migrate para migração de dados
              </div>
            </li>
          </ul>
        </article>
        </div>

        <div className="plan-slide">
        <article id="plan-plus" className="plan-card">
          <div className="plan-header">
            <div className="plan-title">Plus</div>
            <div className="plan-price">R$ 128,40</div>
            <div className="plan-sub">/ usuário por mês</div>
            {showTotals && (
              <div className="plan-total">
                {userCount} usuários = {formatBRL(totals.plus)}/mês (BRL)
              </div>
            )}
          </div>
          <button className="plan-cta" type="button">
            Iniciar um teste
          </button>

          <div className="plan-section">
            Todos os recursos do Standard, e também:
          </div>
          <ul className="plan-features">
            <li className="feature-storage">
              <span className="icon storage" />
              <div className="feature-text">
                <span className="feature-value">5 TB</span>
                <span className="pill">51x mais do que o espaço atual</span>
                <a
                  className="feature-link"
                  href="https://support.google.com/a?p=storage_use"
                  target="_blank"
                  rel="noreferrer"
                >
                  Saiba como o armazenamento afeta e-mails e arquivos no
                  Workspace
                </a>
              </div>
            </li>
            <li>
              <span className="icon gmail" />
              <div>
                E-mail comercial personalizado e seguro
                <br />+ e-discovery
              </div>
            </li>
            <li>
              <span className="icon meet" />
              <div>
                Videochamadas com controle de presença e até 500 participantes
              </div>
            </li>
            <li>
              <span className="icon vault" />
              <div>Vault para retenção, arquivamento e pesquisa de dados</div>
            </li>
            <li>
              <span className="icon admin" />
              <div>LDAP seguro</div>
            </li>
            <li>
              <span className="icon check" />
              <div>Gerenciamento avançado de endpoints</div>
            </li>
            <li>
              <span className="icon check" />
              <div>Controles aprimorados de segurança e gerenciamento</div>
            </li>
          </ul>
        </article>
        </div>

        <div className="plan-slide">
        <article id="plan-enterprise" className="plan-card">
          <div className="plan-header">
            <div className="plan-title">Enterprise</div>
            <div className="plan-price">Vamos conversar</div>
            <div className="plan-sub">&nbsp;</div>
          </div>
          <button className="plan-cta" type="button">
            Entre em contato com a equipe de vendas
          </button>

          <div className="plan-section">
            Todos os recursos mencionados, e também:
          </div>
          <ul className="plan-features">
            <li className="feature-storage">
              <span className="icon storage" />
              <div className="feature-text">
                <span className="feature-value">5 TB</span>
                <span className="feature-desc">
                  ou faça upgrade para ter mais espaço*
                </span>
              </div>
            </li>
            <li>
              <span className="icon gmail" />
              <div>
                E-mail comercial personalizado e seguro
                <br />+ criptografia S/MIME
              </div>
            </li>
            <li>
              <span className="icon meet" />
              <div>
                Videochamadas com transmissão ao vivo no domínio e até 1.000
                participantes
              </div>
            </li>
            <li>
              <span className="icon check" />
              <div>Prevenção contra perda de dados (DLP)</div>
            </li>
            <li>
              <span className="icon check" />
              <div>Acesso baseado no contexto</div>
            </li>
            <li>
              <span className="icon check" />
              <div>Regiões de dados corporativas</div>
            </li>
            <li>
              <span className="icon check" />
              <div>Cloud Identity Premium</div>
            </li>
            <li>
              <span className="icon check" />
              <div>Gerenciamento corporativo de endpoints</div>
            </li>
            <li>
              <span className="icon check" />
              <div>Classificação por IA para o Google Drive</div>
            </li>
            <li>
              <span className="icon check" />
              <div>
                Complemento disponível para Assured Controls e classificação por
                IA
              </div>
            </li>
            <li>
              <span className="icon check" />
              <div>
                Suporte Avançado com respostas mais rápidas para problemas
                críticos
              </div>
            </li>
          </ul>
        </article>
        </div>
        </div>

        <div className="carousel-dots" aria-hidden="true">
          {Array.from({ length: carouselPages }).map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              className={`carousel-dot${index === carouselPage ? " is-active" : ""}`}
              onClick={() => handleCarouselDotClick(index)}
              aria-label={`Ir para a página ${index + 1}`}
            />
          ))}
        </div>

        <div className="pricing-footnote">
          <span>Todos os planos são cobrados mensalmente</span>
          <span>Todos os preços em R$BRL</span>
        </div>
      </section>

      <div className="pricing-legal">
        <p>
          Os planos Starter, Standard e Plus podem ser comprados para 300
          usuários no máximo. Não há um mínimo ou máximo de usuários nos planos
          Enterprise. Os clientes do Google Workspace podem ter acesso a recursos
          extras por um período promocional limitado.
        </p>
        <p>
          * O Google Workspace oferece armazenamento em pool flexível por
          usuário, que é compartilhado na organização. O Business Starter inclui
          30 GB de armazenamento em pool por usuário, o Business Standard conta
          com 2 TB, e o Business Plus e o Enterprise Plus incluem 5 TB. Saiba
          como comprar mais armazenamento para sua organização na Central de
          Ajuda.
        </p>
        <p>
          **Oferta disponível apenas para novos clientes do Google Workspace.
          Este preço inicial está disponível somente para os primeiros 20
          usuários adicionados, por 12 meses. O preço padrão será aplicado a
          todos os usuários após esse período. O preço real por usuário pode
          variar em cerca de 0,01% devido a arredondamentos. O valor final será
          mostrado antes da conclusão da assinatura.
        </p>
      </div>
    </main>
  );
}
