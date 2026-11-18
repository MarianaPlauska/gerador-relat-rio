import { describe, expect, it } from 'vitest';
import { aceitarConvite, criarConvite, emailValido, idDoConvite, normalizarEmail, permissoes, podeVerPasta, revogar, type Convite, type Membro, type Papel } from './acesso';

const agora = '2026-11-18T12:00:00';
const novo = (extra: Partial<Parameters<typeof criarConvite>[0]> = {}) => criarConvite({ email: 'Ana@Empresa.com', donoUid: 'dono1', papel: 'leitor', criadoEm: agora, ...extra });
const convite = (extra: Partial<Convite> = {}): Convite => ({ email: 'ana@empresa.com', donoUid: 'dono1', papel: 'leitor', pastas: [], criadoEm: agora, status: 'pendente', ...extra });

describe('e-mail', () =>
{
  it('normaliza para minúsculo e sem espaços nas pontas', () =>
  {
    expect(normalizarEmail('  Ana@Empresa.COM ')).toBe('ana@empresa.com');
  });

  it('aceita e-mails comuns e recusa os quebrados', () =>
  {
    expect(emailValido('ana@empresa.com')).toBe(true);
    expect(emailValido(' Ana.Silva+x@sub.empresa.com.br ')).toBe(true);
    for (const ruim of ['', 'ana', 'ana@', '@empresa.com', 'ana@empresa', 'ana@@empresa.com', 'a na@empresa.com', 'ana@empresa..com', 'ana@.com', 'a/b@empresa.com'])
    {
      expect(emailValido(ruim), ruim).toBe(false);
    }
    expect(emailValido(`${'a'.repeat(250)}@x.com`)).toBe(false);
  });

  it('o id do convite junta e-mail normalizado e dono', () =>
  {
    expect(idDoConvite(' Ana@Empresa.com ', 'dono1')).toBe('ana@empresa.com__dono1');
  });
});

describe('permissoes', () =>
{
  it('dono faz tudo', () =>
  {
    expect(permissoes('dono')).toEqual({ ler: true, editar: true, gerenciarEquipe: true, publicarLink: true });
  });

  it('supervisor lê e escreve, mas não gerencia a equipe', () =>
  {
    const p = permissoes('supervisor');
    expect(p.ler && p.editar).toBe(true);
    expect(p.gerenciarEquipe).toBe(false);
  });

  it('leitor só lê', () =>
  {
    expect(permissoes('leitor')).toEqual({ ler: true, editar: false, gerenciarEquipe: false, publicarLink: false });
  });

  it('papel inexistente não pode nada', () =>
  {
    expect(permissoes('chefe' as Papel)).toEqual({ ler: false, editar: false, gerenciarEquipe: false, publicarLink: false });
  });
});

describe('podeVerPasta', () =>
{
  const membro = (papel: Papel, pastas: string[]): Membro => ({ uid: 'u', email: 'a@b.co', papel, pastas });

  it('lista vazia libera todos os projetos', () =>
  {
    expect(podeVerPasta(membro('leitor', []), 'DEV')).toBe(true);
    expect(podeVerPasta(membro('leitor', []), 'qualquer')).toBe(true);
  });

  it('com lista, só as pastas dela, sem diferenciar maiúsculas', () =>
  {
    const m = membro('supervisor', ['DEV', ' Suporte ']);
    expect(podeVerPasta(m, 'dev')).toBe(true);
    expect(podeVerPasta(m, 'SUPORTE')).toBe(true);
    expect(podeVerPasta(m, 'Financeiro')).toBe(false);
    expect(podeVerPasta(m, '')).toBe(false);
  });

  it('o dono vê todas, mesmo com lista', () =>
  {
    expect(podeVerPasta(membro('dono', ['DEV']), 'Financeiro')).toBe(true);
  });

  it('papel inexistente não vê nada', () =>
  {
    expect(podeVerPasta(membro('chefe' as Papel, []), 'DEV')).toBe(false);
  });
});

describe('criarConvite', () =>
{
  it('cria pendente com e-mail normalizado e pastas limpas', () =>
  {
    const r = novo({ papel: 'supervisor', pastas: [' DEV ', 'dev', '', 'Suporte'] });
    expect(r).toEqual({ ok: true, valor: { email: 'ana@empresa.com', donoUid: 'dono1', papel: 'supervisor', pastas: ['DEV', 'Suporte'], criadoEm: agora, status: 'pendente' } });
  });

  it('sem pastas, o convite libera todos os projetos', () =>
  {
    const r = novo();
    expect(r.ok && r.valor.pastas).toEqual([]);
  });

  it('recusa e-mail inválido', () =>
  {
    expect(novo({ email: 'ana@' })).toEqual({ ok: false, erro: 'E-mail inválido.' });
  });

  it('recusa papel inexistente e papel dono', () =>
  {
    expect(novo({ papel: 'chefe' }).ok).toBe(false);
    expect(novo({ papel: 'dono' }).ok).toBe(false);
    expect(novo({ papel: '' }).ok).toBe(false);
  });

  it('recusa dono vazio e convite para o próprio dono', () =>
  {
    expect(novo({ donoUid: '  ' }).ok).toBe(false);
    expect(novo({ emailDoDono: 'ANA@empresa.com' })).toEqual({ ok: false, erro: 'Você já é o dono deste espaço.' });
  });

  it('recusa convite duplicado pendente ou já aceito, mesmo com outro jeito de escrever o e-mail', () =>
  {
    expect(criarConvite({ email: ' ANA@empresa.com', donoUid: 'dono1', papel: 'leitor', criadoEm: agora }, [convite()])).toEqual({ ok: false, erro: 'Já existe um convite pendente para esse e-mail.' });
    expect(criarConvite({ email: 'ana@empresa.com', donoUid: 'dono1', papel: 'supervisor', criadoEm: agora }, [convite({ status: 'aceito' })])).toEqual({ ok: false, erro: 'Essa pessoa já tem acesso.' });
  });

  it('convite de outro dono ou revogado não conta como duplicado', () =>
  {
    expect(criarConvite({ email: 'ana@empresa.com', donoUid: 'dono1', papel: 'leitor', criadoEm: agora }, [convite({ donoUid: 'dono2' })]).ok).toBe(true);
    expect(criarConvite({ email: 'ana@empresa.com', donoUid: 'dono1', papel: 'leitor', criadoEm: agora }, [convite({ status: 'revogado' })]).ok).toBe(true);
  });
});

describe('aceitarConvite', () =>
{
  it('gera o membro com o papel e as pastas do convite e marca como aceito', () =>
  {
    const c = convite({ papel: 'supervisor', pastas: ['DEV'] });
    const r = aceitarConvite(c, { uid: 'u9', email: 'ANA@empresa.com', nome: ' Ana ' });
    expect(r).toEqual({ ok: true, valor: { membro: { uid: 'u9', email: 'ana@empresa.com', nome: 'Ana', papel: 'supervisor', pastas: ['DEV'] }, convite: { ...c, status: 'aceito' } } });
    // o convite original não muda
    expect(c.status).toBe('pendente');
  });

  it('nome em branco vira ausente', () =>
  {
    const r = aceitarConvite(convite(), { uid: 'u9', email: 'ana@empresa.com', nome: '  ' });
    expect(r.ok && r.valor.membro.nome).toBeUndefined();
  });

  it('não aceita com o e-mail de outra pessoa', () =>
  {
    expect(aceitarConvite(convite(), { uid: 'u9', email: 'bia@empresa.com' })).toEqual({ ok: false, erro: 'Esse convite é para outro e-mail.' });
  });

  it('não aceita convite aceito ou revogado', () =>
  {
    expect(aceitarConvite(convite({ status: 'aceito' }), { uid: 'u9', email: 'ana@empresa.com' }).ok).toBe(false);
    expect(aceitarConvite(convite({ status: 'revogado' }), { uid: 'u9', email: 'ana@empresa.com' }).ok).toBe(false);
  });

  it('não aceita sem uid, nem o próprio dono, nem papel inexistente', () =>
  {
    expect(aceitarConvite(convite(), { uid: '', email: 'ana@empresa.com' }).ok).toBe(false);
    expect(aceitarConvite(convite(), { uid: 'dono1', email: 'ana@empresa.com' }).ok).toBe(false);
    expect(aceitarConvite(convite({ papel: 'chefe' as Convite['papel'] }), { uid: 'u9', email: 'ana@empresa.com' }).ok).toBe(false);
  });

  it('o membro não compartilha a lista de pastas com o convite', () =>
  {
    const c = convite({ pastas: ['DEV'] });
    const r = aceitarConvite(c, { uid: 'u9', email: 'ana@empresa.com' });
    if (r.ok) r.valor.membro.pastas.push('X');
    expect(c.pastas).toEqual(['DEV']);
  });
});

describe('revogar', () =>
{
  it('marca como revogado sem mexer no original e repetir não muda nada', () =>
  {
    const c = convite({ status: 'aceito' });
    const r = revogar(c);
    expect(r.status).toBe('revogado');
    expect(c.status).toBe('aceito');
    expect(revogar(r)).toBe(r);
  });
});
