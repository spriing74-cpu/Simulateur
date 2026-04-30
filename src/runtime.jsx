import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";

// ══════════════════════════════════════════════════════════════════════════════
// TAUX GRH00372 — Barème officiel (Groupe I, taux majorés hors région)
// ══════════════════════════════════════════════════════════════════════════════
const TAUX = {
  // Indemnités fixes variables
  conduiteVA: 4.58,       // IND CONDUITE VOIT. AUTOMOBILE / jour
  compensRepos: 13.03,    // IND COMPENS REPOS HS ZNE TRAV.INFRA V / nuit
  trvNuit: 2.70,          // INDEMNITE TRAVAIL DE NUIT / heure
  trvNuit2: 3.35,         // INDEMNITE TRAVAIL NUIT TAUX 2 / heure
  milieuNuit: 0.20,       // IND SUPPL HORAIRE MILIEU NUIT / heure
  dimFeries: 4.50,        // INDEMNITE TRAVAIL DIMANCHE & FETES / heure
  specNuitTauxA: 9.77,    // IND SPECIALE TRAVAUX DE NUIT TAUX A / nuit
  supTravNuit: 10.80,     // IND SUPPT TRAVAUX NUIT / nuit
  hsNormales: 9.838,      // IND HEURES SUP NORMALES INOPINEES / heure
  hsMaj25: 2.459,         // IND HEURES SUP NORMALES MAJOREES 25 % INOPINEES / heure
  prolongAccidentel: 3.89,// IND PROLONG ACCIDENTEL DUREE TRAVAIL
  hsFetes: 15.844,        // IND HRES SUPPL FETES / heure
  primeJourn: 17.83,      // Prime journalière complémentaire / jour

  // Allocations déplacement COMPLÈTES (méthode SALADIN découverte via collègue)
  // Repas + découcher groupés
  allocCompleteJ110: 92.76,  // J1-J10 taux majoré
  allocCompleteJ1130: 83.36, // J11-J30 taux majoré
  allocCompleteNorm: 74.16,  // au-delà

  // ICH & IND JR (à vérifier droit ouvert)
  ichNuit: 21.90,
  indJrLogement: 12.32,
  complAllocNuitSed: 3.60,
  allocNuitSedHeure: 1.26,

  // Cotisations salariales
  cprPrev: 0.0015, prevT1: 0, santeT1: 0,
  santeForf: 17.33, santeSol: 0,
  cprRet: 0.0906, cotSNCF: 0, chomage: 0,
  csgDed: 0.068, csgCrds: 0.029, pas: 0.009,
};

// ══════════════════════════════════════════════════════════════════════════════
// CODES PRÉSENCE
// ══════════════════════════════════════════════════════════════════════════════
const CODES = {
  P:    { label: "Présence", color: "#0f766e", bg: "#ccfbf1" },
  MN:   { label: "Montée nuit", color: "#6d28d9", bg: "#ede9fe" },
  RP:   { label: "Repos périodique", color: "#78716c", bg: "#f5f5f4" },
  RU:   { label: "Repos suppl.", color: "#a16207", bg: "#fef3c7" },
  CA:   { label: "Congé annuel", color: "#0369a1", bg: "#dbeafe" },
  CS:   { label: "Congé suppl.", color: "#0369a1", bg: "#dbeafe" },
  RA:   { label: "RP année préc.", color: "#78716c", bg: "#f5f5f4" },
  CET:  { label: "Compte épargne", color: "#a16207", bg: "#fef3c7" },
  MA:   { label: "Maladie / AT", color: "#dc2626", bg: "#fee2e2" },
  FO:   { label: "Formation", color: "#7c2d12", bg: "#fed7aa" },
  F:    { label: "Férié", color: "#be185d", bg: "#fce7f3" },
};

// ══════════════════════════════════════════════════════════════════════════════
// CALCUL DU SALAIRE
// ══════════════════════════════════════════════════════════════════════════════
function calculer(cfg, mois) {
  const jours = mois.jours || [];
  
  // Comptages
  const travaillés = jours.filter(j => j.code === "P" || j.code === "MN");
  const découchers = jours.filter(j => j.decouch).length;
  const nuitsZoneInfra = jours.filter(j => j.nuitZoneInfra).length;
  const joursConduite = travaillés.filter(j => j.conduite).length;
  const heuresNuit = jours.reduce((s, j) => s + (j.hNuit1 || 0), 0);
  const heuresNuit2 = jours.reduce((s, j) => s + (j.hNuit2 || 0), 0);
  const heuresMilieu = jours.reduce((s, j) => s + (j.hMilieu || 0), 0);
  const heuresDimF = jours.reduce((s, j) => s + (j.hDimF || 0), 0);
  const heuresHSFetes = mois.hsFetes || 0;
  const nbPrimeJourn = mois["primeJournali\u00e8re"] || mois.primeJournaliere || 0;
  const nbNuitsTravail = jours.filter(j => (j.hNuit1 || 0) + (j.hNuit2 || 0) + (j.hMilieu || 0) > 0).length;
  const nbSupTravNuit = mois.supTravNuitCount ?? (mois.supTravNuit ? 1 : 0);
  const heuresSupNormales = mois.hsNormales || 0;
  const heuresSupMaj25 = mois.hsMaj25 || 0;
  const nbProlongAccidentel = mois.prolongAccidentel || 0;

  // === GAINS ===
  const traitement = cfg.traitement;
  const indResidence = cfg.indResidence;
  const complementIR = cfg.complementIR;
  const primeTrav = travaillés.length * (cfg.primeTravailJour ?? 12.90);
  const avNature = 14.50;
  const indEloign = mois.enMission ? travaillés.length * ((cfg.indEloignementMensuel ?? cfg.indEloignement ?? 0) / 20) : 0;

  const indConduite = joursConduite * TAUX.conduiteVA;
  const indCompensRepos = nuitsZoneInfra * TAUX.compensRepos;
  const indTrvNuit = heuresNuit * TAUX.trvNuit;
  const indTrvNuit2 = heuresNuit2 * TAUX.trvNuit2;
  const indMilieuNuit = heuresMilieu * TAUX.milieuNuit;
  const indDimFeries = heuresDimF * TAUX.dimFeries;
  const indSpecNuit = nbNuitsTravail * TAUX.specNuitTauxA;
  const indSupTrvNuit = nbSupTravNuit * TAUX.supTravNuit;
  const indHSFetes = heuresHSFetes * TAUX.hsFetes;
  const indHSNormales = heuresSupNormales * TAUX.hsNormales;
  const indHSMaj25 = heuresSupMaj25 * TAUX.hsMaj25;
  const indProlongAcc = nbProlongAccidentel * TAUX.prolongAccidentel;
  const primeJournTotal = nbPrimeJourn * TAUX.primeJourn;
  const complAllocNuitSed = nbNuitsTravail * TAUX.complAllocNuitSed;

  const ppv = mois.ppv || 0;
  const gratif = mois.gratif || 0;
  const laPrime = mois.laPrime || 0;
  const comptAllocNuit = mois.comptAllocNuit || 0;

  // Lignes optionnelles si droits ouverts
  const ich = cfg.droitICH ? découchers * TAUX.ichNuit : 0;
  const indJrLog = cfg.droitIndJr ? découchers * TAUX.indJrLogement : 0;

  const brut = traitement + indResidence + complementIR + indEloign + indConduite
    + indCompensRepos + indTrvNuit + indTrvNuit2 + indMilieuNuit + indDimFeries
    + indSpecNuit + indSupTrvNuit + indHSFetes + indHSNormales + indHSMaj25
    + indProlongAcc + primeJournTotal + primeTrav + complAllocNuitSed
    + comptAllocNuit + avNature + ppv + gratif + laPrime + ich + indJrLog;

  // === ALLOCATION DÉPLACEMENT (méthode SALADIN) ===
  // On utilise le système "alloc complète" découvert via l'ODS collègue
  const j1j10 = Math.min(découchers, 10);
  const j11j30 = Math.min(Math.max(0, découchers - 10), 20);
  const j31plus = Math.max(0, découchers - 30);
  const allocDepl = j1j10 * TAUX.allocCompleteJ110
    + j11j30 * TAUX.allocCompleteJ1130
    + j31plus * TAUX.allocCompleteNorm;

  const allocNuitSed = heuresNuit * TAUX.allocNuitSedHeure;

  // === COTISATIONS ===
  const baseCotis = brut - ppv;
  const baseRet = cfg.traitement + primeTrav;
  const baseCSG = baseCotis * 0.9825;

  const cprP = -baseCotis * TAUX.cprPrev;
  const prevT1 = -baseCotis * TAUX.prevT1;
  const santeSol = -TAUX.santeSol;
  const santeForf = -TAUX.santeForf;
  const santeT1 = -baseCotis * TAUX.santeT1;
  const cprRet = -baseRet * TAUX.cprRet;
  const cotSNCF = -baseCotis * TAUX.cotSNCF;
  const chom = -baseCotis * TAUX.chomage;
  const csgDed = -baseCSG * TAUX.csgDed;
  const csgCrds = -baseCSG * TAUX.csgCrds;

  const totalCotis = cprP + prevT1 + santeSol + santeForf + santeT1 + cprRet + cotSNCF + chom + csgDed + csgCrds;

  // === RÉSULTAT ===
  const netSocial = brut + totalCotis;
  const netAvantImpot = brut + cprP + cprRet + csgDed + csgCrds + allocDepl + allocNuitSed;
  const baseImposable = netSocial;
  const tauxPAS = cfg.tauxPAS ?? (TAUX.pas * 100);
  const impot = -baseImposable * (tauxPAS / 100);
  const netAPayer = netAvantImpot + impot;

  return {
    // Compteurs
    nbTravaillés: travaillés.length,
    découchers, nuitsZoneInfra, joursConduite,
    nbNuitsTravail, nbSupTravNuit, heuresSupNormales, heuresSupMaj25, nbProlongAccidentel,
    heuresNuit, heuresNuit2, heuresMilieu, heuresDimF,
    // Gains
    traitement, indResidence, complementIR, indEloign, indConduite,
    indCompensRepos, indTrvNuit, indTrvNuit2, indMilieuNuit, indDimFeries,
    indSpecNuit, indSupTrvNuit, indHSFetes, indHSNormales, indHSMaj25,
    indProlongAcc, primeJournTotal, primeTrav, complAllocNuitSed,
    avNature, ppv, gratif, laPrime, comptAllocNuit, ich, indJrLog, brut,
    // Allocs
    allocDepl, allocNuitSed,
    // Cotis
    cprP, prevT1, santeSol, santeForf, santeT1, cprRet, cotSNCF, chom,
    csgDed, csgCrds, totalCotis,
    // Résultat
    netSocial, netAvantImpot, baseImposable, tauxPAS, impot, netAPayer,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// STORAGE LOCAL
// ══════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY_CFG = "sncf:cfg";
const STORAGE_KEY_MOIS = "sncf:mois";

async function loadStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}
async function saveStorage(key, val) {
  try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const MOIS_NOMS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_SEM = ["L","M","M","J","V","S","D"];

const fr = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro = (n) => fr(Math.abs(n)) + " €";

function nbJoursDansMois(annee, mois) {
  return new Date(annee, mois + 1, 0).getDate();
}
function premierJourSemaine(annee, mois) {
  const d = new Date(annee, mois, 1).getDay();
  return d === 0 ? 6 : d - 1; // lundi = 0
}
function moisKey(annee, mois) {
  return `${annee}-${mois}`;
}
function decalageMois(annee, mois, delta) {
  const d = new Date(annee, mois + delta, 1);
  return { annee: d.getFullYear(), mois: d.getMonth() };
}
function libelleMois(mois) {
  return `${MOIS_NOMS[mois.mois]} ${mois.annee}`;
}

const DEFAULT_CFG = {
  schemaVersion: 2,
  traitement: 1348.46,
  indResidence: 28.97,
  complementIR: 0,
  primeTravailJour: 12.90,
  indEloignementMensuel: 217.20,
  tauxPAS: 9,
  droitICH: false,
  droitIndJr: false,
};

const OLD_DEFAULT_CFG = {
  traitement: 1756.08,
  indResidence: 67.92,
  complementIR: 32.08,
  primeTravailFixe: 347.77,
  indEloignement: 218.89,
  primeRetraite: 334.39,
  tauxPAS: 0.9,
};

function normaliserCfg(cfg = {}) {
  const next = { ...DEFAULT_CFG, ...cfg, schemaVersion: DEFAULT_CFG.schemaVersion };
  if (!cfg.schemaVersion) {
    Object.entries(OLD_DEFAULT_CFG).forEach(([key, oldValue]) => {
      if (cfg[key] === undefined || cfg[key] === oldValue) {
        delete next[key];
      }
    });
    return { ...DEFAULT_CFG, ...next };
  }
  return next;
}

function nouveauMois(annee, mois) {
  const nbJ = nbJoursDansMois(annee, mois);
  const jours = [];
  for (let i = 1; i <= nbJ; i++) {
    const d = new Date(annee, mois, i);
    jours.push({
      date: i,
      jour: d.getDay() === 0 ? 6 : d.getDay() - 1,
      code: null,
      chantier: "",
      decouch: false,
      nuitZoneInfra: false,
      conduite: false,
      hNuit1: 0, hNuit2: 0, hMilieu: 0, hDimF: 0,
    });
  }
  return {
    annee, mois,
    jours,
    enMission: true,
    ppv: 0, gratif: 0, laPrime: 0, comptAllocNuit: 0,
    hsFetes: 0, hsNormales: 0, hsMaj25: 0, prolongAccidentel: 0,
    primeJournalière: 0, supTravNuit: false, supTravNuitCount: 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES (Notion/Stripe inspired, clean minimal)
// ══════════════════════════════════════════════════════════════════════════════
const theme = {
  bg: "#fafaf9",
  surface: "#ffffff",
  surfaceAlt: "#f5f5f4",
  border: "#e7e5e4",
  borderLight: "#f5f5f4",
  text: "#1c1917",
  textMute: "#78716c",
  textSoft: "#a8a29e",
  accent: "#18181b",
  green: "#0f766e",
  red: "#be123c",
  blue: "#0369a1",
  amber: "#a16207",
};

// ══════════════════════════════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════════════════════════════
function App() {
  const [tab, setTab] = useState("home");
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [moisMap, setMoisMap] = useState({});
  const [activeMois, setActiveMois] = useState(() => {
    const d = new Date();
    return moisKey(d.getFullYear(), d.getMonth());
  });
  const [loaded, setLoaded] = useState(false);

  // Load storage
  useEffect(() => {
    (async () => {
      const c = await loadStorage(STORAGE_KEY_CFG, DEFAULT_CFG);
      const m = await loadStorage(STORAGE_KEY_MOIS, {});
      setCfg(normaliserCfg(c));
      setMoisMap(m);
      setLoaded(true);
    })();
  }, []);

  // Save
  useEffect(() => { if (loaded) saveStorage(STORAGE_KEY_CFG, cfg); }, [cfg, loaded]);
  useEffect(() => { if (loaded) saveStorage(STORAGE_KEY_MOIS, moisMap); }, [moisMap, loaded]);

  const [yr, mi] = activeMois.split("-").map(Number);
  const mois = moisMap[activeMois] || nouveauMois(yr, mi);
  const prev = decalageMois(yr, mi, -1);
  const evsKey = moisKey(prev.annee, prev.mois);
  const moisEVS = moisMap[evsKey] || nouveauMois(prev.annee, prev.mois);

  const updateMois = (updater) => {
    setMoisMap(m => ({ ...m, [activeMois]: updater(mois) }));
  };

  const resCalcul = useMemo(() => calculer(cfg, moisEVS), [cfg, moisEVS]);
  const res = { ...resCalcul, moisPaie: mois, moisEVS };

  return (
    <div style={{
      fontFamily: '"Instrument Serif", "Fraunces", Georgia, serif',
      background: theme.bg,
      color: theme.text,
      minHeight: "100vh",
      maxWidth: 440,
      margin: "0 auto",
      paddingBottom: 100,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: ${theme.bg}; }
        input, button { font-family: 'Inter', sans-serif; }
        .serif { font-family: 'Instrument Serif', Georgia, serif; }
        .sans { font-family: 'Inter', -apple-system, sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; }
        .fade-in { animation: fadeIn .3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .btn-tap:active { transform: scale(0.97); transition: transform 0.1s; }
      `}</style>

      {/* Header */}
      <Header mois={mois} setActiveMois={setActiveMois} />

      {/* Content */}
      <div style={{ padding: "0 20px" }}>
        {tab === "home" && <HomeTab res={res} mois={mois} cfg={cfg} />}
        {tab === "planning" && <PlanningTab mois={mois} updateMois={updateMois} />}
        {tab === "extras" && <ExtrasTab mois={mois} updateMois={updateMois} />}
        {tab === "detail" && <DetailTab res={res} cfg={cfg} mois={moisEVS} />}
        {tab === "config" && <ConfigTab cfg={cfg} setCfg={setCfg} />}
      </div>

      {/* Bottom navigation */}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HEADER avec sélecteur mois élégant
// ══════════════════════════════════════════════════════════════════════════════
function Header({ mois, setActiveMois }) {
  const [picker, setPicker] = useState(false);

  const naviguer = (delta) => {
    let m = mois.mois + delta;
    let y = mois.annee;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setActiveMois(moisKey(y, m));
  };

  return (
    <div style={{
      background: theme.bg,
      padding: "18px 20px 16px",
      position: "sticky", top: 0, zIndex: 50,
      borderBottom: `1px solid ${theme.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <button
            className="btn-tap"
            onClick={() => naviguer(-1)}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: theme.textMute, marginRight: 8 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <span className="serif" style={{ fontSize: 28, fontWeight: 400, letterSpacing: -0.5 }}>
            {MOIS_NOMS[mois.mois]}
          </span>
          <span className="serif" style={{ fontSize: 28, color: theme.textSoft, marginLeft: 6 }}>
            {mois.annee}
          </span>
          <button
            className="btn-tap"
            onClick={() => naviguer(1)}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: theme.textMute, marginLeft: 8 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME — Vue synthétique
// ══════════════════════════════════════════════════════════════════════════════
function HomeTab({ res, mois, cfg }) {
  const nbJoursSaisis = mois.jours.filter(j => j.code).length;
  const totalJours = mois.jours.length;
  const avancement = totalJours ? Math.round(nbJoursSaisis / totalJours * 100) : 0;

  return (
    <div className="fade-in" style={{ paddingTop: 24 }}>

      {/* Card principale NET */}
      <div style={{
        background: theme.surface,
        borderRadius: 20,
        padding: "28px 24px",
        border: `1px solid ${theme.border}`,
        marginBottom: 16,
      }}>
        <div className="sans" style={{
          fontSize: 11, color: theme.textSoft, letterSpacing: 1.5,
          textTransform: "uppercase", marginBottom: 10, fontWeight: 500,
        }}>Net estimé à payer</div>

        <div className="serif tabular" style={{
          fontSize: 52, fontWeight: 400, lineHeight: 1, letterSpacing: -2, color: theme.text,
        }}>
          {fr(res.netAPayer)}
          <span style={{ fontSize: 26, color: theme.textMute, marginLeft: 4 }}>€</span>
        </div>

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            ["Brut", res.brut],
            ["Alloc.", res.allocDepl],
            ["Impôt", Math.abs(res.impot)],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="sans" style={{ fontSize: 10, color: theme.textSoft, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500, marginBottom: 3 }}>{l}</div>
              <div className="sans tabular" style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{fr(v)} €</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: theme.surfaceAlt,
        borderRadius: 12,
        padding: "12px 14px",
        border: `1px solid ${theme.borderLight}`,
        marginBottom: 16,
      }}>
        <div className="sans" style={{ fontSize: 10, color: theme.textSoft, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
          EVS M+1
        </div>
        <div className="sans" style={{ fontSize: 12, color: theme.textMute, lineHeight: 1.5 }}>
          Paie de <strong>{libelleMois(res.moisPaie)}</strong> calculée avec les EVS de <strong>{libelleMois(res.moisEVS)}</strong>.
        </div>
      </div>

      {/* Progression saisie */}
      <div style={{
        background: theme.surface,
        borderRadius: 16,
        padding: "16px 20px",
        border: `1px solid ${theme.border}`,
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <div className="sans" style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>Planning saisi</div>
            <div className="sans" style={{ fontSize: 11, color: theme.textSoft, marginTop: 2 }}>
              {nbJoursSaisis} jours sur {totalJours}
            </div>
          </div>
          <div className="serif tabular" style={{ fontSize: 22, color: theme.text, fontWeight: 400 }}>
            {avancement}%
          </div>
        </div>
        <div style={{ height: 4, background: theme.borderLight, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: avancement + "%",
            height: "100%",
            background: theme.text,
            transition: "width 0.3s",
          }} />
        </div>
      </div>

      {/* Stats compteurs */}
      <div style={{
        background: theme.surface,
        borderRadius: 16,
        padding: "4px 20px",
        border: `1px solid ${theme.border}`,
        marginBottom: 16,
      }}>
        {[
          ["Jours travaillés", res.nbTravaillés, "P + MN"],
          ["Découchers", res.découchers, "Nuits hors domicile"],
          ["Jours de conduite", res.joursConduite, `${fr(res.indConduite)} €`],
          ["Heures de nuit", res.heuresNuit + res.heuresNuit2, `${fr(res.indTrvNuit + res.indTrvNuit2)} €`],
        ].map(([l, v, sub], i, arr) => (
          <div key={l} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 0",
            borderBottom: i < arr.length - 1 ? `1px solid ${theme.borderLight}` : "none",
          }}>
            <div>
              <div className="sans" style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>{l}</div>
              <div className="sans" style={{ fontSize: 11, color: theme.textSoft, marginTop: 1 }}>{sub}</div>
            </div>
            <div className="serif tabular" style={{ fontSize: 24, fontWeight: 400, color: theme.text }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      {/* Note méthode */}
      <div style={{
        padding: "14px 16px",
        background: theme.surfaceAlt,
        borderRadius: 12,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div className="sans" style={{ fontSize: 11, color: theme.textMute, lineHeight: 1.6 }}>
          Les EVS sont décalées en M+1 : le planning et les extras du mois précédent alimentent le net estimé.
          {" "}
          Calcul aligné sur <strong>CALCUL PAYE.ods</strong> (allocation complète par découcher,
          taux J1-J10 : <span className="tabular">92,76 EUR</span>, J11-J30 : <span className="tabular">83,36 EUR</span>, au-delà : <span className="tabular">74,16 EUR</span>).
          GRH00131 v02 - GRH00372.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PLANNING — Vue calendrier + saisie semaine
// ══════════════════════════════════════════════════════════════════════════════
function PlanningTab({ mois, updateMois }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [weekMode, setWeekMode] = useState(false);

  const premJour = premierJourSemaine(mois.annee, mois.mois);

  // Semaines
  const semaines = useMemo(() => {
    const weeks = [];
    let current = Array(premJour).fill(null);
    mois.jours.forEach(j => {
      current.push(j);
      if (current.length === 7) {
        weeks.push(current);
        current = [];
      }
    });
    if (current.length) {
      while (current.length < 7) current.push(null);
      weeks.push(current);
    }
    return weeks;
  }, [mois]);

  const updateJour = (jourNum, updates) => {
    updateMois(m => ({
      ...m,
      jours: m.jours.map(j => j.date === jourNum ? { ...j, ...updates } : j)
    }));
  };

  const resetPlanning = () => {
    updateMois(m => ({
      ...m,
      jours: nouveauMois(m.annee, m.mois).jours
    }));
    setSelectedDay(null);
  };

  const appliquerSemaine = (semaine, pattern) => {
    updateMois(m => ({
      ...m,
      jours: m.jours.map(j => {
        const enSemaine = semaine.some(s => s && s.date === j.date);
        if (!enSemaine) return j;
        return { ...j, ...pattern };
      })
    }));
  };

  return (
    <div className="fade-in" style={{ paddingTop: 24 }}>

      <div style={{
        background: theme.surfaceAlt,
        borderRadius: 12,
        padding: "12px 14px",
        border: `1px solid ${theme.borderLight}`,
        marginBottom: 16,
      }}>
        <div className="sans" style={{ fontSize: 10, color: theme.textSoft, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
          Saisie EVS
        </div>
        <div className="sans" style={{ fontSize: 12, color: theme.textMute, lineHeight: 1.5 }}>
          Les éléments saisis sur {libelleMois(mois)} seront pris en compte sur la paie de {libelleMois(decalageMois(mois.annee, mois.mois, 1))}.
        </div>
      </div>

      {/* Légende */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {Object.entries(CODES).slice(0, 6).map(([code, info]) => (
          <div key={code} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5, background: info.bg,
              color: info.color, fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Inter",
            }}>{code}</div>
            <span className="sans" style={{ fontSize: 11, color: theme.textMute }}>{info.label}</span>
          </div>
        ))}
      </div>

      {/* Calendrier */}
      <div style={{
        background: theme.surface,
        borderRadius: 16,
        padding: 16,
        border: `1px solid ${theme.border}`,
        marginBottom: 16,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
          {JOURS_SEM.map((j, i) => (
            <div key={i} className="sans" style={{
              fontSize: 10, color: theme.textSoft, textAlign: "center",
              fontWeight: 600, letterSpacing: 0.5, paddingBottom: 6,
            }}>{j}</div>
          ))}
        </div>

        {semaines.map((semaine, wi) => (
          <div key={wi} style={{ marginBottom: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {semaine.map((j, di) => j ? (
                <JourCell key={di} jour={j} onClick={() => setSelectedDay(j.date)} />
              ) : (
                <div key={di} style={{ aspectRatio: "1" }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions rapides : templates semaines */}
      <TemplatesSemaine updateMois={updateMois} mois={mois} />

      <button
        onClick={resetPlanning}
        className="btn-tap sans"
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "transparent",
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          color: theme.red,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        Réinitialiser le planning
      </button>

      {/* Sheet de saisie jour */}
      {selectedDay && (
        <DaySheet
          jour={mois.jours.find(j => j.date === selectedDay)}
          onClose={() => setSelectedDay(null)}
          onSave={(updates) => { updateJour(selectedDay, updates); setSelectedDay(null); }}
        />
      )}
    </div>
  );
}

function JourCell({ jour, onClick }) {
  const info = CODES[jour.code] || { bg: "#fff", color: theme.textSoft };
  const weekend = jour.jour >= 5;

  return (
    <button
      onClick={onClick}
      className="btn-tap"
      style={{
        aspectRatio: "1",
        border: `1px solid ${jour.code ? "transparent" : theme.border}`,
        borderRadius: 8,
        background: jour.code ? info.bg : (weekend ? theme.surfaceAlt : theme.surface),
        cursor: "pointer",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        position: "relative",
        padding: 2,
      }}
    >
      <div className="sans tabular" style={{
        fontSize: 13,
        color: jour.code ? info.color : (weekend ? theme.textSoft : theme.text),
        fontWeight: jour.code ? 700 : 500,
      }}>
        {jour.date}
      </div>
      {jour.code && (
        <div className="sans" style={{
          fontSize: 8, fontWeight: 700, color: info.color,
          letterSpacing: 0.3, marginTop: 1,
        }}>{jour.code}</div>
      )}
      {jour.decouch && (
        <div style={{
          position: "absolute", top: 3, right: 3,
          width: 5, height: 5, borderRadius: "50%", background: theme.blue,
        }} />
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Application rapide — multi-sélection semaines + pattern custom
// ══════════════════════════════════════════════════════════════════════════════
function TemplatesSemaine({ updateMois, mois }) {
  const [open, setOpen] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState([]); // array d'indices
  // Pattern configurable
  const [pCode, setPCode] = useState("P");
  const [pChantier, setPChantier] = useState("TS15");
  const [pDecouch, setPDecouch] = useState(true);
  const [pNuitZoneInfra, setPNuitZoneInfra] = useState(true);
  const [pConduite, setPConduite] = useState(true);
  const [pHNuit1, setPHNuit1] = useState(0);
  const [pHNuit2, setPHNuit2] = useState(0);
  const [pHMilieu, setPHMilieu] = useState(0);
  const [pHDimF, setPHDimF] = useState(0);
  // Application par jour de semaine (lun-dim)
  const [joursActifs, setJoursActifs] = useState([true, true, true, true, true, false, false]);

  // Regroupe les jours par semaine ISO (lundi = début)
  const semainesDuMois = useMemo(() => {
    const sem = {};
    mois.jours.forEach(j => {
      const dateObj = new Date(mois.annee, mois.mois, j.date);
      const dow = (dateObj.getDay() + 6) % 7; // 0=Lun..6=Dim
      const wkStart = new Date(dateObj);
      wkStart.setDate(dateObj.getDate() - dow);
      const key = `${wkStart.getFullYear()}-${wkStart.getMonth()}-${wkStart.getDate()}`;
      if (!sem[key]) sem[key] = { debut: wkStart, jours: [] };
      sem[key].jours.push({ ...j, dow });
    });
    return Object.values(sem).sort((a, b) => a.debut - b.debut);
  }, [mois]);

  const toggleWeek = (i) => {
    setSelectedWeeks(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a, b) => a - b)
    );
  };
  const selectAll = () => setSelectedWeeks(semainesDuMois.map((_, i) => i));
  const clearAll = () => setSelectedWeeks([]);

  const toggleJour = (idx) => {
    setJoursActifs(prev => prev.map((v, i) => i === idx ? !v : v));
  };

  const apply = () => {
    const selectedJours = new Set();
    selectedWeeks.forEach(wi => {
      semainesDuMois[wi].jours.forEach(j => {
        if (joursActifs[j.dow]) selectedJours.add(j.date);
      });
    });

    const patch = {
      code: pCode,
      chantier: pChantier,
      decouch: pDecouch,
      nuitZoneInfra: pNuitZoneInfra,
      conduite: pConduite,
      hNuit1: pHNuit1, hNuit2: pHNuit2,
      hMilieu: pHMilieu, hDimF: pHDimF,
    };

    updateMois(m => ({
      ...m,
      jours: m.jours.map(j => selectedJours.has(j.date) ? { ...j, ...patch } : j)
    }));

    // Reset après application
    setSelectedWeeks([]);
    setOpen(false);
  };

  const nbJoursImpactés = selectedWeeks.reduce((n, wi) => {
    return n + semainesDuMois[wi].jours.filter(j => joursActifs[j.dow]).length;
  }, 0);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-tap sans"
        style={{
          width: "100%",
          padding: "14px 16px",
          background: theme.surface,
          border: `1px dashed ${theme.border}`,
          borderRadius: 12,
          color: theme.textMute,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 20,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
        </svg>
        Application rapide (semaines / mois complet)
      </button>
    );
  }

  return (
    <div className="fade-in" style={{
      background: theme.surface,
      borderRadius: 16,
      border: `1px solid ${theme.border}`,
      padding: 16,
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="sans" style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Application rapide</div>
        <button onClick={() => { setOpen(false); setSelectedWeeks([]); }}
          style={{ border: "none", background: "none", color: theme.textSoft, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      {/* === ÉTAPE 1 : Semaines === */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="sans" style={{ fontSize: 11, color: theme.textSoft, textTransform: "uppercase", letterSpacing: 1 }}>
          1. Semaines <span style={{ color: theme.text, fontWeight: 600 }}>· {selectedWeeks.length} sélect.</span>
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={selectAll} className="btn-tap sans" style={pillStyle(false)}>Tout le mois</button>
          {selectedWeeks.length > 0 && (
            <button onClick={clearAll} className="btn-tap sans" style={pillStyle(false)}>Vider</button>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 16 }}>
        {semainesDuMois.map((s, i) => {
          const sel = selectedWeeks.includes(i);
          const dFin = new Date(s.debut);
          dFin.setDate(s.debut.getDate() + 6);
          return (
            <button
              key={i}
              onClick={() => toggleWeek(i)}
              className="btn-tap sans"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: sel ? theme.text : "transparent",
                color: sel ? "white" : theme.text,
                border: `1px solid ${sel ? theme.text : theme.border}`,
                fontSize: 12, fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <span>S{i + 1}</span>
              <span style={{ opacity: 0.7, fontSize: 10 }}>
                {String(s.debut.getDate()).padStart(2,'0')}–{String(dFin.getDate()).padStart(2,'0')}
              </span>
            </button>
          );
        })}
      </div>

      {/* === ÉTAPE 2 : Jours de la semaine concernés === */}
      <div className="sans" style={{ fontSize: 11, color: theme.textSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        2. Jours actifs
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 16 }}>
        {["L","M","M","J","V","S","D"].map((lbl, i) => (
          <button
            key={i}
            onClick={() => toggleJour(i)}
            className="btn-tap sans"
            style={{
              padding: "10px 0",
              borderRadius: 8,
              background: joursActifs[i] ? theme.text : "transparent",
              color: joursActifs[i] ? "white" : theme.textMute,
              border: `1px solid ${joursActifs[i] ? theme.text : theme.border}`,
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
            }}
          >{lbl}</button>
        ))}
      </div>

      {/* === ÉTAPE 3 : Pattern à appliquer === */}
      <div className="sans" style={{ fontSize: 11, color: theme.textSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        3. Ce qu'on applique
      </div>

      {/* Code présence */}
      <div style={{ marginBottom: 12 }}>
        <div className="sans" style={{ fontSize: 10, color: theme.textMute, marginBottom: 6 }}>Code présence</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {Object.entries(CODES).map(([c, info]) => (
            <button
              key={c}
              onClick={() => setPCode(c)}
              className="btn-tap sans"
              style={{
                padding: "8px 4px", borderRadius: 8,
                background: pCode === c ? info.bg : "transparent",
                color: pCode === c ? info.color : theme.textMute,
                border: `1px solid ${pCode === c ? info.color : theme.border}`,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div style={{ padding: "4px 12px", background: theme.surfaceAlt, borderRadius: 10, marginBottom: 12 }}>
        <ToggleRow label="Découcher (nuit hors domicile)" value={pDecouch} onChange={setPDecouch} accent={theme.blue} />
        <ToggleRow label={`Nuit zone infra (+${fr(TAUX.compensRepos)} €)`} value={pNuitZoneInfra} onChange={setPNuitZoneInfra} />
        <ToggleRow label={`Conduite VA (+${fr(TAUX.conduiteVA)} €)`} value={pConduite} onChange={setPConduite} />
      </div>

      {/* Heures (dépliable) */}
      <PatternHeures
        hNuit1={pHNuit1} setHNuit1={setPHNuit1}
        hNuit2={pHNuit2} setHNuit2={setPHNuit2}
        hMilieu={pHMilieu} setHMilieu={setPHMilieu}
        hDimF={pHDimF} setHDimF={setPHDimF}
      />

      {/* Preview + apply */}
      <div style={{
        background: theme.surfaceAlt, borderRadius: 10,
        padding: "10px 14px", marginTop: 16, marginBottom: 12,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span className="sans" style={{ fontSize: 12, color: theme.textMute }}>Jours impactés</span>
        <span className="serif tabular" style={{ fontSize: 20, color: theme.text, fontWeight: 400 }}>{nbJoursImpactés}</span>
      </div>

      <button
        onClick={apply}
        disabled={nbJoursImpactés === 0}
        className="btn-tap sans"
        style={{
          width: "100%",
          padding: "14px",
          background: nbJoursImpactés === 0 ? theme.border : theme.text,
          color: "white",
          border: "none", borderRadius: 12,
          fontSize: 14, fontWeight: 600,
          cursor: nbJoursImpactés === 0 ? "not-allowed" : "pointer",
          opacity: nbJoursImpactés === 0 ? 0.5 : 1,
        }}
      >
        Appliquer {nbJoursImpactés > 0 ? `à ${nbJoursImpactés} jour${nbJoursImpactés > 1 ? "s" : ""}` : ""}
      </button>
    </div>
  );
}

function pillStyle(active) {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    background: active ? theme.text : "transparent",
    color: active ? "white" : theme.textMute,
    border: `1px solid ${active ? theme.text : theme.border}`,
    fontSize: 10, fontWeight: 500, cursor: "pointer",
    letterSpacing: 0.3,
  };
}

function PatternHeures({ hNuit1, setHNuit1, hNuit2, setHNuit2, hMilieu, setHMilieu, hDimF, setHDimF }) {
  const [open, setOpen] = useState(hNuit1 || hNuit2 || hMilieu || hDimF);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-tap sans"
        style={{
          width: "100%", padding: "10px", borderRadius: 10,
          background: "transparent", border: `1px dashed ${theme.border}`,
          color: theme.textMute, fontSize: 12, cursor: "pointer",
        }}
      >+ Ajouter des heures (nuit, dim/fériés…)</button>
    );
  }
  return (
    <div style={{ padding: "4px 12px", background: theme.surfaceAlt, borderRadius: 10 }}>
      <NumberRow label="Heures nuit 21h–6h" value={hNuit1} onChange={setHNuit1} suffix="h" hint={`${fr(hNuit1 * TAUX.trvNuit)} €`} />
      <NumberRow label="Heures nuit taux 2" value={hNuit2} onChange={setHNuit2} suffix="h" hint={`${fr(hNuit2 * TAUX.trvNuit2)} €`} />
      <NumberRow label="Heures milieu nuit" value={hMilieu} onChange={setHMilieu} suffix="h" hint={`${fr(hMilieu * TAUX.milieuNuit)} €`} />
      <NumberRow label="Heures dim/fériés" value={hDimF} onChange={setHDimF} suffix="h" hint={`${fr(hDimF * TAUX.dimFeries)} €`} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Day Sheet — saisie d'un jour
// ══════════════════════════════════════════════════════════════════════════════
function DaySheet({ jour, onClose, onSave }) {
  const [code, setCode] = useState(jour.code);
  const [decouch, setDecouch] = useState(jour.decouch);
  const [nuitZoneInfra, setNuitZoneInfra] = useState(jour.nuitZoneInfra);
  const [conduite, setConduite] = useState(jour.conduite);
  const [hNuit1, setHNuit1] = useState(jour.hNuit1 || 0);
  const [hNuit2, setHNuit2] = useState(jour.hNuit2 || 0);
  const [hMilieu, setHMilieu] = useState(jour.hMilieu || 0);
  const [hDimF, setHDimF] = useState(jour.hDimF || 0);

  const save = () => onSave({ code, decouch, nuitZoneInfra, conduite, hNuit1, hNuit2, hMilieu, hDimF });

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        zIndex: 100, animation: "fadeIn .2s"
      }} />
      <div className="fade-in" style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: 0, width: "100%", maxWidth: 440,
        background: theme.surface,
        borderRadius: "20px 20px 0 0",
        padding: "12px 20px 24px",
        zIndex: 101,
        maxHeight: "85vh", overflowY: "auto",
        paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
      }}>
        <div style={{
          width: 36, height: 4, background: theme.border, borderRadius: 2,
          margin: "0 auto 20px",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <div>
            <div className="sans" style={{ fontSize: 11, color: theme.textSoft, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Jour</div>
            <div className="serif" style={{ fontSize: 32, color: theme.text, letterSpacing: -1 }}>{jour.date}</div>
          </div>
          <button onClick={save} className="btn-tap sans" style={{
            background: theme.text, color: "white", border: "none",
            borderRadius: 999, padding: "10px 20px",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>Enregistrer</button>
        </div>

        {/* Code présence */}
        <div className="sans" style={{ fontSize: 11, color: theme.textSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Code présence</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
          {Object.entries(CODES).map(([c, info]) => (
            <button
              key={c}
              onClick={() => setCode(code === c ? null : c)}
              className="btn-tap sans"
              style={{
                padding: "10px 6px", borderRadius: 8,
                background: code === c ? info.bg : "transparent",
                color: code === c ? info.color : theme.textMute,
                border: `1px solid ${code === c ? info.color : theme.border}`,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >{c}</button>
          ))}
        </div>

        {/* Switches */}
        <ToggleRow label="Découcher (nuit hors domicile)" value={decouch} onChange={setDecouch} accent={theme.blue} />
        <ToggleRow label={`Nuit zone infra (+${fr(TAUX.compensRepos)} €)`} value={nuitZoneInfra} onChange={setNuitZoneInfra} />
        <ToggleRow label={`Conduite VA (+${fr(TAUX.conduiteVA)} €)`} value={conduite} onChange={setConduite} />

        <div style={{ borderTop: `1px solid ${theme.borderLight}`, margin: "16px 0" }} />

        <div className="sans" style={{ fontSize: 11, color: theme.textSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Heures</div>
        <NumberRow label="Heures nuit (21h–6h)" value={hNuit1} onChange={setHNuit1} suffix="h" hint={`${fr(hNuit1 * TAUX.trvNuit)} €`} />
        <NumberRow label="Heures nuit taux 2" value={hNuit2} onChange={setHNuit2} suffix="h" hint={`${fr(hNuit2 * TAUX.trvNuit2)} €`} />
        <NumberRow label="Heures milieu nuit" value={hMilieu} onChange={setHMilieu} suffix="h" hint={`${fr(hMilieu * TAUX.milieuNuit)} €`} />
        <NumberRow label="Heures dim/fériés" value={hDimF} onChange={setHDimF} suffix="h" hint={`${fr(hDimF * TAUX.dimFeries)} €`} />
      </div>
    </>
  );
}

function ToggleRow({ label, value, onChange, accent }) {
  return (
    <div onClick={() => onChange(!value)} className="btn-tap" style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 0",
      borderBottom: `1px solid ${theme.borderLight}`,
      cursor: "pointer",
    }}>
      <span className="sans" style={{ fontSize: 14, color: theme.text }}>{label}</span>
      <div style={{
        width: 44, height: 26, borderRadius: 13, position: "relative",
        background: value ? theme.blue : theme.border,
        transition: "background 0.2s",
      }}>
        <div style={{
          position: "absolute", top: 2, left: value ? 20 : 2,
          width: 22, height: 22, borderRadius: "50%", background: "white",
          transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }} />
      </div>
    </div>
  );
}

function NumberRow({ label, value, onChange, suffix, hint, step = 0.5 }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderBottom: `1px solid ${theme.borderLight}`,
    }}>
      <div style={{ flex: 1 }}>
        <div className="sans" style={{ fontSize: 14, color: theme.text }}>{label}</div>
        {hint && <div className="sans" style={{ fontSize: 11, color: theme.textSoft, marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))}
          className="btn-tap"
          style={{
            width: 32, height: 32, borderRadius: "50%", border: `1px solid ${theme.border}`,
            background: "white", fontSize: 16, cursor: "pointer", color: theme.text,
          }}
        >−</button>
        <span className="sans tabular" style={{ width: 44, textAlign: "center", fontSize: 15, fontWeight: 600 }}>
          {value}{suffix}
        </span>
        <button
          onClick={() => onChange(+(value + step).toFixed(2))}
          className="btn-tap"
          style={{
            width: 32, height: 32, borderRadius: "50%", border: `1px solid ${theme.border}`,
            background: "white", fontSize: 16, cursor: "pointer", color: theme.text,
          }}
        >+</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXTRAS — Éléments ponctuels du mois
// ══════════════════════════════════════════════════════════════════════════════
function ExtrasTab({ mois, updateMois }) {
  const upd = (k) => (v) => updateMois(m => ({ ...m, [k]: v }));

  return (
    <div className="fade-in" style={{ paddingTop: 24 }}>
      <div style={{
        background: theme.surfaceAlt,
        borderRadius: 12,
        padding: "12px 14px",
        border: `1px solid ${theme.borderLight}`,
        marginBottom: 16,
      }}>
        <div className="sans" style={{ fontSize: 10, color: theme.textSoft, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
          Saisie EVS
        </div>
        <div className="sans" style={{ fontSize: 12, color: theme.textMute, lineHeight: 1.5 }}>
          Ces éléments variables de {libelleMois(mois)} seront payés sur {libelleMois(decalageMois(mois.annee, mois.mois, 1))}.
        </div>
      </div>

      <div className="sans" style={{
        fontSize: 11, color: theme.textSoft, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 10, fontWeight: 600,
      }}>Mission</div>
      <div style={{
        background: theme.surface, borderRadius: 12,
        border: `1px solid ${theme.border}`, padding: "4px 16px", marginBottom: 20,
      }}>
        <ToggleRow label="Mission Grands Travaux" value={mois.enMission} onChange={upd("enMission")} accent={theme.green} />
        <NumberRow label="Nuits suppt travaux nuit" value={mois.supTravNuitCount ?? (mois.supTravNuit ? 1 : 0)}
          onChange={upd("supTravNuitCount")} suffix="n" hint={`${fr((mois.supTravNuitCount ?? (mois.supTravNuit ? 1 : 0)) * TAUX.supTravNuit)} €`} step={1} />
      </div>

      <div className="sans" style={{
        fontSize: 11, color: theme.textSoft, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 10, fontWeight: 600,
      }}>Primes</div>
      <div style={{
        background: theme.surface, borderRadius: 12,
        border: `1px solid ${theme.border}`, padding: "4px 16px", marginBottom: 20,
      }}>
        <MoneyRow label="Prime partage valeur" value={mois.ppv} onChange={upd("ppv")} />
        <MoneyRow label="Gratification excep." value={mois.gratif} onChange={upd("gratif")} />
        <MoneyRow label="La Prime" value={mois.laPrime} onChange={upd("laPrime")} />
        <MoneyRow label="Compte alloc nuit" value={mois.comptAllocNuit} onChange={upd("comptAllocNuit")} />
      </div>

      <div className="sans" style={{
        fontSize: 11, color: theme.textSoft, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 10, fontWeight: 600,
      }}>Extras</div>
      <div style={{
        background: theme.surface, borderRadius: 12,
        border: `1px solid ${theme.border}`, padding: "4px 16px",
      }}>
        <NumberRow label="Heures suppl. fêtes" value={mois.hsFetes} onChange={upd("hsFetes")} suffix="h"
          hint={`${fr(mois.hsFetes * 15.844)} €`} step={0.5} />
        <NumberRow label="H. sup normales inopinées" value={mois.hsNormales || 0} onChange={upd("hsNormales")} suffix="h"
          hint={`${fr((mois.hsNormales || 0) * TAUX.hsNormales)} €`} step={0.5} />
        <NumberRow label="Majoration 25% inopinées" value={mois.hsMaj25 || 0} onChange={upd("hsMaj25")} suffix="h"
          hint={`${fr((mois.hsMaj25 || 0) * TAUX.hsMaj25)} €`} step={0.5} />
        <NumberRow label="Prolong. accidentel" value={mois.prolongAccidentel || 0} onChange={upd("prolongAccidentel")} suffix="u"
          hint={`${fr((mois.prolongAccidentel || 0) * TAUX.prolongAccidentel)} €`} step={1} />
        <NumberRow label="Jours prime journ." value={mois.primeJournalière} onChange={upd("primeJournalière")} suffix="j"
          hint={`${fr(mois.primeJournalière * 17.83)} €`} step={1} />
      </div>
    </div>
  );
}

function MoneyRow({ label, value, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: `1px solid ${theme.borderLight}`,
    }}>
      <div className="sans" style={{ fontSize: 14, color: theme.text, flex: 1 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number" min={0} step={0.01} value={value || ""}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="sans tabular"
          style={{
            width: 90, border: `1px solid ${theme.border}`, borderRadius: 6,
            padding: "6px 8px", fontSize: 14, fontWeight: 500,
            textAlign: "right", outline: "none", background: "white",
          }}
        />
        <span className="sans" style={{ fontSize: 14, color: theme.textMute }}>€</span>
      </div>
    </div>
  );
}

function PercentRow({ label, value, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: `1px solid ${theme.borderLight}`,
    }}>
      <div className="sans" style={{ fontSize: 14, color: theme.text, flex: 1 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number" min={0} step={0.1} value={value ?? 0}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="sans tabular"
          style={{
            width: 72, border: `1px solid ${theme.border}`, borderRadius: 6,
            padding: "6px 8px", fontSize: 14, fontWeight: 500,
            textAlign: "right", outline: "none", background: "white",
          }}
        />
        <span className="sans" style={{ fontSize: 14, color: theme.textMute }}>%</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DÉTAIL — Bulletin décomposé
// ══════════════════════════════════════════════════════════════════════════════
function DetailTab({ res, cfg, mois }) {
  return (
    <div className="fade-in" style={{ paddingTop: 24 }}>

      <div style={{
        background: theme.surfaceAlt,
        borderRadius: 12,
        padding: "12px 14px",
        border: `1px solid ${theme.borderLight}`,
        marginBottom: 16,
      }}>
        <div className="sans" style={{ fontSize: 10, color: theme.textSoft, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
          EVS M+1
        </div>
        <div className="sans" style={{ fontSize: 12, color: theme.textMute, lineHeight: 1.5 }}>
          Détail de paie {libelleMois(res.moisPaie)} avec EVS de {libelleMois(res.moisEVS)}.
        </div>
      </div>

      <DetailSection titre="Gains" couleur={theme.green}>
        <DetailRow label="Traitement" value={res.traitement} bold />
        <DetailRow label="Indemnité résidence" value={res.indResidence} />
        <DetailRow label="Complément IR" value={res.complementIR} />
        {res.indEloign > 0 && <DetailRow label="Ind. éloignement chantier" value={res.indEloign} />}
        {res.indConduite > 0 && <DetailRow label="Ind. conduite voiture" value={res.indConduite} />}
        {res.indCompensRepos > 0 && <DetailRow label="Ind. compens. repos zone infra" value={res.indCompensRepos} />}
        {res.indTrvNuit > 0 && <DetailRow label="Ind. travail de nuit" value={res.indTrvNuit} />}
        {res.indTrvNuit2 > 0 && <DetailRow label="Ind. nuit taux 2" value={res.indTrvNuit2} />}
        {res.indMilieuNuit > 0 && <DetailRow label="Ind. milieu de nuit" value={res.indMilieuNuit} />}
        {res.indDimFeries > 0 && <DetailRow label="Ind. dim / fériés" value={res.indDimFeries} />}
        {res.indSpecNuit > 0 && <DetailRow label="Ind. spéciale nuit taux A" value={res.indSpecNuit} />}
        {res.indSupTrvNuit > 0 && <DetailRow label="Ind. suppt travaux nuit" value={res.indSupTrvNuit} />}
        {res.indHSFetes > 0 && <DetailRow label="Ind. hrs suppl fêtes" value={res.indHSFetes} />}
        {res.indHSNormales > 0 && <DetailRow label="H. sup normales inopinées" value={res.indHSNormales} />}
        {res.indHSMaj25 > 0 && <DetailRow label="Majoration 25% inopinées" value={res.indHSMaj25} />}
        {res.indProlongAcc > 0 && <DetailRow label="Prolong. accidentel durée travail" value={res.indProlongAcc} />}
        {res.primeJournTotal > 0 && <DetailRow label="Prime journalière" value={res.primeJournTotal} />}
        <DetailRow label="Prime travail journalière" value={res.primeTrav} />
        {res.complAllocNuitSed > 0 && <DetailRow label="Compl. alloc nuit sédentaire" value={res.complAllocNuitSed} />}
        {res.comptAllocNuit > 0 && <DetailRow label="Compte alloc nuit" value={res.comptAllocNuit} />}
        <DetailRow label="Avantage nature" value={res.avNature} />
        {res.ppv > 0 && <DetailRow label="Prime partage valeur" value={res.ppv} />}
        {res.gratif > 0 && <DetailRow label="Gratification" value={res.gratif} />}
        {res.laPrime > 0 && <DetailRow label="La Prime" value={res.laPrime} />}
        {res.ich > 0 && <DetailRow label="ICH (Contrainte hébergement)" value={res.ich} />}
        {res.indJrLog > 0 && <DetailRow label="Ind. contrainte logement" value={res.indJrLog} />}
        <DetailTotal label="Salaire brut" value={res.brut} />
      </DetailSection>

      <DetailSection titre="Allocations déplacement" couleur={theme.blue}>
        <DetailRow label={`${res.découchers} découchers`} value={res.allocDepl} sub="Taux ODS J1-J10 : 92,76€ · J11-J30 : 83,36€ · au-delà : 74,16€" />
        {res.allocNuitSed > 0 && <DetailRow label="Alloc. nuit sédentaire" value={res.allocNuitSed} />}
        <DetailTotal label="Total non imposable" value={res.allocDepl + res.allocNuitSed} />
      </DetailSection>

      <DetailSection titre="Cotisations salariales" couleur={theme.red}>
        <DetailRow label="Santé + prévoyance" value={res.cprP + res.prevT1 + res.santeSol + res.santeForf + res.santeT1} negative />
        <DetailRow label="CPR Retraite (9,06%)" value={res.cprRet} negative />
        {(res.cotSNCF + res.chom) !== 0 && <DetailRow label="AT/MP + Chômage" value={res.cotSNCF + res.chom} negative />}
        <DetailRow label="CSG / CRDS" value={res.csgDed + res.csgCrds} negative />
        <DetailTotal label="Total cotisations" value={res.totalCotis} negative />
      </DetailSection>

      <div style={{
        background: theme.text, color: "white",
        borderRadius: 20, padding: "24px 20px",
      }}>
        <div className="sans" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Résultat final</div>
        <FinalRow label="Net social" value={res.netSocial} />
        <FinalRow label="+ Allocations" value={res.allocDepl + res.allocNuitSed} />
        <FinalRow label="Net avant impôt" value={res.netAvantImpot} bold />
        <FinalRow label={`PAS (${fr(res.tauxPAS)}%)`} value={res.impot} />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 10, paddingTop: 14,
          display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="sans" style={{ fontSize: 14, fontWeight: 600 }}>Net à payer</span>
          <span className="serif tabular" style={{ fontSize: 28, letterSpacing: -1 }}>{fr(res.netAPayer)} €</span>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ titre, couleur, children }) {
  return (
    <div style={{
      background: theme.surface, borderRadius: 16,
      border: `1px solid ${theme.border}`,
      marginBottom: 16, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 20px 8px" }}>
        <div className="sans" style={{
          fontSize: 10, color: couleur, letterSpacing: 1.5,
          textTransform: "uppercase", fontWeight: 700,
        }}>{titre}</div>
      </div>
      <div style={{ padding: "0 20px 12px" }}>{children}</div>
    </div>
  );
}

function DetailRow({ label, value, sub, negative, bold }) {
  const displayValue = negative ? "−" + euro(value) : euro(value);
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: sub ? "flex-start" : "center",
      padding: "8px 0",
      borderBottom: `1px solid ${theme.borderLight}`,
    }}>
      <div style={{ flex: 1, paddingRight: 8 }}>
        <div className="sans" style={{
          fontSize: 13, color: theme.text, fontWeight: bold ? 600 : 400,
        }}>{label}</div>
        {sub && <div className="sans" style={{ fontSize: 10, color: theme.textSoft, marginTop: 2 }}>{sub}</div>}
      </div>
      <span className="sans tabular" style={{
        fontSize: 13, color: negative ? theme.red : theme.text,
        fontWeight: bold ? 700 : 500,
      }}>{displayValue}</span>
    </div>
  );
}

function DetailTotal({ label, value, negative }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "10px 0 2px", marginTop: 4,
      borderTop: `1px solid ${theme.border}`,
    }}>
      <span className="sans" style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{label}</span>
      <span className="sans tabular" style={{
        fontSize: 14, fontWeight: 700,
        color: negative ? theme.red : theme.text,
      }}>{negative ? "−" : ""}{euro(value)}</span>
    </div>
  );
}

function FinalRow({ label, value, bold }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "6px 0",
    }}>
      <span className="sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span className="sans tabular" style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: "white" }}>
        {value < 0 ? "−" : ""}{euro(value)}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════════════════
function ConfigTab({ cfg, setCfg }) {
  const upd = (k) => (v) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="fade-in" style={{ paddingTop: 24 }}>
      <div className="sans" style={{
        fontSize: 11, color: theme.textSoft, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 10, fontWeight: 600,
      }}>Impôt sur le revenu</div>
      <div style={{
        background: theme.surface, borderRadius: 12,
        border: `1px solid ${theme.border}`, padding: "4px 16px", marginBottom: 20,
      }}>
        <PercentRow label="Taux PAS" value={cfg.tauxPAS} onChange={upd("tauxPAS")} />
      </div>

      <div className="sans" style={{
        fontSize: 11, color: theme.textSoft, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 10, fontWeight: 600,
      }}>Traitement & échelon</div>
      <div style={{
        background: theme.surface, borderRadius: 12,
        border: `1px solid ${theme.border}`, padding: "4px 16px", marginBottom: 20,
      }}>
        <MoneyRow label="Traitement" value={cfg.traitement} onChange={upd("traitement")} />
        <MoneyRow label="Ind. résidence" value={cfg.indResidence} onChange={upd("indResidence")} />
        <MoneyRow label="Complément IR" value={cfg.complementIR} onChange={upd("complementIR")} />
        <MoneyRow label="Prime travail / jour" value={cfg.primeTravailJour} onChange={upd("primeTravailJour")} />
        <MoneyRow label="Ind. éloignement mensuelle" value={cfg.indEloignementMensuel} onChange={upd("indEloignementMensuel")} />
      </div>

      <div className="sans" style={{
        fontSize: 11, color: theme.textSoft, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 10, fontWeight: 600,
      }}>Droits ouverts (à vérifier avec RH)</div>
      <div style={{
        background: theme.surface, borderRadius: 12,
        border: `1px solid ${theme.border}`, padding: "4px 16px",
      }}>
        <ToggleRow label="ICH (Ind. Contrainte Hébergement)" value={cfg.droitICH} onChange={upd("droitICH")} />
        <ToggleRow label="Ind. contrainte logement travaux" value={cfg.droitIndJr} onChange={upd("droitIndJr")} />
      </div>

      <div style={{
        marginTop: 20, padding: "14px 16px",
        background: "#fef3c7", borderRadius: 12,
        border: `1px solid #fde68a`,
      }}>
        <div className="sans" style={{ fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
          ⚠ L'ICH est réglée à 21,90 €/nuit d'après le RH00010 groupe 1. L'Ind. contrainte logement reste à 12,32 €/j. Les autres barèmes courants demandent encore le GRH00372 / GRH00389.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOTTOM NAV
// ══════════════════════════════════════════════════════════════════════════════
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "home", label: "Accueil", icon: "M3 12l9-9 9 9v9a2 2 0 01-2 2h-4a1 1 0 01-1-1v-5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5a1 1 0 01-1 1H5a2 2 0 01-2-2v-9z" },
    { id: "planning", label: "Planning", icon: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" },
    { id: "extras", label: "Extras", icon: "M12 5v14M5 12h14" },
    { id: "detail", label: "Détail", icon: "M4 6h16M4 12h16M4 18h16" },
    { id: "config", label: "Config", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 440,
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: `1px solid ${theme.border}`,
      display: "flex",
      paddingBottom: "env(safe-area-inset-bottom, 0)",
      zIndex: 40,
    }}>
      {items.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className="btn-tap"
          style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            padding: "10px 4px 8px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={tab === id ? theme.text : theme.textSoft} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
          <span className="sans" style={{
            fontSize: 10, color: tab === id ? theme.text : theme.textSoft,
            fontWeight: tab === id ? 600 : 400, letterSpacing: 0.3,
          }}>{label}</span>
        </button>
      ))}
    </div>
  );
}


createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
