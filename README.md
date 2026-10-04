# Automatizare RCA Asigurari.ro

Aplicatie web minimalista pentru upload de scenarii RCA in Excel/CSV, rulare secventiala prin Playwright si export al aceluiasi workbook cu preturi pe coloane in dreapta datelor initiale.

## Pornire locala

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Deschide `http://localhost:8000`, autentifica-te cu parola din `APP_PASSWORD`, descarca template-ul si incarca un fisier completat.

## Study phase

Ruleaza:

```bash
npm run study
```

Comanda deschide ruta RCA, salveaza HTML/screenshot si selectorii candidati in `data/study/`. Dupa verificare, ajusteaza `src/automation/selectors.ts` daca DOM-ul site-ului s-a schimbat.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Aplicatia asculta pe portul definit in `PORT`, implicit `8000`.

## Coolify si Cloudflare Tunnel

1. Creeaza un proiect Coolify din repository/folder.
2. Alege deploy cu Dockerfile sau Docker Compose.
3. Seteaza variabilele `APP_PASSWORD`, `SESSION_SECRET`, `PORT=8000`, `HEADLESS=true`, `DATA_DIR=/app/data`.
4. Monteaza un volum persistent pe `/app/data`.
5. Configureaza Cloudflare Tunnel extern in Coolify catre serviciul aplicatiei si portul intern `8000`.

## Observatii de siguranta

- Aplicatia nu logheaza CNP, telefon, email, serie CI sau VIN in clar.
- Daca apare CAPTCHA/Cloudflare/challenge, jobul intra in `waiting_for_manual_action` si poate fi reluat din dashboard dupa interventie autorizata.
- Pentru productie, foloseste o parola lunga si un `SESSION_SECRET` generat aleator.
# oferte_rca
