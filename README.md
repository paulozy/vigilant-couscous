# Unified Calendar

Dashboard que unifica os calendários Outlook de até 3 contas via feeds **ICS/iCalendar publicados**. SPA em React + TypeScript (Vite), protegida por senha e hospedada na Vercel.

## Por que ICS e não Microsoft Graph API

A versão original usava OAuth + Microsoft Graph API. Isso trombou em `AADSTS50020` (endpoint precisava ser multitenant) e depois em "Need admin approval" — tenants corporativos exigem que um administrador aprove o app antes de qualquer usuário poder logar, e isso não é algo que dá pra contornar tecnicamente nem sempre é viável de conseguir.

A alternativa: cada conta Outlook pode **publicar seu calendário como feed ICS** — uma configuração pessoal da caixa de e-mail (não um app registration), então não passa por aprovação de admin nenhuma.

**Como publicar** (em cada conta Outlook que você quer conectar):
1. Outlook na web → **Configurações** → **Calendário** → **Compartilhamento** → **Publicar um calendário**.
2. Selecione o calendário e o nível de detalhe **"Pode ver todos os detalhes"** (níveis mais baixos escondem título/descrição do evento — o app fica bem menos útil).
3. Copie a URL `.ics` gerada (formato `https://outlook.office365.com/owa/calendar/.../calendar.ics`).

**Pré-requisito fora do nosso controle**: a opção "Publicar calendário" só aparece se a *sharing policy* do Exchange Online daquele tenant liberar o domínio `Anonymous`. Se não aparecer nas configurações, o admin daquela empresa bloqueou — mesmo tipo de política que bloqueou o caminho OAuth, só que dessa vez não tem link de aprovação pra mandar.

**Isso não é tempo real**: a Microsoft regenera o feed publicado periodicamente (minutos a poucas horas, não instantâneo). Pra um dashboard de consulta isso é suficiente; não espere ver um evento criado agora há pouco aparecer imediatamente.

**A URL é a credencial**: quem tiver a URL consegue ver o calendário (não tem autenticação de verdade, é um link "secreto"). Não compartilhe.

## Como funciona o acesso

Duas camadas independentes:

1. **Senha do app** — protege o dashboard inteiro. Veja `api/_lib/auth.ts`, `api/login.ts`, `api/session.ts`, `api/logout.ts`. Sessão em cookie `httpOnly`, válida por 15 dias.
2. **Feeds ICS** — cada URL de calendário fica salva no `localStorage` do seu navegador (nunca em env var, nunca no bundle). Pra buscar os eventos, o client manda as URLs pro nosso backend via `POST /api/events` (nunca em query string, pra não vazar em logs/histórico), que busca e faz o parsing (`api/_lib/ics.ts`, biblioteca `node-ical`) e devolve os eventos já normalizados. Um feed com erro não derruba os outros — cada fonte tem status próprio.

## Setup local

```bash
cp .env.example .env
```

Preencha `.env`:
- `APP_PASSWORD` — gere com `openssl rand -base64 24`.
- `AUTH_SECRET` — gere com `openssl rand -base64 32`. Trocar esse valor invalida todas as sessões ativas (logout global).

Rode com:

```bash
npx vercel dev
```

Isso serve a SPA e as funções `/api` na mesma origem — igual à produção, então o cookie de sessão funciona corretamente. (`vite dev` sozinho **não** roda as funções `/api`.) Na primeira execução ele pode perguntar se quer linkar a um projeto Vercel — pode recusar, ele roda local mesmo assim.

Depois de logar com a senha, use **"+ Adicionar Conta"** pra colar o nome e a URL do ICS de cada calendário (até 3).

## Deploy (Vercel)

1. Suba este repositório para o GitHub (pode ser público — nenhum segredo está no código; os feeds ICS ficam só no seu navegador).
2. Importe o repo na Vercel.
3. Em **Project Settings → Environment Variables**, adicione `APP_PASSWORD` e `AUTH_SECRET` para os ambientes **Production**, **Preview** e **Development**.
4. Deploy.

## Scripts

```bash
npm run dev      # vite dev server (sem /api — use `vercel dev` para isso)
npm run build    # typecheck + build de produção
npm run preview  # serve o build de produção localmente
npm run lint     # oxlint
```
