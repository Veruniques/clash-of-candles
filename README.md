# Clash of Candles — pre-launch web

Česká landing page hry Clash of Candles. Čisté HTML/CSS/JS bez build kroku — stačí nahrát složku na jakýkoli statický hosting (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

```
index.html
assets/
  css/styles.css
  js/main.js          config, nav, intro hero, scroll přechod, ranky (obtížnost), odměny (TOP 3 + mlha), arény, žebříček, statistiky, formulář
  data/rewards.json   PLACEHOLDER ekonomika a produkty — panel odměn, TOP 3 i „mlha“ se kreslí odsud
  js/vendor/gsap.min.js
  fonts/              Archivo (variabilní, self-hosted, OFL)
  img/                panáčci, play-real.webp (záběr ze skutečné hry), záložní ilustrace produktů (img/products), logo, OG obrázek
```

Lokální náhled: `python3 -m http.server` v kořeni repa a otevřít `http://localhost:8000`.
Žádné externí CDN ani Google Fonts. Assety mají `?v=` verzi — při změně CSS/JS ji zvedněte (jinak prohlížeče drží starou cache).

## Struktura stránky (texty podle copy decku 10/2026 a úprav 25. 10. 2026)

0. **Hero** — „Přečti graf. Poraz soupeře. Hraj o velké ceny.“ + úvod vlevo; vpravo banner arén v designu hry (záložky Daily/Weekly/Monthly, výherní bank, Live flip odpočet h:mm, CTA Vyzkoušet hru — částky PLACEHOLDER v `main.js`, `POOL`). Za panáčky slabý graf ze hry (`js/herochart.js`).
1. **Odměny** (`#odmeny`, panel, který vyjede přes hero) — symboly coin → play → srdíčko → odměny → 3 odměny (`market: true`) + sloupec v mlze, kde poskakují `teasers` → nadpis „Hraj chytře. Sbírej srdíčka. Vyber si odměnu.“ + text vlevo, Coins (`#coins`) vpravo.
3. **Ranky** (`#play`) — „Každý rank, jiná hra.“ vlevo, vpravo karta Ranks se řádkem pro každý rank F → G.O.A.T. (bez čísel vstupu/výhry).
4. **Žebříček · Academy · Herní statistiky · Arény** (`#contesty`: `#rank`, `#academy`, `#statistika`) — čtyři karty; ukázky jsou v UI hry (žebříček jako obrazovka Ranks, se srdíčky).
4b. **O Clash of Candles** (`#o-nas`) — „Clash of Candles je soutěžní hra…“
5. **FAQ** (`#faq`) — 7 otázek z copy decku, jeden sloupec.
6. **Závěrečné CTA = registrace** (`#registrace`) — „Myslíš, že umíš číst graf?“, tlačítko Jdu hrát.
7. **Patička** (nízká) — vlevo logo, slogan, odkazy; vpravo právní text; „Pravidla hry“ a „Ochrana osobních údajů“ zatím bez URL (doplnit).

Rytmus mezer: `--sec` mezi sekcemi (160 px desktop / 96 px mobil), `--in` uvnitř sekce (56/40), `--head` pod nadpisem (32/24) — v `styles.css` (v17). Odstavce mají na desktopu max. 40 % šířky obsahu. Nic se nezarovnává na střed (kromě bloku FAQ) — texty i layout jsou zarovnané doleva (právní text v patičce doprava).

V copy decku se odměnám říká „mince“ — na webu jsou to **srdíčka** (coins = vstup do kola).

Ekonomika na webu: **coins** = palivo (vstup do kola), **srdíčka** = výhry, které se mění na slevu v shopu (`candleValue` Kč za srdíčko — název klíče zůstal). Odměny nejsou za umístění: srdíčka se utratí za cokoli, zbytek se doplatí.

## Před spuštěním doplnit / potvrdit

- [ ] **Endpoint formuláře.** `index.html` → `<form id="signup" data-endpoint="">`. Formulář posílá `POST` JSON `{ email, adult, source, ts }`. Dokud je prázdný, e-maily se nikam neodesílají (jen `console.warn` a localStorage v prohlížeči hráče).
- [ ] **Produkty v `rewards.json`** — skutečné produkty a ceny dle apple.com/cz (iPhone 18 Pro 34 990 Kč, AirPods Max 13 990 Kč, Apple Watch 10 990 Kč, AirPods Pro 3 6 490 Kč). **Fotky jsou zatím odkazované přímo z Apple CDN** — před spuštěním nahradit licencovanými fotkami shopu/partnera (přepsat `image`). Hodnota srdíčka (50 Kč) a max. sleva 80 % jsou placeholder; ceny v marketplace (♥ + Kč) se z nich počítají automaticky.
- [ ] **Ranky** jsou podle hry: F → E → D → C → B → A → S → G.O.A.T. (s +/++), získávají se hrou, začíná se na F. Rozhraní Ranks kopíruje obrazovku ze hry; sloupce Vstup (10–1 000 coins) a Výhra (1–100 srdíček) jsou placeholder. `assets/js/main.js`, pole `RANKS`.
- [ ] **Výherní banky arén** v hero banneru (500 / 1 000 / 1 500 srdíček) jsou placeholder — `main.js`, `POOL`.
- [ ] **Výhody registrace** (early access, startovní bonus, founder badge) — nechat jen potvrzené.
- [ ] **Mock data** — žebříček, statistiky a Academy kvíz jsou ilustrační (`main.js`, `index.html`).
- [ ] **Právní texty** — patička a FAQ tvrdí: není to investiční služba, coins nelze vyměnit za peníze, 18+. Nechat zkontrolovat právníkem (kupované coins + reálné produkty).
- [ ] Údaje o provozovateli, obchodní podmínky, GDPR — doplnit do patičky (odkazy „Pravidla hry“ a „Ochrana osobních údajů“ v patičce zatím nikam nevedou).
- [ ] `og:image` a další meta používají relativní cesty; po nasazení přepsat na absolutní URL domény.

## Licence třetích stran

- Archivo — SIL Open Font License (`assets/fonts/OFL.txt`)
- GSAP 3.12.5 — GreenSock Standard License (bezplatné použití)
