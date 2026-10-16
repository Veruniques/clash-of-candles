# Clash of Candles — pre-launch web

Česká landing page hry Clash of Candles. Čisté HTML/CSS/JS bez build kroku — stačí nahrát složku na jakýkoli statický hosting (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

```
index.html
assets/
  css/styles.css
  js/main.js          nav, intro animace hero, ranky, záložky screenshotů, formulář
  js/demo.js          hratelné ukázkové kolo (simulovaný graf, canvas)
  js/vendor/gsap.min.js
  fonts/              Archivo (variabilní, self-hosted, OFL)
  img/                panáčci (zvlášť zelený / červený pro animaci + originál), screenshoty, logo, OG obrázek
```

Lokální náhled: `python3 -m http.server` v kořeni repa a otevřít `http://localhost:8000`.

Žádné externí CDN ani Google Fonts — fonty i GSAP jsou v repu (GDPR, rychlost).

## Struktura stránky

1. **Hero** — zelený panáček přiletí zleva, červený zprava, úder (záblesk, jiskry, otřes), shora dopadne logo a od země se zvedne prach. Pak hook „90 % lidí tohle tipne špatně.“ Po dopadu se oba panáčci vymění za originální kompozici (`candles-duo.webp`), takže finální obraz je pixelově přesný. `prefers-reduced-motion` ukáže rovnou finální stav.
2. **Ukázkové kolo** — hratelná demo hra (3 kola, breakout/breakdown, EMA, jedno odhalení svíčky).
3. **První vlna** — urgence + exkluzivita, sběr e-mailů.
4. Jak funguje kolo · screenshoty kola · odhalení · coins · ranky · životy · contesty · shop · statistiky a akademie · férovost dat · FAQ · závěrečné CTA.

Nikde se nezmiňuje SKIP Trading ani provozovatel.

## Před spuštěním doplnit / potvrdit

- [ ] **Endpoint formuláře.** `index.html` → `<form id="signup" data-endpoint="">`. Formulář posílá `POST` JSON `{ email, adult, source, ts }`. Dokud je prázdný, e-maily se nikam neodesílají (jen `console.warn` a localStorage v prohlížeči hráče).
- [ ] **Ekonomika ranků** je zatím návrh — názvy (Knot → Legenda), vstupy 10/25/50/100/200/500, výhry 2× vstup a které nástroje na kterém ranku mizí. Vše v `assets/js/main.js`, pole `RANKS`.
- [ ] **Výhody první vlny** (startovní balík coins navíc, odznak, pozvánka do contestu o 15 000 coins) — potvrdit, že je opravdu dáme.
- [ ] **Návrat po 10 chybách** — na webu je „návrat platí na následujících 4 hodiny“. Pokud to znamená „4 hodiny na to, si návrat koupit“, upravit text v sekci Životy a ve FAQ.
- [ ] **Právní texty** — patička a FAQ tvrdí: není to investiční služba, coins nelze vyměnit za peníze, 18+. Nechat zkontrolovat právníkem (kupované coins + reálné produkty).
- [ ] Údaje o provozovateli, obchodní podmínky, GDPR — doplnit do patičky.
- [ ] `og:image` a další meta používají relativní cesty; po nasazení přepsat na absolutní URL domény.

## Licence třetích stran

- Archivo — SIL Open Font License (`assets/fonts/OFL.txt`)
- GSAP 3.12.5 — GreenSock Standard License (bezplatné použití)
