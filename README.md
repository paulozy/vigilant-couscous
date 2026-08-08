# Unified Calendar

Dashboard que unifica os calendários Outlook de até 3 contas (via Microsoft Graph). SPA em React + TypeScript (Vite), protegida por senha e hospedada na Vercel.

## Como funciona o acesso

O app é protegido por uma senha (token gerado, guardado em env — não é algo que você memoriza, é algo que você copia de um cofre de senhas). Ao logar com sucesso, o servidor emite um cookie de sessão `httpOnly` válido por **15 dias**; depois disso expira e pede a senha de novo. Veja `api/_lib/auth.ts`, `api/login.ts`, `api/session.ts`, `api/logout.ts`.

Importante: como o build é estático e pode ficar num repositório público, **nenhum segredo pode ir em variável `VITE_*`** — essas são inlined no bundle JS e ficam visíveis a qualquer um. Por isso `APP_PASSWORD` e `AUTH_SECRET` são env vars server-only, lidas apenas dentro das funções em `api/`.

## Setup local

```bash
cp .env.example .env
```

Preencha `.env`:
- `VITE_MS_CLIENT_ID` — do seu App Registration no Azure AD (identificador público de OAuth, ok expor no client).
- `APP_PASSWORD` — gere com `openssl rand -base64 24`.
- `AUTH_SECRET` — gere com `openssl rand -base64 32`. Trocar esse valor invalida todas as sessões ativas (logout global).

**Importante — App Registration multitenant**: como o app loga em contas Outlook de empresas diferentes (tenants diferentes do Azure AD cada uma), o registration precisa estar configurado como multitenant: **Azure/Entra admin center → App registrations → seu app → Authentication → Supported account types → "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)"**. Sem isso, contas de fora do tenant "dono" do app recebem o erro `AADSTS50020`. O código já usa o endpoint `/organizations` (não uma tenant ID fixa) para refletir isso — veja `CONFIG.authority` em `src/components/CalendarDashboard.tsx`. ([docs](https://learn.microsoft.com/en-us/entra/identity-platform/howto-convert-app-to-be-multi-tenant))

Cada empresa, no primeiro login, vai ver uma tela de consentimento do Microsoft Entra pedindo pra aceitar as permissões (`Calendars.Read`, `offline_access`) — isso é esperado, só acontece uma vez por tenant. Se a política de consentimento de alguma empresa bloquear consentimento de usuário comum, quem vai precisar aprovar é um admin daquele tenant.

Rode com:

```bash
npx vercel dev
```

Isso serve a SPA e as funções `/api` na mesma origem — igual à produção, então o cookie de sessão funciona corretamente. (`vite dev` sozinho **não** roda as funções `/api`; use `vercel dev` para testar o fluxo de login localmente.) Na primeira execução ele pode perguntar se quer linkar a um projeto Vercel — pode recusar, ele roda local mesmo assim.

## Deploy (Vercel)

1. Suba este repositório para o GitHub (pode ser público — nenhum segredo está no código, só em env vars).
2. Importe o repo na Vercel.
3. Em **Project Settings → Environment Variables**, adicione as 3 chaves acima (`VITE_MS_CLIENT_ID`, `APP_PASSWORD`, `AUTH_SECRET`) para os ambientes **Production**, **Preview** e **Development**.
4. No **App Registration do Azure**, adicione a URL final da Vercel (ex.: `https://seu-projeto.vercel.app`) como Redirect URI — sem isso o login com a Microsoft falha.
5. Deploy.

## Scripts

```bash
npm run dev      # vite dev server (sem /api — use `vercel dev` para isso)
npm run build    # typecheck + build de produção
npm run preview  # serve o build de produção localmente
npm run lint     # oxlint
```
