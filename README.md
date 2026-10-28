# The Ledger: Credit Card Optimizer

A small web app for deciding which credit card to use, and for keeping track of your wallet.

- **Best Card:** pick a spending category (groceries, dining, gas...) and see your cards ranked by reward rate. Ties are broken so cards you actively use come before sock-drawered ones, and you can drag cards to set your own order.
- **Rotating and pick-your-own categories:** supports quarterly 5% cards (Discover it, Chase Freedom/Flex) and cards where you choose the category, including stacking bonuses. You enter the categories yourself.
- **Cards:** card-art tiles with annual fee, foreign transaction fee, caps, and portal-only restrictions. Hide the cards you've put away.
- **Bonuses:** track signup bonus targets, progress and deadlines.
- **Fee vs. rewards:** compare what a card costs against what it earns on your spending.

Everything runs in your browser. Your cards and settings are saved in `localStorage` on your own device. There is no server, no account, and no tracking.

## Run it locally

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

To make a production build: `npm run build` (output goes to `dist/`).

## Deploy to GitHub Pages

1. Push this repo to GitHub with `main` as the default branch.
2. In the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every push to `main`. Your site appears at `https://<your-username>.github.io/<repo-name>/`.

## Getting started

The app opens with an empty wallet. Click **Add card**, optionally pick a common card from the list to fill in its network, annual fee, foreign transaction fee and flat base rate, then add the bonus categories yourself:

- Pick from the category chips or type your own (for example "Wholesale Clubs").
- Enter the bonus rate and, in the limit field, any cap, such as `$1,500/qtr, then 1%`. For rotating cards, note the quarter and that activation is required.
- Tick **Stacks with the card's fixed rate** when a rotating bonus adds to a rate the card already earns, and enter the combined total as the rate. Example: a card with 3% fixed dining plus a 5% rotating dining bonus earns 7% while activated.
- Cards you choose the category on (Citi Custom Cash, BofA Customized Cash, US Bank Cash+) work the same way: add the category you chose.

The built-in card list only includes base rates on purpose, since bonus categories change often. Edit `CARD_CATALOG` in `src/CardLedger.jsx` to add or change cards. Each entry is `{ name, network, annualFee, baseRate, ftf }`, where `ftf` is the foreign transaction fee percentage.

Your data lives in your browser's `localStorage` on your own device, so each person who opens the site starts with their own empty wallet.

## Keeping rates current

Rotating quarterly categories and every other bonus rate are entered by you, so they only stay correct if you update them. Card terms change often, so confirm against the issuer's own site before relying on a number. Rotating categories usually need to be activated, and they aren't applied retroactively.

## Disclaimer

This is an independent personal project. It is not affiliated with or endorsed by any bank, card issuer or card network. Card names and network names are used only to identify products. The card art is drawn from scratch in CSS and does not reproduce any issuer's logo or artwork. Nothing here is financial advice.

## Tech

React 18, Vite, and [lucide-react](https://lucide.dev) icons. Fonts (Fraunces, Inter, IBM Plex Mono) load from Google Fonts.

## License

MIT. See [LICENSE](LICENSE).
