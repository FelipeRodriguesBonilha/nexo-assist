import type Database from "better-sqlite3";
import { hashPassword } from "./auth";

export const DEMO_PASSWORD = "nexo123";

const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3_600_000).toISOString();

const EMPLOYEES = [
  ["u-ana", "ana.souza@nexo.com.br", "Ana Souza", "employee", "Financeiro"],
  ["u-bruno", "bruno.lima@nexo.com.br", "Bruno Lima", "employee", "Comercial"],
  ["u-carla", "carla.mendes@nexo.com.br", "Carla Mendes", "employee", "RH"],
  ["u-diego", "diego.alves@nexo.com.br", "Diego Alves", "analyst", "TI - Suporte N1"],
  ["u-marina", "marina.costa@nexo.com.br", "Marina Costa", "analyst", "TI - Suporte N2"],
] as const;

const ARTICLES = [
  ["kb-vpn809", "VPN com erro 809", "Rede e VPN", "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.", "vpn erro 809 conexão remoto home office cliente"],
  ["kb-horario", "Horário do service desk", "Outros", "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.", "horário atendimento plantão service desk expediente"],
  ["kb-senha", "Redefinir senha da rede", "Acesso", "Acesse senha.nexo.com, informe o e-mail corporativo e siga o código enviado ao celular cadastrado. Após 5 tentativas erradas a conta é bloqueada por 30 minutos. Contas bloqueadas por mais tempo exigem chamado.", "senha esqueci bloqueada bloqueio redefinir login conta"],
  ["kb-wifi", "Wi-Fi corporativo não conecta", "Rede e VPN", "Esqueça a rede NEXO-CORP, reconecte com e-mail e senha da rede. Se aparecer erro de certificado, reinicie o dispositivo. Se persistir em mais de uma pessoa, abra chamado de incidente.", "wifi wi-fi internet rede sem fio certificado lenta"],
  ["kb-outlook", "Outlook travando ou sem sincronizar", "E-mail", "Feche o Outlook, abra Painel de Controle > Correio > Perfis e crie um novo perfil. Caixas acima de 50 GB precisam de arquivamento: abra uma requisição.", "outlook email e-mail caixa sincronizar travando cheia"],
  ["kb-software", "Instalar software homologado", "Software", "Softwares da lista homologada podem ser instalados pelo portal de softwares. Fora da lista, abra uma requisição com a justificativa de negócio e aprovação do gestor.", "instalar software programa licença portal aplicativo"],
  ["kb-monitor", "Solicitar equipamento (monitor, mouse, teclado)", "Hardware", "Periféricos são solicitados via requisição de hardware, com aprovação do gestor. O prazo de entrega após aprovação é de até 5 dias úteis.", "monitor mouse teclado equipamento periférico notebook solicitar headset"],
  ["kb-lento", "Notebook lento", "Hardware", "Reinicie o computador, feche programas em segundo plano e verifique atualizações pendentes. Se a lentidão continuar após 24h, abra um chamado informando o modelo e o que mudou recentemente.", "notebook lento travando desempenho computador devagar atualização windows"],
  ["kb-mfa", "Autenticação em dois fatores (MFA)", "Acesso", "Troca de celular: o código MFA precisa ser reconfigurado por um analista. Abra um chamado de acesso informando o novo número.", "mfa autenticador token código dois fatores celular"],
] as const;

export function seed(db: Database.Database): void {
  const pw = hashPassword(DEMO_PASSWORD);
  const insEmp = db.prepare("INSERT INTO employees VALUES (?,?,?,?,?,?)");
  for (const [id, email, name, role, dept] of EMPLOYEES) insEmp.run(id, email, name, pw, role, dept);

  const insArt = db.prepare("INSERT INTO articles VALUES (?,?,?,?,?)");
  for (const a of ARTICLES) insArt.run(...a);

  const insTk = db.prepare(
    "INSERT INTO tickets (id,type,title,description,category,priority,status,requester_id,created_at,updated_at,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  );
  const tickets: [string, string, string, string, string, string, string, string, string, string, string | null][] = [
    ["INC-20311", "INC", "VPN não conecta (erro 809)", "VPN retorna erro 809 no Windows 11, mesmo após reinstalar o cliente. Trabalho remoto às sextas.", "Rede e VPN", "Alta", "Aberto", "u-ana", ago(8), ago(6), null],
    ["REQ-10442", "REQ", "Notebook lento após atualização do Windows", "Após a última atualização o notebook demora mais de 10 minutos para iniciar.", "Hardware", "Média", "Aguardando analista", "u-ana", ago(9), ago(7), null],
    ["INC-20150", "INC", "Senha do SAP bloqueada", "Conta do SAP bloqueada após várias tentativas. Desbloqueada pelo suporte.", "Acesso", "Média", "Resolvido", "u-ana", ago(6), ago(4), ago(4)],
    ["REQ-10398", "REQ", "Segundo monitor para home office", "Solicito um segundo monitor para uso em home office.", "Hardware", "Baixa", "Aprovado", "u-bruno", ago(3), ago(1), null],
    ["INC-20402", "INC", "Outlook não sincroniza no celular", "Caixa de e-mail não sincroniza no celular desde ontem.", "E-mail", "Média", "Em andamento", "u-bruno", ago(2), ago(1), null],
    ["INC-20377", "INC", "Impressora do 3º andar offline", "Impressora do RH aparece offline para todo o andar.", "Hardware", "Crítica", "Aberto", "u-carla", ago(0, 6), ago(0, 5), null],
    ["INC-20301", "INC", "Acesso ao sistema de folha negado", "Erro de permissão ao abrir o sistema de folha.", "Acesso", "Alta", "Resolvido", "u-carla", ago(12), ago(10), ago(10)],
  ];
  for (const t of tickets) insTk.run(...t);
}
