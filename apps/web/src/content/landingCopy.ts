// Centralize aqui todo o copy da landing page.
// Troque os textos livremente — os componentes lêem deste objeto.
// Variação B (com Ajuste 1 no card #1 de "Por que" e Ajuste 2 no FAQ).

export const copy = {
  meta: {
    title: "NotaPilot — NFS-e sem portal, pelo WhatsApp",
    description:
      "Emissão e acompanhamento de NFS-e com menos fricção e mais evidências. WhatsApp + painel para contabilidade multi-empresa.",
  },

  nav: {
    brand: "NotaPilot",
    badge: "Beta",
    links: [
      { label: "Por que NotaPilot", href: "#why" },
      { label: "Como funciona", href: "#how" },
      { label: "Funcionalidades", href: "#features" },
      { label: "Para quem", href: "#who" },
      { label: "FAQ", href: "#faq" },
    ],
    cta: { label: "Entrar", href: "/auth/login" },
  },

  hero: {
    badge: "Beta • Em expansão por cidade",
    headline: "NFS-e sem portal: WhatsApp + painel para seu escritório",
    subheadline:
      "Emissão e acompanhamento com menos fricção e mais evidências. Perfeito para contabilidade multi-empresa que precisa de velocidade e controle.",
    // bullets disponíveis para uso futuro no componente
    bullets: [
      "Fluxo único multi-empresa",
      "Acompanhamento automático de status",
      "Evidências para auditoria",
    ],
    ctaPrimary: {
      label: "Criar conta",
      href: "/auth/signup",
      microcopy: "Acesso rápido ao beta e setup guiado.",
    },
    ctaSecondary: {
      label: "Entrar",
      href: "/auth/login",
      microcopy: "Volte para o painel e continue.",
    },
    disclaimer: "Acesso rápido ao beta e setup guiado.",
  },

  why: {
    heading: "Por que escritórios trocam o portal pelo NotaPilot",
    cards: [
      // Ajuste 1: card da Variação A
      {
        icon: "🏛️",
        title: "Portal municipal não escala",
        body: "Um fluxo por cidade vira caos quando você tem muitas empresas.",
        promise: "NotaPilot abstrai o portal — você digita no WhatsApp, a nota sai.",
      },
      {
        icon: "🔁",
        title: "Menos retrabalho repetitivo",
        body: "Padronize o fluxo e reduza 'tentativa e erro'.",
        promise: "Error translator converte o erro em linguagem humana e sugere a correção.",
      },
      {
        icon: "📂",
        title: "Mais previsibilidade operacional",
        body: "Status claro, alertas e trilha para resolver rápido.",
        promise: "Cada ação gera log imutável. Consulte status, histórico e PDF a qualquer momento.",
      },
    ],
  },

  how: {
    heading: "Como funciona",
    subheading: "Três passos. Zero portal.",
    steps: [
      {
        number: "01",
        title: "Defina as empresas",
        body: "Organize clientes e parâmetros básicos de emissão.",
      },
      {
        number: "02",
        title: "Use o WhatsApp",
        body: "Envie comandos e receba retorno sem abrir portais.",
      },
      {
        number: "03",
        title: "Deixe o Autopilot vigiar",
        body: "O sistema acompanha e registra mudanças de status.",
      },
    ],
  },

  features: {
    heading: "Tudo que você precisa",
    subheading: "Construído para operação real de escritório contábil.",
    items: [
      {
        icon: "🏢",
        title: "Gestão multi-empresa",
        body: "Operação por cliente com separação total.",
      },
      {
        icon: "💬",
        title: "WhatsApp-first",
        body: "Interface rápida para o dia a dia do time.",
      },
      {
        icon: "⏰",
        title: "Rotinas automáticas",
        body: "Checagens e lembretes sem depender de alguém.",
      },
      {
        icon: "🔍",
        title: "Consulta centralizada",
        body: "Busque notas e retornos em segundos.",
      },
      {
        icon: "↩️",
        title: "Cancel/substitute",
        body: "Ações registradas com evidência (quando suportado).",
      },
      {
        icon: "🗣️",
        title: "Rejeições explicadas",
        body: "Erro em 'português', com detalhe técnico guardado.",
      },
      {
        icon: "📋",
        title: "Audit trail",
        body: "Quem fez o quê, quando e com qual retorno.",
      },
      {
        icon: "🟢",
        title: "Monitor operacional",
        body: "Saúde e indicadores para evitar surpresas.",
      },
    ],
  },

  who: {
    heading: "Para quem é o NotaPilot",
    profiles: [
      {
        tag: "Escritório contábil",
        title: "Contabilidade multi-empresa",
        body: "Menos abas, menos portais, mais controle e histórico. Ideal para times que operam alto volume com padrão.",
        cta: { label: "Começar agora", href: "/auth/signup" },
      },
      {
        tag: "Prestador de serviço",
        title: "Prestador single company",
        body: "Emita e acompanhe com simplicidade, sem perder rastreabilidade quando precisar provar algo.",
        cta: { label: "Criar conta", href: "/auth/signup" },
      },
    ],
  },

  trust: {
    heading: "Segurança & Evidências",
    subheading:
      "Operação confiável não é 'mágica': é registro, clareza e consistência. O NotaPilot mantém trilha completa, protege contra ações duplicadas e expõe um status simples do serviço para você confiar no fluxo.",
    items: [
      {
        title: "Trilha completa por tentativa",
        body: "Cada evento — emissão, cancelamento, erro, retry — é registrado com timestamp e não pode ser alterado retroativamente.",
      },
      {
        title: "Deduplicação de ações",
        body: "Reenvio do mesmo comando não gera nota duplicada. O sistema detecta a operação em andamento e retorna o resultado original.",
      },
      {
        title: "Status público do serviço",
        body: "O endpoint /api/status expõe a saúde do sistema em tempo real. Transparência total sobre disponibilidade.",
        link: { label: "Ver status →", href: "/api/status" },
      },
    ],
  },

  faq: {
    heading: "Perguntas frequentes",
    items: [
      {
        q: "O NotaPilot funciona em qualquer município?",
        a: "Ainda não. Estamos em beta e liberamos cobertura por município de forma gradual. Se você disser as cidades mais importantes, priorizamos no roadmap.",
      },
      {
        q: "Vou precisar mudar meu processo?",
        a: "Só o necessário: você troca o 'entra no portal' por comandos no WhatsApp + painel. Mantemos rastreabilidade para auditoria e rotina do escritório.",
      },
      {
        q: "Precisa certificado digital para emitir?",
        a: "Em alguns casos, sim. Os requisitos variam por cidade. O NotaPilot orienta e registra o que foi usado em cada operação.",
      },
      {
        q: "Como sei se a nota foi autorizada?",
        a: "Você vê o status no painel e pode consultar pelo WhatsApp. O Autopilot também verifica e registra cada mudança.",
      },
      {
        q: "Como vocês explicam rejeições?",
        a: "Mostramos uma explicação curta e acionável, além do retorno original. Assim o time corrige com rapidez e sem 'adivinhar'.",
      },
      // Ajuste 2: pergunta da Variação A
      {
        q: "Isso substitui meu contador?",
        a: "Não. O NotaPilot é ferramenta operacional para emissão e acompanhamento. A responsabilidade contábil e fiscal continua com o contador e o processo da empresa.",
      },
    ],
  },

  ctaFinal: {
    heading: "Velocidade com evidências, para seu time operar",
    subheading: "Acesse o beta e transforme NFS-e em um fluxo previsível.",
    ctaPrimary: { label: "Começar agora", href: "/auth/signup" },
    ctaSecondary: { label: "Já tenho conta — Entrar", href: "/auth/login" },
    microcopy: "Beta aberto. Sem cartão de crédito.",
  },

  footer: {
    brand: "NotaPilot",
    tagline: "NFS-e pelo WhatsApp para escritórios contábeis.",
    columns: [
      {
        heading: "Produto",
        links: [
          { label: "Por que NotaPilot", href: "#why" },
          { label: "Como funciona", href: "#how" },
          { label: "Funcionalidades", href: "#features" },
          { label: "FAQ", href: "#faq" },
        ],
      },
      {
        heading: "Conta",
        links: [
          { label: "Criar conta", href: "/auth/signup" },
          { label: "Entrar", href: "/auth/login" },
        ],
      },
      {
        heading: "Sistema",
        links: [
          { label: "Status", href: "/api/status" },
          { label: "Contato", href: "mailto:contato@notapilot.com.br" },
        ],
      },
    ],
    copy: `© ${new Date().getFullYear()} NotaPilot. Todos os direitos reservados.`,
  },
} as const;
