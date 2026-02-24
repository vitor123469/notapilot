// Centralize aqui todo o copy da landing page.
// Troque os textos livremente — os componentes lêem deste objeto.

export const copy = {
  meta: {
    title: "NotaPilot — NFS-e pelo WhatsApp",
    description:
      "Emita, consulte e gerencie NFS-e pelo WhatsApp. Autopilot para escritórios contábeis multi-empresa.",
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
    badge: "Beta aberto — vagas limitadas",
    headline: "NFS-e pelo WhatsApp,\nsem abrir portal.",
    subheadline:
      "Emita, consulte e gerencie notas fiscais de serviço para múltiplas empresas direto pelo WhatsApp. Autopilot monitora, alerta e resolve rejeições para você.",
    ctaPrimary: { label: "Criar conta grátis", href: "/auth/signup" },
    ctaSecondary: { label: "Já tenho conta", href: "/auth/login" },
    disclaimer: "Sem cartão de crédito. Cancele quando quiser.",
  },

  why: {
    heading: "Por que escritórios trocam o portal pelo NotaPilot",
    cards: [
      {
        icon: "🏛️",
        title: "Portal municipal é confuso e lento",
        body: "Cada município tem uma interface diferente, sessões que expiram e fluxos que mudam sem aviso. Você perde tempo antes mesmo de emitir.",
        promise: "NotaPilot abstrai o portal — você digita no WhatsApp, a nota sai.",
      },
      {
        icon: "🔁",
        title: "Rejeição vira retrabalho",
        body: "Código de erro críptico, nota não emitida, cliente esperando. O contador tenta de novo no portal, sem saber exatamente o que mudou.",
        promise: "Error translator converte o erro em linguagem humana e sugere a correção.",
      },
      {
        icon: "📂",
        title: "Falta rastreabilidade",
        body: "E-mail perdido, planilha desatualizada, cliente perguntando se a nota saiu. Sem trilha, sem evidência.",
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
        title: "Configure a empresa",
        body: "Cadastre CNPJ, credenciais do município e tomadores recorrentes via painel ou WhatsApp. Feito uma vez.",
      },
      {
        number: "02",
        title: "Emita e consulte pelo WhatsApp",
        body: "Envie os dados da nota em linguagem natural. O NotaPilot interpreta, valida e emite. Consulte status com um simples 'status [número]'.",
      },
      {
        number: "03",
        title: "Autopilot acompanha e alerta",
        body: "Agendamentos recorrentes emitem automaticamente. Rejeições geram alerta instantâneo com explicação e ação sugerida.",
      },
    ],
  },

  features: {
    heading: "Tudo que você precisa",
    subheading: "Construído para operação real de escritório contábil.",
    items: [
      {
        icon: "🏢",
        title: "Multi-empresa",
        body: "Gerencie N empresas no mesmo painel. Cada uma com suas credenciais, tomadores e histórico isolados.",
      },
      {
        icon: "💬",
        title: "Comandos WhatsApp",
        body: "Emita, consulte, cancele e substitua notas com comandos em linguagem natural. Sem app extra.",
      },
      {
        icon: "⏰",
        title: "Autopilot recorrente",
        body: "Configure emissões periódicas. O sistema executa, monitora e avisa quando algo precisa de atenção.",
      },
      {
        icon: "🔍",
        title: "Status e consulta",
        body: "Saiba em tempo real se a nota foi aceita, rejeitada ou está em processamento. Por número ou por período.",
      },
      {
        icon: "↩️",
        title: "Cancelamento e substituição",
        body: "Cancele ou substitua notas com um comando. O histórico de substituições fica registrado.",
      },
      {
        icon: "🗣️",
        title: "Error translator",
        body: "Mensagens de erro do portal traduzidas para linguagem humana, com causa e próximo passo sugerido.",
      },
      {
        icon: "📋",
        title: "Trilha de auditoria",
        body: "Log imutável de toda ação: quem fez, quando, qual resultado. Evidência para auditorias e clientes.",
      },
      {
        icon: "🟢",
        title: "Monitor operacional",
        body: "Healthcheck em tempo real do sistema. Saiba se tudo está funcionando antes de o cliente perguntar.",
      },
    ],
  },

  who: {
    heading: "Para quem é o NotaPilot",
    profiles: [
      {
        tag: "Escritório contábil",
        title: "Multi-empresa, uma operação",
        body: "Você cuida de dezenas de empresas e precisa de rastreabilidade, agilidade e evidência de que cada nota foi emitida corretamente. NotaPilot centraliza tudo: painel unificado, histórico por empresa, alertas automáticos.",
        cta: { label: "Começar agora", href: "/auth/signup" },
      },
      {
        tag: "Prestador de serviço",
        title: "Emita sem sair do WhatsApp",
        body: "Você presta serviços e quer emitir nota sem abrir portal. Configure uma vez e use o WhatsApp que já usa no dia a dia. Sem curva de aprendizado.",
        cta: { label: "Criar conta", href: "/auth/signup" },
      },
    ],
  },

  trust: {
    heading: "Segurança e evidências",
    subheading:
      "Operação confiável não é promessa — é design.",
    items: [
      {
        title: "Log imutável",
        body: "Cada evento (emissão, cancelamento, erro, retry) é registrado com timestamp e não pode ser alterado retroativamente.",
      },
      {
        title: "Idempotência",
        body: "Reenvio do mesmo comando não gera nota duplicada. O sistema detecta a operação em andamento e retorna o resultado original.",
      },
      {
        title: "Healthcheck público",
        body: "O endpoint /api/status expõe a saúde do sistema em tempo real. Transparência total sobre disponibilidade.",
        link: { label: "Ver status →", href: "/api/status" },
      },
      {
        title: "Dados isolados por empresa",
        body: "Row-level security no banco garante que os dados de cada empresa só são acessíveis pelas credenciais daquela empresa.",
      },
    ],
  },

  faq: {
    heading: "Perguntas frequentes",
    items: [
      {
        q: "Quais municípios são suportados?",
        a: "Atualmente estamos em beta com suporte inicial a um conjunto de municípios. Não prometemos cobertura total — estamos expandindo de forma gradual e honesta. Consulte o painel ou fale conosco para verificar se o seu município já está disponível.",
      },
      {
        q: "Preciso de certificado digital?",
        a: "Depende do município. Alguns exigem certificado A1/A3, outros usam login e senha. O NotaPilot suporta ambos os modelos — configure conforme o que o seu município pede.",
      },
      {
        q: "Como funciona para um escritório com vários clientes?",
        a: "Cada empresa é uma entidade separada no sistema, com suas próprias credenciais e histórico. Você acessa tudo em um único painel e pode alternar entre empresas sem sair.",
      },
      {
        q: "O que acontece quando a nota é rejeitada?",
        a: "O sistema registra o erro, traduz a mensagem para linguagem clara (error translator) e envia um alerta no WhatsApp com a causa provável e o próximo passo sugerido. Nada fica silencioso.",
      },
      {
        q: "Como cancelo ou substituo uma nota?",
        a: "Via WhatsApp com um comando simples ('cancela [número]' ou 'substitui [número]') ou pelo painel. O histórico de cancelamento e substituição fica registrado.",
      },
      {
        q: "Isso substitui meu contador?",
        a: "Não. O NotaPilot automatiza a emissão e gestão de NFS-e — a parte operacional repetitiva. O julgamento tributário, o planejamento e o relacionamento com o cliente continuam sendo do contador.",
      },
    ],
  },

  ctaFinal: {
    heading: "Comece hoje, sem compromisso.",
    subheading:
      "Configure sua primeira empresa em minutos e emita pelo WhatsApp ainda hoje.",
    ctaPrimary: { label: "Criar conta grátis", href: "/auth/signup" },
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
          { label: "Status do sistema", href: "/api/status" },
          { label: "Contato", href: "mailto:contato@notapilot.com.br" },
        ],
      },
    ],
    copy: `© ${new Date().getFullYear()} NotaPilot. Todos os direitos reservados.`,
  },
} as const;
