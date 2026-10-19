# Clash of Candles — pre-launch web

Česká landing page hry Clash of Candles. Čisté HTML/CSS/JS bez build kroku — stačí nahrát složku na jakýkoli statický hosting (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

```
index.html
assets/
  css/styles.css
  js/main.js          config, nav, intro hero, scroll přechod hero → hra, ranky, shop, formulář
  js/game.js          ukázková hra (pohledy D/H/M, indikátory, časovač, coins, životy) + panel výher
  data/rewards.json   PLACEHOLDER ekonomika a produkty (iPhone, sluchátka…) — panel výher i shop se kreslí odsud
  js/vendor/gsap.min.js
  fonts/              Archivo (variabilní, self-hosted, OFL)
  img/                panáčci (zvlášť zelený / červený pro animaci + originál), screenshoty, logo, OG obrázek
```

Lokální náhled: `python3 -m http.server` v kořeni repa a otevřít `http://localhost:8000`.

Žádné externí CDN ani Google Fonts — fonty i GSAP jsou v repu (GDPR, rychlost).

## Struktura stránky

Texty podle dokumentu „Clash of Candles — kompletní texty webu“ (16 sekcí).

1. **Hero** — panáčci přiletí z obou stran, úder, shora dopadne logo, prach + rázová vlna na 3D podlaze. Hero je sticky.
2. **Ukázková hra** — při scrollu panáčci odjedou do stran a zespodu přijede panel s hrou. Po kliknutí na Breakout/Breakdown se vedle grafu (na mobilu pod ním) vysune panel výher: výsledek, coins a postup ke slevě na produkty z `rewards.json`.
3. První vlna (formulář) · 4. Jak hra funguje · 5. Key features / čísla · 6. Odhalení svíčky · 7. Coins · 8. Ranky · 9. Životy · 10. Contesty · 11. Shop (+ příklad 10 000 Kč) · 12–13. Statistiky + Academy · 14. Férovost · 15. FAQ · 16. Závěrečné CTA.

Nikde se nezmiňuje SKIP Trading ani provozovatel. `prefers-reduced-motion` vypne intro i scroll efekty.

### Panel výher je dynamický
`#game[data-rewards]` ukazuje na `assets/data/rewards.json`. Až bude API shopu, stačí tam dát URL endpointu se stejnou strukturou (`products[]` s `name`, `tagline`, `price`, `icon` nebo `image`, `featured`; `maxDiscountPct`, `coinValue`, `game.entry/win/startCoins/lives/roundSeconds`). Produkt s `image` zobrazí fotku místo ikony.

## Před spuštěním doplnit / potvrdit

- [ ] **Endpoint formuláře.** `index.html` → `<form id="signup" data-endpoint="">`. Formulář posílá `POST` JSON `{ email, adult, source, ts }`. Dokud je prázdný, e-maily se nikam neodesílají (jen `console.warn` a localStorage v prohlížeči hráče).
- [ ] **Ceny a kurz coins v `rewards.json`** jsou placeholder (iPhone 24 990 Kč, 1 coin = 1 Kč slevy, max. 80 %).
- [ ] **Ekonomika ranků** je zatím návrh — názvy (Knot → Legenda), vstupy 10/25/50/100/200/500, výhry 2× vstup a které nástroje na kterém ranku mizí. Vše v `assets/js/main.js`, pole `RANKS`.
- [ ] **Výhody první vlny** (early access, startovní bonus, founder badge, první contesty) a **čísla** (3 min, 11 000+, 15 let) — podle dokumentu nechat jen to, co je potvrzené.
- [ ] **Návrat po 10 chybách** — na webu je „návrat platí na následujících 4 hodiny“. Pokud to znamená „4 hodiny na to, si návrat koupit“, upravit text v sekci Životy a ve FAQ.
- [ ] **Právní texty** — patička a FAQ tvrdí: není to investiční služba, coins nelze vyměnit za peníze, 18+. Nechat zkontrolovat právníkem (kupované coins + reálné produkty).
- [ ] Údaje o provozovateli, obchodní podmínky, GDPR — doplnit do patičky.
- [ ] `og:image` a další meta používají relativní cesty; po nasazení přepsat na absolutní URL domény.

## Licence třetích stran

- Archivo — SIL Open Font License (`assets/fonts/OFL.txt`)
- GSAP 3.12.5 — GreenSock Standard License (bezplatné použití)
