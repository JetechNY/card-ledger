import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Trash2, X, CreditCard, Sparkles, TrendingUp, Calendar,
  ChevronRight, Check, AlertCircle, RotateCcw, Wallet, Archive, ArchiveRestore, ChevronDown, Settings
} from "lucide-react";
import { storage } from "./storage";

const STORAGE_KEY = "card-ledger:data";

const CATEGORY_PRESETS = [
  "Groceries", "Dining", "Gas", "Travel", "Streaming", "Entertainment",
  "Drugstore", "Online Shopping", "Amazon/Whole Foods", "Transit", "Home Improvement", "Utilities", "Gym"
];

const PALETTES = [
  { a: "#1B2A4A", b: "#3B5083", edge: "#C9A24B" }, // navy / brass
  { a: "#1F3A2E", b: "#3E6B52", edge: "#E7D9A8" }, // forest / gold
  { a: "#4A1E2E", b: "#7A3B52", edge: "#E2A8B8" }, // burgundy / rose
  { a: "#2C3540", b: "#4F5F70", edge: "#BFD4DE" }, // slate / ice
  { a: "#3A2540", b: "#5C3F66", edge: "#D8B8E2" }, // plum / lilac
  { a: "#2A2622", b: "#4F3C28", edge: "#D9A55C" }, // charcoal / copper
  { a: "#14232A", b: "#235058", edge: "#8FD6C9" }, // ink / teal
  { a: "#2E241C", b: "#4F3C28", edge: "#E2B368" }, // espresso / amber
];

// Cards with a recognizable real-world look get a palette that echoes it.
// Colors and finishes are modeled on each card's actual design language
// (Double Cash's hard blue/green split, Gold's brass, Platinum's brushed
// steel, Freedom Flex's iridescent gradient, Capital One's silver-and-red,
// etc.) without reproducing any issuer's logo or exact artwork. Anything
// unmatched falls back to the cycling palette.
function getCardVisual(name, index) {
  const n = (name || "").toLowerCase();
  if (n.includes("double cash")) {
    return { background: "linear-gradient(135deg, #1B4A78 0%, #1B4A78 50%, #2F9160 50%, #2F9160 100%)", edge: "#DCEFE3" };
  }
  if (n.includes("gold")) {
    // brushed brass — kept close in tone rather than a bright rainbow blend,
    // the tile's built-in sheen overlay supplies the shine
    return { background: "linear-gradient(135deg, #6E5220 0%, #A9833A 45%, #7C5E22 100%)", edge: "#F0D98C" };
  }
  if (n.includes("platinum")) {
    // smoky brushed steel
    return { background: "linear-gradient(135deg, #4B4E54 0%, #7C8188 45%, #5A5E64 100%)", edge: "#DEE2E6" };
  }
  if (n.includes("freedom flex")) {
    // Freedom Flex's iridescent, multi-hue design
    return { background: "linear-gradient(135deg, #1B2A6B 0%, #5B3FA0 45%, #B23E8C 75%, #E0577A 100%)", edge: "#FFD1E0" };
  }
  if (n.includes("citi")) {
    return { background: "linear-gradient(135deg, #00305C, #0064B1)", edge: "#8FD6FF" };
  }
  if (n.includes("discover")) {
    return { background: "linear-gradient(135deg, #B03D0E, #FF7A1A)", edge: "#2A1C10" };
  }
  if (n.includes("amazon")) {
    return { background: "linear-gradient(135deg, #16181A, #2B2F33)", edge: "#FF9900" };
  }
  if (n.includes("chase")) {
    return { background: "linear-gradient(135deg, #0A2A63, #10429E)", edge: "#9FC1FF" };
  }
  if (n.includes("capital one") || n.includes("quicksilver")) {
    // brushed silver body, Capital One red accent
    return { background: "linear-gradient(135deg, #3A3D42 0%, #6B6F76 50%, #45484D 100%)", edge: "#E04060" };
  }
  if (n.includes("amex")) {
    return { background: "linear-gradient(135deg, #00175A, #1F72B8)", edge: "#8FD6FF" };
  }
  if (n.includes("fidelity")) {
    return { background: "linear-gradient(135deg, #0B3D2A, #17945A)", edge: "#8FE0BD" };
  }
  if (n.includes("bofa") || n.includes("bank of america")) {
    return { background: "linear-gradient(135deg, #9E1B32, #012169)", edge: "#E6C9C9" };
  }
  if (n.includes("us bank")) {
    return { background: "linear-gradient(135deg, #0C2E6B, #1C64B0)", edge: "#9FC1FF" };
  }
  const pal = PALETTES[index % PALETTES.length];
  return { background: `linear-gradient(135deg, ${pal.a}, ${pal.b})`, edge: pal.edge };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyCard() {
  return {
    id: uid(),
    name: "",
    network: "Visa",
    annualFee: 0,
    baseRate: 1,
    ftf: 0, // foreign transaction fee %, 0 = none
    categories: [], // { name, rate, cap }
    bonus: { active: false, reward: "", target: 0, current: 0, deadline: "" },
    sockDrawered: false,
    eligibleCategories: [],
    floatingBonusRate: 0,
    floatingCap: "",
  };
}

// Common cards offered in the "Add card" picker. Only the card's own
// basics live here: network, annual fee, foreign transaction fee and the
// flat base rate that applies to everything else. Bonus categories (fixed,
// rotating, or pick-your-own) are deliberately left out: they change often,
// so you add them yourself and keep them current. Add or remove entries to
// suit; ftf is a percentage, 0 means no foreign transaction fee.
const CARD_CATALOG = [
  { name: "Citi Double Cash", network: "Mastercard", annualFee: 0, baseRate: 2, ftf: 3 },
  { name: "Citi Custom Cash", network: "Mastercard", annualFee: 0, baseRate: 1, ftf: 3 },
  { name: "Bank of America Customized Cash Rewards", network: "Visa", annualFee: 0, baseRate: 1, ftf: 3 },
  { name: "Discover it Cash Back", network: "Discover", annualFee: 0, baseRate: 1, ftf: 0 },
  { name: "Capital One Quicksilver", network: "Mastercard", annualFee: 0, baseRate: 1.5, ftf: 0 },
  { name: "Chase Freedom", network: "Visa", annualFee: 0, baseRate: 1, ftf: 3 },
  { name: "Chase Freedom Unlimited", network: "Visa", annualFee: 0, baseRate: 1.5, ftf: 3 },
  { name: "Chase Freedom Flex", network: "Mastercard", annualFee: 0, baseRate: 1, ftf: 3 },
  { name: "Amazon Prime Visa", network: "Visa", annualFee: 0, baseRate: 1, ftf: 0 },
  { name: "Chase Ink Business Cash", network: "Visa", annualFee: 0, baseRate: 1, ftf: 3 },
  { name: "Chase Ink Business Unlimited", network: "Visa", annualFee: 0, baseRate: 1.5, ftf: 3 },
  { name: "Amex Gold", network: "Amex", annualFee: 325, baseRate: 1, ftf: 0 },
  { name: "Amex Platinum", network: "Amex", annualFee: 895, baseRate: 1, ftf: 0 },
  { name: "Amex Blue Cash Everyday", network: "Amex", annualFee: 0, baseRate: 1, ftf: 2.7 },
  { name: "US Bank Cash+", network: "Visa", annualFee: 0, baseRate: 1, ftf: 3 },
  { name: "Fidelity Rewards Visa Signature", network: "Visa", annualFee: 0, baseRate: 2, ftf: 0 },
];

function fmtMoney(n) {
  if (!isFinite(n)) return "$0";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d - now) / 86400000);
  return diff;
}

export default function CardLedger() {
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [cards, setCards] = useState([]);
  const [spend, setSpend] = useState({}); // category -> monthly $
  const [hiddenCategories, setHiddenCategories] = useState([]);
  const [categoryOrder, setCategoryOrder] = useState({}); // category name -> [cardId, ...] manual order
  const [tab, setTab] = useState("cards");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pickCategory, setPickCategory] = useState(CATEGORY_PRESETS[0]);

  const persist = useCallback(async (nextCards, nextSpend, nextHidden, nextOrder) => {
    try {
      const result = await storage.set(
        STORAGE_KEY,
        JSON.stringify({ cards: nextCards, spend: nextSpend, hiddenCategories: nextHidden, categoryOrder: nextOrder }),
        false
      );
      setSaveError(!result);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (!cancelled && res && res.value) {
          const parsed = JSON.parse(res.value);
          setCards(parsed.cards || []);
          setSpend(parsed.spend || {});
          setHiddenCategories(parsed.hiddenCategories || []);
          setCategoryOrder(parsed.categoryOrder || {});
        }
      } catch (e) {
        // unreadable or missing saved data: start with an empty wallet
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateCards = (next) => {
    setCards(next);
    persist(next, spend, hiddenCategories, categoryOrder);
  };

  const reorderCards = (draggedId, targetId) => {
    if (draggedId === targetId) return;
    const next = [...cards];
    const fromIdx = next.findIndex((c) => c.id === draggedId);
    const toIdx = next.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateCards(next);
  };

  const updateSpend = (next) => {
    setSpend(next);
    persist(cards, next, hiddenCategories, categoryOrder);
  };

  const toggleCategoryHidden = (cat) => {
    const next = hiddenCategories.includes(cat)
      ? hiddenCategories.filter((c) => c !== cat)
      : [...hiddenCategories, cat];
    setHiddenCategories(next);
    persist(cards, spend, next, categoryOrder);
  };

  // Reorder the Best Card ranking for one category by dragging draggedId next to targetId.
  // Starts from the current on-screen order (currentIds) the first time a category is touched.
  const reorderCategory = (category, draggedId, targetId, currentIds) => {
    if (draggedId === targetId) return;
    const base = categoryOrder[category] && categoryOrder[category].length ? categoryOrder[category] : currentIds;
    const next = [...base];
    const fromIdx = next.indexOf(draggedId);
    const toIdx = next.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const nextOrder = { ...categoryOrder, [category]: next };
    setCategoryOrder(nextOrder);
    persist(cards, spend, hiddenCategories, nextOrder);
  };

  const resetCategoryOrder = (category) => {
    const nextOrder = { ...categoryOrder };
    delete nextOrder[category];
    setCategoryOrder(nextOrder);
    persist(cards, spend, hiddenCategories, nextOrder);
  };

  const startAdd = () => {
    setDraft(emptyCard());
    setEditingId("new");
  };

  const startEdit = (card) => {
    setDraft(JSON.parse(JSON.stringify(card)));
    setEditingId(card.id);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditingId(null);
  };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const clean = { ...draft, name: draft.name.trim() };
    let next;
    if (editingId === "new") {
      next = [...cards, clean];
    } else {
      next = cards.map((c) => (c.id === clean.id ? clean : c));
    }
    updateCards(next);
    cancelEdit();
  };

  const removeCard = (id) => {
    updateCards(cards.filter((c) => c.id !== id));
    if (editingId === id) cancelEdit();
  };

  const toggleSockDrawer = (id) => {
    updateCards(cards.map((c) => (c.id === id ? { ...c, sockDrawered: !c.sockDrawered } : c)));
  };

  const setFloatingCategory = (id, categoryName) => {
    updateCards(cards.map((c) => {
      if (c.id !== id) return c;
      return {
        ...c,
        categories: [{ name: categoryName, rate: c.floatingBonusRate || c.baseRate, cap: c.categories[0]?.cap || "" }],
      };
    }));
  };

  const toggleDraftCategory = (name) => {
    const exists = draft.categories.find((c) => c.name === name);
    if (exists) {
      setDraft({ ...draft, categories: draft.categories.filter((c) => c.name !== name) });
    } else {
      setDraft({ ...draft, categories: [...draft.categories, { name, rate: 2, cap: "" }] });
    }
  };

  const setDraftCategoryRate = (name, rate) => {
    setDraft({
      ...draft,
      categories: draft.categories.map((c) => (c.name === name ? { ...c, rate: parseFloat(rate) || 0 } : c)),
    });
  };

  const setDraftCategoryCap = (name, cap) => {
    setDraft({
      ...draft,
      categories: draft.categories.map((c) => (c.name === name ? { ...c, cap } : c)),
    });
  };

  const activeCards = useMemo(() => cards.filter((c) => !c.sockDrawered), [cards]);

  const rankedForCategory = useMemo(() => {
    const auto = [...cards]
      .map((c) => {
        const match = c.categories.find((cat) => cat.name === pickCategory);
        const eligibleNotSet =
          !match &&
          c.categories.length === 0 &&
          c.eligibleCategories &&
          c.eligibleCategories.includes(pickCategory);
        return {
          card: c,
          rate: match ? match.rate : c.baseRate,
          matched: !!match,
          cap: match ? match.cap : "",
          stacks: match ? !!match.stacks : false,
          eligibleNotSet,
        };
      })
      .sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        // same rate — active (not sock-drawered) cards float above drawered ones
        return (a.card.sockDrawered ? 1 : 0) - (b.card.sockDrawered ? 1 : 0);
      });

    const order = categoryOrder[pickCategory];
    if (!order || !order.length) return auto;

    const byId = new Map(auto.map((r) => [r.card.id, r]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean);
    const leftover = auto.filter((r) => !order.includes(r.card.id));
    return [...ordered, ...leftover];
  }, [cards, pickCategory, categoryOrder]);

  const valueByCard = useMemo(() => {
    const cats = Array.from(new Set([...CATEGORY_PRESETS, ...activeCards.flatMap((c) => c.categories.map((x) => x.name))]));
    return activeCards
      .map((c) => {
        let annualReward = 0;
        cats.forEach((cat) => {
          const monthly = spend[cat] || 0;
          const match = c.categories.find((x) => x.name === cat);
          const rate = match ? match.rate : c.baseRate;
          annualReward += monthly * 12 * (rate / 100);
        });
        return { card: c, annualReward, net: annualReward - (c.annualFee || 0) };
      })
      .sort((a, b) => b.net - a.net);
  }, [activeCards, spend]);

  const totalMonthlySpend = useMemo(
    () => Object.values(spend).reduce((s, v) => s + (v || 0), 0),
    [spend]
  );

  if (loading) {
    return (
      <div style={{ ...styles.root, alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>
        <div style={{ color: TOK.textDim, fontFamily: TOK.mono }}>loading ledger…</div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>{FONT_IMPORT}</style>
      <Header
        cardCount={cards.length}
        onAdd={startAdd}
        onReset={() => { updateCards([]); }}
      />

      <Tabs tab={tab} setTab={setTab} />

      {saveError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={14} />
          <span>Couldn't save changes — they may not persist. Try again in a moment.</span>
        </div>
      )}

      {tab === "cards" && (
        <CardsView
          cards={cards}
          onEdit={startEdit}
          onRemove={removeCard}
          onAdd={startAdd}
          onToggleSockDrawer={toggleSockDrawer}
          onReorder={reorderCards}
        />
      )}

      {tab === "best" && (
        <BestCardView
          cards={cards}
          pickCategory={pickCategory}
          setPickCategory={setPickCategory}
          ranked={rankedForCategory}
          hiddenCategories={hiddenCategories}
          onHideCategory={toggleCategoryHidden}
          onShowCategory={toggleCategoryHidden}
          onSetFloatingCategory={setFloatingCategory}
          onReorderCategory={reorderCategory}
          onResetCategoryOrder={resetCategoryOrder}
          hasCustomOrder={!!(categoryOrder[pickCategory] && categoryOrder[pickCategory].length)}
        />
      )}

      {tab === "bonuses" && <BonusesView cards={cards} />}

      {tab === "value" && (
        <ValueView
          spend={spend}
          setSpend={updateSpend}
          valueByCard={valueByCard}
          totalMonthlySpend={totalMonthlySpend}
          hiddenCategories={hiddenCategories}
        />
      )}

      {editingId && draft && (
        <CardEditor
          draft={draft}
          setDraft={setDraft}
          isNew={editingId === "new"}
          onSave={saveDraft}
          onCancel={cancelEdit}
          onToggleCategory={toggleDraftCategory}
          onSetCategoryRate={setDraftCategoryRate}
          onSetCategoryCap={setDraftCategoryCap}
        />
      )}
    </div>
  );
}

/* ---------- design tokens ---------- */

const TOK = {
  bg: "#12201C",
  surface: "#182821",
  surfaceRaised: "#1E332A",
  line: "#2B4238",
  text: "#EFE9DA",
  textDim: "#A9B8AE",
  brass: "#C9A24B",
  brassDim: "#8C7638",
  coral: "#E2725B",
  mint: "#6FBF8B",
  display: "'Fraunces', serif",
  mono: "'IBM Plex Mono', monospace",
  body: "'Inter', sans-serif",
};

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

const styles = {
  root: {
    fontFamily: TOK.body,
    background: TOK.bg,
    color: TOK.text,
    borderRadius: 14,
    padding: "22px 20px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    width: "100%",
    minHeight: "100vh",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(226,114,91,0.12)",
    border: `1px solid ${TOK.coral}`,
    color: TOK.coral,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
  },
};

/* ---------- header + tabs ---------- */

function Header({ cardCount, onAdd, onReset }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <div style={{ fontFamily: TOK.mono, fontSize: 11, letterSpacing: 2, color: TOK.brass, textTransform: "uppercase", marginBottom: 4 }}>
          The Ledger
        </div>
        <div style={{ fontFamily: TOK.display, fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>
          Card Optimizer
        </div>
        <div style={{ color: TOK.textDim, fontSize: 13, marginTop: 4 }}>
          {cardCount} {cardCount === 1 ? "card" : "cards"} on file
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ ...btn.ghost, padding: "0 10px", width: 36 }}
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={14} />
          </button>
          {menuOpen && (
            <>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
              />
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
                background: TOK.surfaceRaised, border: `1px solid ${TOK.line}`, borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 180, overflow: "hidden",
              }}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm("Remove all cards? This can't be undone.")) onReset();
                  }}
                  disabled={cardCount === 0}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    background: "none", border: "none", padding: "10px 14px",
                    fontSize: 13, color: cardCount === 0 ? TOK.textDim : TOK.coral,
                    cursor: cardCount === 0 ? "default" : "pointer", textAlign: "left",
                  }}
                >
                  <RotateCcw size={14} /> Clear all cards
                </button>
              </div>
            </>
          )}
        </div>

        <button onClick={onAdd} style={btn.primary}>
          <Plus size={14} /> Add card
        </button>
      </div>
    </div>
  );
}

function Tabs({ tab, setTab }) {
  const items = [
    { id: "cards", label: "Cards", icon: CreditCard },
    { id: "best", label: "Best Card", icon: Sparkles },
    { id: "bonuses", label: "Bonuses", icon: TrendingUp },
    { id: "value", label: "Fee vs. Reward", icon: Wallet },
  ];
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${TOK.line}`, paddingBottom: 2 }}>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px 12px",
            fontSize: 13,
            fontFamily: TOK.body,
            color: tab === id ? TOK.brass : TOK.textDim,
            borderBottom: tab === id ? `2px solid ${TOK.brass}` : "2px solid transparent",
            marginBottom: -2,
            transition: "color 0.15s",
          }}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

function NetworkMark({ network }) {
  const n = (network || "").toLowerCase();
  if (n === "visa") {
    return (
      <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 18, color: "#fff", letterSpacing: 0.5 }}>
        VISA
      </span>
    );
  }
  if (n === "mastercard") {
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#EB5C2E", opacity: 0.9 }} />
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F2A900", opacity: 0.85, marginLeft: -8 }} />
      </div>
    );
  }
  if (n === "amex") {
    return (
      <div style={{
        background: "#fff", color: "#1F72B8", fontFamily: TOK.mono, fontWeight: 700, fontSize: 10,
        padding: "3px 6px", borderRadius: 3, letterSpacing: 0.5,
      }}>
        AMEX
      </div>
    );
  }
  if (n === "discover") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: TOK.display, fontWeight: 600, fontSize: 13, color: "#fff" }}>Discover</span>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6600" }} />
      </div>
    );
  }
  return (
    <span style={{ fontFamily: TOK.mono, fontSize: 11, color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>
      {network}
    </span>
  );
}

/* ---------- cards view ---------- */

function CardTile({
  card, index, onEdit, onRemove, onToggleSockDrawer,
  draggable, isDragging, isDropTarget, onDragStart, onDragEnd, onDragEnterTile, onDropTile,
}) {
  const visual = getCardVisual(card.name, index);
  const last4 = card.id.replace(/[^0-9]/g, "").padStart(4, "0").slice(-4) || "0000";
  const topCategory = card.categories.length
    ? [...card.categories].sort((a, b) => b.rate - a.rate)[0]
    : null;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart && onDragStart(); }}
      onDragEnd={() => onDragEnd && onDragEnd()}
      onDragOver={(e) => { if (draggable) e.preventDefault(); }}
      onDragEnter={(e) => { if (draggable) { e.preventDefault(); onDragEnterTile && onDragEnterTile(); } }}
      onDrop={(e) => { if (draggable) { e.preventDefault(); onDropTile && onDropTile(); } }}
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        aspectRatio: "1.586 / 1",
        borderRadius: 14,
        padding: 16,
        background: visual.background,
        border: isDropTarget ? `2px dashed ${TOK.brass}` : `1px solid ${visual.edge}44`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        cursor: draggable ? "grab" : "pointer",
        boxSizing: "border-box",
        overflow: "hidden",
        opacity: isDragging ? 0.35 : card.sockDrawered ? 0.55 : 1,
        filter: card.sockDrawered ? "grayscale(0.4)" : "none",
        transition: "opacity 0.15s, filter 0.15s",
      }}
      onClick={() => onEdit(card)}
    >
      {/* diagonal sheen for a bit of card-stock realism */}
      <div style={{
        position: "absolute", top: 0, left: "-20%", width: "60%", height: "100%",
        background: "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%)",
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        {card.sockDrawered ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSockDrawer(card.id); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(0,0,0,0.35)", border: "none", borderRadius: 7, padding: "5px 9px",
              color: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 11, fontFamily: TOK.body,
            }}
            aria-label="Move back to active cards"
          >
            <ArchiveRestore size={13} /> Restore
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSockDrawer(card.id); }}
            style={{
              background: "rgba(0,0,0,0.25)", border: "none", borderRadius: 6, padding: 6,
              color: "rgba(255,255,255,0.85)", cursor: "pointer", display: "flex",
            }}
            aria-label="Sock-drawer this card"
            title="Sock-drawer this card"
          >
            <Archive size={13} />
          </button>
        )}
        <NetworkMark network={card.network} />
      </div>

      <div style={{
        fontFamily: TOK.mono, fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,0.55)",
        position: "relative", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        •••• •••• •••• {last4}
      </div>

      {!topCategory && card.eligibleCategories && card.eligibleCategories.length > 0 && (
        <div
          title={`Eligible categories: ${card.eligibleCategories.join(", ")}. ${card.floatingCap || "Whichever tops your spend each cycle earns the bonus rate automatically."}`}
          style={{
            fontFamily: TOK.mono, fontSize: 10.5, color: "rgba(255,255,255,0.85)",
            background: "rgba(0,0,0,0.3)", borderRadius: 5, padding: "3px 7px",
            display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start",
            position: "relative", whiteSpace: "nowrap", maxWidth: "100%",
            overflow: "hidden", textOverflow: "ellipsis", cursor: "help",
          }}
        >
          {card.baseRate}%/{card.floatingBonusRate}% · auto top category{card.floatingCap ? ` · ${card.floatingCap.split(",")[0]}` : ""}
        </div>
      )}

      {topCategory && (
        <div
          title={topCategory.cap || undefined}
          style={{
            fontFamily: TOK.mono, fontSize: 10.5, color: "rgba(255,255,255,0.9)",
            background: "rgba(0,0,0,0.3)", borderRadius: 5, padding: "3px 7px",
            display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start",
            position: "relative", whiteSpace: "nowrap", maxWidth: "100%",
            overflow: "hidden", textOverflow: "ellipsis", cursor: "help",
          }}
        >
          {topCategory.rate}% {topCategory.name}
          <span style={{ opacity: 0.6 }}>· {card.baseRate}% base</span>
          {topCategory.cap && (
            <span style={{ opacity: 0.7, textDecoration: "underline dotted" }}>
              · {/portal/i.test(topCategory.cap) ? "portal only" : "capped"}
            </span>
          )}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <div style={{
          fontFamily: TOK.display, fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 2,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.2,
        }}>
          {card.name || "Untitled card"}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: TOK.mono, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
            {card.annualFee > 0 ? `${fmtMoney(card.annualFee)}/yr fee` : "No annual fee"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete ${card.name || "this card"}? This can't be undone.`)) onRemove(card.id);
            }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 2 }}
            aria-label="Remove card"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CardGrid({ cards, onEdit, onRemove, onToggleSockDrawer, onReorder }) {
  const [draggedId, setDraggedId] = useState(null);
  const [overId, setOverId] = useState(null);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      gap: 14,
    }}>
      {cards.map((c, i) => (
        <CardTile
          key={c.id}
          card={c}
          index={i}
          onEdit={onEdit}
          onRemove={onRemove}
          onToggleSockDrawer={onToggleSockDrawer}
          draggable={!!onReorder}
          isDragging={draggedId === c.id}
          isDropTarget={overId === c.id && draggedId !== c.id}
          onDragStart={() => setDraggedId(c.id)}
          onDragEnd={() => { setDraggedId(null); setOverId(null); }}
          onDragEnterTile={() => setOverId(c.id)}
          onDropTile={() => {
            if (draggedId && onReorder) onReorder(draggedId, c.id);
            setDraggedId(null);
            setOverId(null);
          }}
        />
      ))}
    </div>
  );
}

function CardsView({ cards, onEdit, onRemove, onAdd, onToggleSockDrawer, onReorder }) {
  const [showDrawer, setShowDrawer] = useState(false);

  if (cards.length === 0) {
    return (
      <EmptyState
        title="No cards yet"
        body="Add your first card to start building out categories, fees, and signup bonuses."
        actionLabel="Add a card"
        onAction={onAdd}
      />
    );
  }

  const active = cards.filter((c) => !c.sockDrawered);
  const drawered = cards.filter((c) => c.sockDrawered);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {active.length > 0 ? (
        <>
          <div style={{ fontSize: 11, color: TOK.textDim }}>Drag a card to reorder your wallet.</div>
          <CardGrid cards={active} onEdit={onEdit} onRemove={onRemove} onToggleSockDrawer={onToggleSockDrawer} onReorder={onReorder} />
        </>
      ) : (
        <div style={{ fontSize: 13, color: TOK.textDim }}>
          Every card is sock-drawered. Pull one back with the archive icon on its tile.
        </div>
      )}

      {drawered.length > 0 && (
        <div>
          <button
            onClick={() => setShowDrawer((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              color: TOK.textDim, fontSize: 12, cursor: "pointer", padding: "6px 0",
              borderTop: `1px solid ${TOK.line}`, width: "100%",
            }}
          >
            <ChevronDown size={13} style={{ transform: showDrawer ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            Sock drawer — {drawered.length} {drawered.length === 1 ? "card" : "cards"} tucked away
          </button>
          {showDrawer && (
            <div style={{ marginTop: 12 }}>
              <CardGrid cards={drawered} onEdit={onEdit} onRemove={onRemove} onToggleSockDrawer={onToggleSockDrawer} onReorder={onReorder} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- best card view ---------- */

function BestCardView({
  cards, pickCategory, setPickCategory, ranked, hiddenCategories, onHideCategory, onShowCategory,
  onSetFloatingCategory, onReorderCategory, onResetCategoryOrder, hasCustomOrder,
}) {
  const [draggedId, setDraggedId] = useState(null);
  const [overId, setOverId] = useState(null);

  if (cards.length === 0) {
    return <EmptyState title="No cards to rank" body="Add cards first, then pick a category to see your best option." />;
  }
  const allCats = Array.from(new Set([...CATEGORY_PRESETS, ...cards.flatMap((c) => c.categories.map((x) => x.name))]))
    .filter((cat) => !hiddenCategories.includes(cat));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={sectionLabel}>Spending on…</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {allCats.map((cat) => (
            <div key={cat} style={{ position: "relative" }}>
              <button
                onClick={() => setPickCategory(cat)}
                style={{
                  ...chip,
                  paddingRight: 22,
                  background: pickCategory === cat ? TOK.brass : "transparent",
                  color: pickCategory === cat ? TOK.bg : TOK.text,
                  borderColor: pickCategory === cat ? TOK.brass : TOK.line,
                  fontWeight: pickCategory === cat ? 600 : 400,
                }}
              >
                {cat}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onHideCategory(cat); }}
                title={`Hide ${cat}`}
                aria-label={`Hide ${cat}`}
                style={{
                  position: "absolute", top: "50%", right: 6, transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: pickCategory === cat ? TOK.bg : TOK.textDim, opacity: 0.65, fontSize: 13, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {hiddenCategories.length > 0 && (
          <div style={{ fontSize: 11, color: TOK.textDim, marginTop: 8 }}>
            Hidden:{" "}
            {hiddenCategories.map((cat, i) => (
              <span key={cat}>
                <button
                  onClick={() => onShowCategory(cat)}
                  style={{
                    background: "none", border: "none", color: TOK.brassDim, cursor: "pointer",
                    fontSize: 11, padding: 0, textDecoration: "underline dotted",
                  }}
                  title={`Show ${cat} again`}
                >
                  {cat}
                </button>
                {i < hiddenCategories.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: TOK.textDim }}>Drag a card to reorder this list.</div>
        {hasCustomOrder && (
          <button
            onClick={() => onResetCategoryOrder(pickCategory)}
            style={{
              display: "flex", alignItems: "center", gap: 4, background: "none",
              border: "none", color: TOK.brassDim, cursor: "pointer", fontSize: 11.5,
              textDecoration: "underline dotted", padding: 0,
            }}
            title="Reset to automatic best-rate order"
          >
            <RotateCcw size={11} /> Reset order
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(() => {
          const topActiveIdx = ranked.findIndex(({ card }) => !card.sockDrawered);
          const currentIds = ranked.map((r) => r.card.id);
          return ranked.map(({ card, rate, matched, cap, eligibleNotSet, stacks }, i) => {
            const isTop = i === topActiveIdx;
            const drawered = card.sockDrawered;
            return (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggedId(card.id); }}
                onDragEnd={() => { setDraggedId(null); setOverId(null); }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => { e.preventDefault(); setOverId(card.id); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedId) onReorderCategory(pickCategory, draggedId, card.id, currentIds);
                  setDraggedId(null);
                  setOverId(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 10,
                  cursor: "grab",
                  opacity: draggedId === card.id ? 0.35 : (!matched && !eligibleNotSet) ? 0.45 : 1,
                  background: isTop ? "rgba(201,162,75,0.12)" : eligibleNotSet ? "rgba(201,162,75,0.06)" : TOK.surface,
                  border: overId === card.id && draggedId && draggedId !== card.id
                    ? `2px dashed ${TOK.brass}`
                    : isTop
                    ? `1px solid ${TOK.brass}`
                    : eligibleNotSet
                    ? `1px dashed ${TOK.brassDim}`
                    : `1px solid ${TOK.line}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                  {isTop ? <Sparkles size={15} color={TOK.brass} style={{ marginTop: 2, flexShrink: 0 }} /> : <div style={{ width: 15, flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{card.name}</span>
                      <span style={{ fontFamily: TOK.mono, fontSize: 10.5, color: TOK.textDim, textTransform: "uppercase" }}>
                        {card.network}
                      </span>
                      {card.annualFee > 0 && (
                        <span style={{ fontFamily: TOK.mono, fontSize: 10.5, color: TOK.textDim }}>
                          {fmtMoney(card.annualFee)}/yr
                        </span>
                      )}
                      <span style={{ fontFamily: TOK.mono, fontSize: 10.5, color: TOK.textDim }}>
                        {card.ftf > 0 ? `${card.ftf}% FTF` : "No FTF"}
                      </span>
                      {drawered && (
                        <span style={{ fontFamily: TOK.mono, fontSize: 10.5, color: TOK.brassDim }}>
                          · sock-drawered
                        </span>
                      )}
                    </div>

                    {eligibleNotSet ? (
                      <div style={{ fontSize: 12, color: TOK.brassDim, marginTop: 3 }}>
                        Eligible for {pickCategory} at {card.floatingBonusRate}% — not set as its active category right now
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: TOK.textDim, marginTop: 3 }}>
                        {matched
                          ? `${rate}% ${pickCategory} bonus${stacks ? " (stacked — a fixed rate + an activated bonus combined)" : ""} — ${card.baseRate}% base rate on everything else`
                          : `${card.baseRate}% base rate — no ${pickCategory} bonus on this card`}
                      </div>
                    )}

                    {matched && cap && (
                      <div style={{ fontSize: 11, color: TOK.brassDim, marginTop: 4, lineHeight: 1.4 }}>{cap}</div>
                    )}

                    {eligibleNotSet && (
                      <button
                        onClick={() => onSetFloatingCategory(card.id, pickCategory)}
                        style={{
                          marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5,
                          background: TOK.brass, color: TOK.bg, border: "none", borderRadius: 6,
                          padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <Sparkles size={12} /> Set {pickCategory} as this card's category
                      </button>
                    )}
              </div>
            </div>
            <div style={{ fontFamily: TOK.mono, fontSize: 18, color: isTop ? TOK.brass : eligibleNotSet ? TOK.brassDim : TOK.text, flexShrink: 0 }}>
              {eligibleNotSet ? card.floatingBonusRate : rate}%
            </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

/* ---------- bonuses view ---------- */

function BonusesView({ cards }) {
  const active = cards.filter((c) => c.bonus && c.bonus.active);
  if (active.length === 0) {
    return (
      <EmptyState
        title="No signup bonuses tracked"
        body="Edit a card and mark its signup bonus active to track progress toward the spend target here."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {active.map((c) => {
        const pct = Math.min(100, c.bonus.target > 0 ? (c.bonus.current / c.bonus.target) * 100 : 0);
        const dl = daysLeft(c.bonus.deadline);
        const met = c.bonus.current >= c.bonus.target && c.bonus.target > 0;
        return (
          <div key={c.id} style={{ background: TOK.surface, border: `1px solid ${TOK.line}`, borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: TOK.textDim }}>{c.bonus.reward || "Signup bonus"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: TOK.mono, fontSize: 13, color: met ? TOK.mint : TOK.text }}>
                  {fmtMoney(c.bonus.current)} / {fmtMoney(c.bonus.target)}
                </div>
                {dl !== null && (
                  <div style={{ fontSize: 11, color: dl < 14 && !met ? TOK.coral : TOK.textDim, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                    <Calendar size={11} />
                    {dl >= 0 ? `${dl} days left` : "past deadline"}
                  </div>
                )}
              </div>
            </div>
            <div style={{ height: 8, background: TOK.line, borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: met ? TOK.mint : TOK.brass,
                  transition: "width 0.3s",
                }}
              />
            </div>
            {met && (
              <div style={{ marginTop: 6, fontSize: 12, color: TOK.mint, display: "flex", alignItems: "center", gap: 4 }}>
                <Check size={12} /> Target met
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- value view ---------- */

function ValueView({ spend, setSpend, valueByCard, totalMonthlySpend, hiddenCategories }) {
  const visibleCats = CATEGORY_PRESETS.filter((cat) => !hiddenCategories.includes(cat));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={sectionLabel}>Typical monthly spend by category</div>
        <div style={{ fontSize: 12, color: TOK.textDim, marginBottom: 10 }}>
          Used to estimate annual rewards value per card.{hiddenCategories.length > 0 ? " Categories hidden on the Best Card tab are skipped here too." : ""}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {visibleCats.map((cat) => (
            <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: TOK.textDim }}>{cat}</label>
              <div style={{ display: "flex", alignItems: "center", background: TOK.surface, border: `1px solid ${TOK.line}`, borderRadius: 6, padding: "4px 8px" }}>
                <span style={{ fontFamily: TOK.mono, fontSize: 12, color: TOK.textDim, marginRight: 4 }}>$</span>
                <input
                  type="number"
                  min={0}
                  value={spend[cat] || ""}
                  placeholder="0"
                  onChange={(e) => setSpend({ ...spend, [cat]: parseFloat(e.target.value) || 0 })}
                  style={{ background: "transparent", border: "none", color: TOK.text, fontFamily: TOK.mono, fontSize: 13, width: "100%", outline: "none" }}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: TOK.textDim, marginTop: 8 }}>
          Total: <span style={{ fontFamily: TOK.mono, color: TOK.text }}>{fmtMoney(totalMonthlySpend)}</span> / month
        </div>
      </div>

      {valueByCard.length > 0 && (
        <div>
          <div style={sectionLabel}>Annual value, ranked</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {valueByCard.map(({ card, annualReward, net }, i) => (
              <div
                key={card.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: i === 0 ? "rgba(111,191,139,0.10)" : TOK.surface,
                  border: i === 0 ? `1px solid ${TOK.mint}` : `1px solid ${TOK.line}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{card.name}</div>
                  <div style={{ fontSize: 12, color: TOK.textDim }}>
                    {fmtMoney(annualReward)} earned − {fmtMoney(card.annualFee || 0)} fee
                  </div>
                </div>
                <div style={{ fontFamily: TOK.mono, fontSize: 18, color: net >= 0 ? TOK.mint : TOK.coral }}>
                  {net >= 0 ? "+" : ""}{fmtMoney(net)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- editor ---------- */

function CardEditor({ draft, setDraft, isNew, onSave, onCancel, onToggleCategory, onSetCategoryRate, onSetCategoryCap }) {
  const [customCat, setCustomCat] = useState("");

  const pickFromCatalog = (name) => {
    const found = CARD_CATALOG.find((c) => c.name === name);
    if (!found) return;
    setDraft({ ...draft, name: found.name, network: found.network, annualFee: found.annualFee, baseRate: found.baseRate, ftf: found.ftf });
  };

  const addCustomCategory = () => {
    const name = customCat.trim();
    if (!name || draft.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    setDraft({ ...draft, categories: [...draft.categories, { name, rate: 5, cap: "", stacks: false }] });
    setCustomCat("");
  };

  const setStacks = (name, stacks) => {
    setDraft({ ...draft, categories: draft.categories.map((c) => (c.name === name ? { ...c, stacks } : c)) });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
    }}>
      <div style={{
        background: TOK.surfaceRaised, border: `1px solid ${TOK.line}`, borderRadius: 14,
        padding: 24, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: TOK.display, fontSize: 20, fontWeight: 600 }}>
            {isNew ? "Add card" : "Edit card"}
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: TOK.textDim, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {isNew && (
          <Field label="Start from a common card (optional)">
            <select value="" onChange={(e) => pickFromCatalog(e.target.value)} style={input}>
              <option value="">Choose a card to fill in its fees and base rate…</option>
              {CARD_CATALOG.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="Card name">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Chase Sapphire Preferred"
            style={input}
            autoFocus
          />
        </Field>

        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Network" style={{ flex: 1 }}>
            <select value={draft.network} onChange={(e) => setDraft({ ...draft, network: e.target.value })} style={input}>
              {["Visa", "Mastercard", "Amex", "Discover", "Other"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Base rate — everything else (%)" style={{ flex: 1 }}>
            <input
              type="number" min={0} step={0.5} value={draft.baseRate}
              onChange={(e) => setDraft({ ...draft, baseRate: parseFloat(e.target.value) || 0 })}
              style={input}
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Annual fee ($)" style={{ flex: 1 }}>
            <input
              type="number" min={0} value={draft.annualFee}
              onChange={(e) => setDraft({ ...draft, annualFee: parseFloat(e.target.value) || 0 })}
              style={input}
            />
          </Field>
          <Field label="Foreign transaction fee (%)" style={{ flex: 1 }}>
            <input
              type="number" min={0} step={0.1} value={draft.ftf}
              onChange={(e) => setDraft({ ...draft, ftf: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              style={input}
            />
          </Field>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer", color: TOK.textDim }}>
          <input
            type="checkbox"
            checked={!!draft.sockDrawered}
            onChange={(e) => setDraft({ ...draft, sockDrawered: e.target.checked })}
          />
          Sock-drawered — hide from Best Card &amp; Fee vs. Reward
        </label>

        <Field label="Bonus categories">
          <div style={{ fontSize: 12, color: TOK.textDim, marginBottom: 8, lineHeight: 1.4 }}>
            Add each bonus category with its rate. For rotating categories, note the quarter and that
            activation is needed in the limit field, and update them each quarter.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {CATEGORY_PRESETS.map((cat) => {
              const active = draft.categories.find((c) => c.name === cat);
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  style={{
                    ...chip,
                    background: active ? TOK.brass : "transparent",
                    color: active ? TOK.bg : TOK.text,
                    borderColor: active ? TOK.brass : TOK.line,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCategory(); } }}
              placeholder="Other category, e.g. Wholesale Clubs"
              style={{ ...input, fontSize: 13, padding: "7px 10px" }}
            />
            <button onClick={addCustomCategory} style={{ ...btn.ghost, height: 34, padding: "0 12px", flexShrink: 0 }}>
              Add
            </button>
          </div>
          {draft.categories.map((c) => (
            <div key={c.name} style={{ padding: "8px 0", borderBottom: `1px solid ${TOK.line}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number" min={0} step={0.5} value={c.rate}
                    onChange={(e) => onSetCategoryRate(c.name, e.target.value)}
                    style={{ ...input, width: 64, padding: "4px 8px" }}
                  />
                  <span style={{ fontSize: 12, color: TOK.textDim }}>%</span>
                </div>
              </div>
              <input
                value={c.cap}
                onChange={(e) => onSetCategoryCap(c.name, e.target.value)}
                placeholder="Limit — e.g. $1,500/qtr, then 1%"
                style={{ ...input, marginTop: 6, fontSize: 12, padding: "6px 10px" }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: TOK.textDim, marginTop: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!c.stacks}
                  onChange={(e) => setStacks(c.name, e.target.checked)}
                />
                Stacks with the card's fixed rate (enter the combined total above)
              </label>
            </div>
          ))}
        </Field>

        <div style={{ borderTop: `1px solid ${TOK.line}`, paddingTop: 14, marginTop: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: draft.bonus.active ? 10 : 0, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={draft.bonus.active}
              onChange={(e) => setDraft({ ...draft, bonus: { ...draft.bonus, active: e.target.checked } })}
            />
            Track a signup bonus for this card
          </label>

          {draft.bonus.active && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Reward description">
                <input
                  value={draft.bonus.reward}
                  onChange={(e) => setDraft({ ...draft, bonus: { ...draft.bonus, reward: e.target.value } })}
                  placeholder="e.g. 80,000 points"
                  style={input}
                />
              </Field>
              <div style={{ display: "flex", gap: 10 }}>
                <Field label="Spend target ($)" style={{ flex: 1 }}>
                  <input
                    type="number" min={0} value={draft.bonus.target}
                    onChange={(e) => setDraft({ ...draft, bonus: { ...draft.bonus, target: parseFloat(e.target.value) || 0 } })}
                    style={input}
                  />
                </Field>
                <Field label="Spent so far ($)" style={{ flex: 1 }}>
                  <input
                    type="number" min={0} value={draft.bonus.current}
                    onChange={(e) => setDraft({ ...draft, bonus: { ...draft.bonus, current: parseFloat(e.target.value) || 0 } })}
                    style={input}
                  />
                </Field>
              </div>
              <Field label="Deadline">
                <input
                  type="date" value={draft.bonus.deadline}
                  onChange={(e) => setDraft({ ...draft, bonus: { ...draft.bonus, deadline: e.target.value } })}
                  style={input}
                />
              </Field>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onSave} style={{ ...btn.primary, flex: 1, justifyContent: "center" }}>
            <Check size={15} /> Save card
          </button>
          <button onClick={onCancel} style={{ ...btn.ghost, flex: 1, justifyContent: "center" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: "block", fontSize: 11, color: TOK.textDim, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <div style={{
      border: `1px dashed ${TOK.line}`, borderRadius: 12, padding: "40px 24px",
      textAlign: "center", color: TOK.textDim,
    }}>
      <div style={{ fontFamily: TOK.display, fontSize: 18, color: TOK.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, maxWidth: 360, margin: "0 auto" }}>{body}</div>
      {actionLabel && (
        <button onClick={onAction} style={{ ...btn.primary, margin: "16px auto 0" }}>
          <Plus size={15} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

const sectionLabel = {
  fontFamily: TOK.mono, fontSize: 11, letterSpacing: 1.5, color: TOK.brassDim, textTransform: "uppercase",
};

const chip = {
  padding: "6px 12px", borderRadius: 20, fontSize: 12, border: "1px solid",
  cursor: "pointer", background: "transparent", transition: "all 0.15s",
};

const input = {
  width: "100%", background: TOK.surface, border: `1px solid ${TOK.line}`, borderRadius: 8,
  padding: "9px 12px", color: TOK.text, fontSize: 14, fontFamily: TOK.body, outline: "none", boxSizing: "border-box",
};

const btn = {
  primary: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: TOK.brass, color: TOK.bg, border: "none", borderRadius: 8,
    padding: "0 16px", height: 36, boxSizing: "border-box", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  ghost: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: "transparent", color: TOK.textDim, border: `1px solid ${TOK.line}`, borderRadius: 8,
    padding: "0 16px", height: 36, boxSizing: "border-box", fontSize: 13, cursor: "pointer",
  },
};
