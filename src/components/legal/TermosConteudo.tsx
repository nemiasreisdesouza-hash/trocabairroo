// ═══════════════════════════════════════════════════════════
// TERMOS DE USO E ISENÇÃO DE RESPONSABILIDADE · TrocaBairro
// Compartilhado entre o modal de cadastro e a página /termos
// ═══════════════════════════════════════════════════════════

export type TermoClausula = {
  numero: string;
  titulo: string;
  paragrafos: string[];
};

export const TERMOS_INTRO =
  "Estes Termos de Uso regem a utilização da plataforma TrocaBairro, que conecta pequenos empreendedores, prestadores de serviços e criadores de conteúdo do mesmo bairro para a realização de permutas (trocas diretas de serviços e produtos, sem envolvimento de dinheiro). Ao criar uma conta, você declara ter lido, compreendido e aceito integralmente todas as cláusulas abaixo.";

export const TERMOS_CLAUSULAS: TermoClausula[] = [
  {
    numero: "1",
    titulo: "Da natureza da plataforma",
    paragrafos: [
      "1.1. O TrocaBairro é uma plataforma exclusivamente de intermediação e aproximação entre usuários interessados em trocar serviços e produtos. A plataforma NÃO participa, NÃO intermedeia, NÃO fiscaliza e NÃO executa as trocas acordadas entre as partes.",
      "1.2. As negociações, condições, prazos, entregas e eventuais ajustes são definidos exclusivamente entre os usuários, por meios próprios (incluindo WhatsApp, telefone ou presencialmente), fora do ambiente controlado pela plataforma.",
    ],
  },
  {
    numero: "2",
    titulo: "Da isenção de responsabilidade CIVIL",
    paragrafos: [
      "2.1. O TrocaBairro, seus sócios, administradores, colaboradores e prepostos NÃO assumem qualquer responsabilidade civil, direta ou indireta, por danos materiais, morais, lucros cessantes ou emergentes decorrentes das trocas, negociações, descumprimentos, atrasos, vícios, defeitos ou falhas na execução dos serviços e produtos permutados entre usuários.",
      "2.2. Qualquer discussão, reparação ou indenização deve ser tratada exclusivamente entre os usuários envolvidos, isentando a plataforma de qualquer ônus, custas ou responsabilidade.",
      "2.3. As avaliações e reputações exibidas na plataforma refletem apenas a opinião de outros usuários e não constituem garantia, endosso ou certificação da qualidade, idoneidade ou capacidade de qualquer usuário, serviço ou produto.",
    ],
  },
  {
    numero: "3",
    titulo: "Da isenção de responsabilidade PENAL",
    paragrafos: [
      "3.1. A plataforma não monitora, direta ou indiretamente, a conduta dos usuários nas negociações realizadas fora do ambiente da plataforma, isentando-se de qualquer responsabilidade penal por atos ilícitos praticados por usuários, tais como estelionato, fraude, apropriação indébita, ameaça ou qualquer outro crime ou contravenção.",
      "3.2. Ao identificar práticas ilícitas, os usuários devem acionar diretamente as autoridades policiais e o Poder Judiciário, não restando à plataforma qualquer responsabilidade solidária, subsidiária ou concorrente.",
    ],
  },
  {
    numero: "4",
    titulo: "Da isenção de responsabilidade CRIMINAL",
    paragrafos: [
      "4.1. O TrocaBairro não pratica, induz, incentiva nem concorre para qualquer ato criminoso eventualmente praticado por usuários na utilização da plataforma, seja na publicação de anúncios, no contato com terceiros ou na execução das trocas.",
      "4.2. Usuários que utilizarem a plataforma para fins ilícitos serão banidos, podendo a plataforma cooperar com autoridades quando legalmente requisitada, sem que isso implique assunção de qualquer responsabilidade criminal.",
    ],
  },
  {
    numero: "5",
    titulo: "Da isenção de responsabilidade TRABALHISTA",
    paragrafos: [
      "5.1. As trocas realizadas por meio da plataforma NÃO criam vínculo empregatício, societário, de parceria, de estágio ou de qualquer natureza entre os usuários e a plataforma, tampouco entre os próprios usuários.",
      "5.2. A plataforma não é empregadora, contratante, agenciadora ou tomadora de serviços dos usuários, não recolhendo encargos, tributos ou verbas de qualquer natureza, e não respondendo por salários, férias, 13º, FGTS, adicionais, verbas rescisórias ou qualquer outro direito trabalhista ou previdenciário.",
      "5.3. Cada usuário é integralmente responsável pelo recolhimento de tributos e pelo cumprimento de obrigações legais, fiscais, previdenciárias e trabalhistas decorrentes de suas atividades.",
    ],
  },
  {
    numero: "6",
    titulo: "Da veracidade dos dados cadastrais (incluindo CPF)",
    paragrafos: [
      "6.1. O usuário declara que os dados informados no cadastro — nome completo, e-mail, telefone/WhatsApp com DDD, CPF, estado (UF), cidade, bairro e categoria de atuação — são verdadeiros, completos e de sua titularidade.",
      "6.2. O CPF informado é utilizado exclusivamente para identificação do usuário e mitigação de fraude, nos termos da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), não sendo compartilhado publicamente nem com outros usuários.",
      "6.3. O fornecimento de dados falsos, de terceiros ou fraudulentos sujeita o usuário ao banimento imediato, sem prejuízo das responsabilizações civil e penal cabíveis.",
    ],
  },
  {
    numero: "7",
    titulo: "Do contato via WhatsApp e comunicações externas",
    paragrafos: [
      "7.1. Ao publicar anúncios, o usuário autoriza a exibição do seu número de WhatsApp para contatos relacionados a propostas de troca por outros usuários autenticados na plataforma.",
      "7.2. A plataforma não se responsabiliza pelo conteúdo das conversas, arquivos enviados ou acordos firmados fora do seu ambiente.",
    ],
  },
  {
    numero: "8",
    titulo: "Das avaliações e da reputação",
    paragrafos: [
      "8.1. Ao final de cada troca, ambos os usuários devem se avaliar reciprocamente (nota de 1 a 5 estrelas e indicação de cumprimento do combinado). O percentual de aprovação público é calculado como (avaliações positivas ÷ total de avaliações) × 100.",
      "8.2. Enquanto houver avaliação pendente, o usuário fica temporariamente impedido de iniciar novas trocas na plataforma.",
      "8.3. Avaliações falsas, difamatórias ou ofensivas podem ser removidas pela moderação, mediante denúncia e análise.",
    ],
  },
  {
    numero: "9",
    titulo: "Dos planos, impulsionamentos e pagamentos",
    paragrafos: [
      "9.1. A plataforma é gratuita (plano Experimente). Planos opcionais (Conexão e Expansão) e impulsionamentos (Topo do Feed, Selo Destaque, Selo Verificado) podem ser contratados pelos valores divulgados, sem caráter obrigatório.",
      "9.2. A contratação de planos ou impulsionamentos não garante resultados comerciais, clientes ou trocas, constituindo apenas recursos de maior visibilidade.",
    ],
  },
  {
    numero: "10",
    titulo: "Das sanções e do encerramento",
    paragrafos: [
      "10.1. O descumprimento destes Termos sujeita o usuário a advertência, suspensão ou banimento, a critério exclusivo da plataforma.",
      "10.2. O usuário pode encerrar sua conta a qualquer momento, permanecendo válido tudo o que aqui estiver disposto com relação a fatos ocorridos durante a vigência do cadastro.",
    ],
  },
  {
    numero: "11",
    titulo: "Disposições gerais e foro",
    paragrafos: [
      "11.1. Estes Termos podem ser atualizados a qualquer tempo, prevalecendo a versão publicada na plataforma.",
      "11.2. Fica eleito o foro do domicílio do usuário para dirimir eventuais controvérsias, excluída qualquer responsabilidade da plataforma nos termos das cláusulas anteriores.",
    ],
  },
];

export function TermosTexto() {
  return (
    <div className="text-sm text-gray-700 leading-relaxed flex flex-col gap-4">
      <p className="text-gray-600">{TERMOS_INTRO}</p>
      {TERMOS_CLAUSULAS.map((cl) => (
        <section key={cl.numero}>
          <h3 className="font-bold text-gray-900 mb-1">
            Cláusula {cl.numero} — {cl.titulo}
          </h3>
          {cl.paragrafos.map((p, i) => (
            <p key={i} className="mb-1 text-gray-600 text-[13px] leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        TrocaBairro · Plataforma de permuta de serviços entre vizinhos · Última
        atualização: {new Date().toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
}
