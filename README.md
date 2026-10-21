# Clash of Candles — pre-launch web

Česká landing page hry Clash of Candles. Čisté HTML/CSS/JS bez build kroku — stačí nahrát složku na jakýkoli statický hosting (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

```
index.html
assets/
  css/styles.css
  js/main.js          config, nav, intro hero, scroll přechod, ranky (obtížnost), odměny (TOP 3 + mlha), contesty, žebříček, statistiky, formulář
  js/logo3d.js        3D značka v navigaci a patičce (vlastní mini WebGL, bez knihoven; SVG jako záloha)
  js/game.js          hra ve skutečném UI (světlý graf, G1/G2, FAB menu Indikátory/Kreslení/Akce, štítky BREAKOUT/BREAKDOWN, stavy Čeká/Spárováno/Výhra): tutoriál s kurzorem + volné hraní
  data/rewards.json   PLACEHOLDER ekonomika a produkty — panel odměn, TOP 3 i „mlha“ se kreslí odsud
  js/vendor/gsap.min.js
  fonts/              Archivo (variabilní, self-hosted, OFL)
  img/                panáčci, play-real.webp (záběr ze skutečné hry), záložní ilustrace produktů (img/products), logo, OG obrázek
```

Lokální náhled: `python3 -m http.server` v kořeni repa a otevřít `http://localhost:8000`.
Žádné externí CDN ani Google Fonts. Assety mají `?v=` verzi — při změně CSS/JS ji zvedněte (jinak prohlížeče drží starou cache).

## Struktura stránky (podle připomínek šéfa)

0. **Hero** — animace beze změny; slogan, Registruj se.
1. **Jak to funguje** (`#jak`, v panelu, který vyjede přes hero) — jen symboly: coin → play → srdíčko → odměny (♥ + Kč). Žádné texty.
2. **Marketplace** (`#odmeny`) — 3 odměny vedle sebe bez pořadí (`market: true` v `rewards.json`), cena = srdíčka + doplatek; pod tím další odměny v mlze.
3. **Tutoriál** (`#tutorial`) — hra se sama přehraje s kurzorem, pak volné hraní.
4. **Pilíře** — 90 s, 15 let dat, 2 výsledky, contesty.
5. **Play** — „Tohle je tvoje útočiště“ + žebříček ranků.
6. **Coins** — palivo, balíčky, free to play (hex mince `img/coin-hex.webp`).
7. **Contesty · Academy · Rank** (`#contesty`, `#academy`, `#rank`) — jedna sekce, tři karty.
8. **Statistika** · Registrace · FAQ · závěrečné CTA.

Ekonomika na webu: **coins** = palivo (vstup do kola), **srdíčka** = výhry, které se mění na slevu v shopu (`candleValue` Kč za srdíčko — název klíče zůstal). Odměny nejsou za umístění: srdíčka se utratí za cokoli, zbytek se doplatí.

## Před spuštěním doplnit / potvrdit

- [ ] **Endpoint formuláře.** `index.html` → `<form id="signup" data-endpoint="">`. Formulář posílá `POST` JSON `{ email, adult, source, ts }`. Dokud je prázdný, e-maily se nikam neodesílají (jen `console.warn` a localStorage v prohlížeči hráče).
- [ ] **Produkty v `rewards.json`** — skutečné produkty a ceny dle apple.com/cz (iPhone 18 Pro 34 990 Kč, AirPods Max 13 990 Kč, Apple Watch Series 12 10 990 Kč, AirPods Pro 3 6 490 Kč). **Fotky jsou zatím odkazované přímo z Apple CDN** — před spuštěním nahradit licencovanými fotkami shopu/partnera (přepsat `image`). Hodnota srdíčka (50 Kč) a max. sleva 80 % jsou placeholder; ceny v marketplace (♥ + Kč) se z nich počítají automaticky.
- [ ] **Ranky** jsou podle hry: F → E → D → C → B → A → S → G.O.A.T. (s +/++), získávají se hrou, začíná se na F. Rozhraní Ranks kopíruje obrazovku ze hry; sloupce Vstup (10–1 000 coins) a Výhra (1–100 srdíček) jsou placeholder. `assets/js/main.js`, pole `RANKS`.
- [ ] **Výhody registrace** (early access, startovní bonus, founder badge) — nechat jen potvrzené.
- [ ] **Mock data** — žebříček, statistiky a Academy kvíz jsou ilustrační (`main.js`, `index.html`).
- [ ] **Právní texty** — patička a FAQ tvrdí: není to investiční služba, coins nelze vyměnit za peníze, 18+. Nechat zkontrolovat právníkem (kupované coins + reálné produkty).
- [ ] Údaje o provozovateli, obchodní podmínky, GDPR — doplnit do patičky.
- [ ] `og:image` a další meta používají relativní cesty; po nasazení přepsat na absolutní URL domény.

## Licence třetích stran

- Archivo — SIL Open Font License (`assets/fonts/OFL.txt`)
- GSAP 3.12.5 — GreenSock Standard License (bezplatné použití)
