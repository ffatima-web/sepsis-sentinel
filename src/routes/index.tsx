import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock3,
  RefreshCw,
  Settings2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";

type PatientList = { septic_patients: string[]; non_septic_patients: string[] };
type Vitals = {
  patient_id: string;
  hours: number[];
  HR: number[];
  Resp: number[];
  Temp: number[];
  SBP: number[];
  MAP: number[];
  SepsisLabel: number[];
};
type Tier = "URGENT" | "ELEVATED" | "ROUTINE";
type Triage = {
  vitals_flags: {
    qsofa_score: number;
    sirs_score: number;
    resp_high: boolean;
    sbp_low: boolean;
    temp_abnormal: boolean;
    hr_high: boolean;
  };
  risk_result: { current_risk_score: number; escalated: boolean; risk_trend: number[] };
  alert: { tier: Tier; reasoning: string; action_recommended: string };
  patient_id: string;
  hour: number;
};

const DEFAULT_API = "http://localhost:8000";
const patientFallback: PatientList = {
  septic_patients: ["p000009", "p000143", "p000271"],
  non_septic_patients: ["p000032", "p000118", "p000406"],
};

function makeVitals(patientId: string): Vitals {
  const urgent = patientId === "p000009" || patientId === "p000143";
  const elevated = patientId === "p000271";
  const hours = Array.from({ length: 25 }, (_, index) => 234 + index);
  const wave = (index: number) => Math.sin(index / 2.1);
  return {
    patient_id: patientId,
    hours,
    HR: hours.map((_, index) => Math.round((urgent ? 91 + index * 1.3 : elevated ? 88 + index * 0.65 : 76) + wave(index) * 4)),
    Resp: hours.map((_, index) => Math.round((urgent ? 20 + index * 0.28 : elevated ? 19 + index * 0.17 : 16) + wave(index + 1) * 1.4)),
    Temp: hours.map((_, index) => Number(((urgent ? 37.3 + index * 0.055 : elevated ? 37.2 + index * 0.025 : 36.8) + wave(index) * 0.12).toFixed(1))),
    SBP: hours.map((_, index) => Math.round((urgent ? 116 - index * 0.9 : elevated ? 121 - index * 0.35 : 124) + wave(index + 2) * 3)),
    MAP: hours.map((_, index) => Math.round((urgent ? 82 - index * 0.55 : 86) + wave(index) * 2)),
    SepsisLabel: hours.map((_, index) => (urgent && index >= 21 ? 1 : 0)),
  };
}

function makeTriage(patientId: string): Triage {
  const urgent = patientId === "p000009" || patientId === "p000143";
  const elevated = patientId === "p000271";
  const tier: Tier = urgent ? "URGENT" : elevated ? "ELEVATED" : "ROUTINE";
  const risk = urgent ? 0.884 : elevated ? 0.624 : 0.118;
  return {
    patient_id: patientId,
    hour: 258,
    vitals_flags: {
      qsofa_score: urgent ? 2 : elevated ? 1 : 0,
      sirs_score: urgent ? 3 : elevated ? 2 : 0,
      resp_high: urgent || elevated,
      sbp_low: urgent,
      temp_abnormal: urgent,
      hr_high: urgent || elevated,
    },
    risk_result: { current_risk_score: risk, escalated: urgent, risk_trend: [risk - 0.06, risk - 0.03, risk] },
    alert: {
      tier,
      reasoning: urgent
        ? "Concurrent tachycardia, tachypnea, fever, and a sustained decline in systolic pressure indicate worsening physiologic instability. The rising model risk and qSOFA score support immediate bedside reassessment for evolving sepsis."
        : elevated
          ? "Respiratory rate and heart rate are trending above baseline with a moderate rise in predicted risk. Current blood pressure remains preserved, but the pattern warrants closer surveillance."
          : "Vital signs remain within expected ranges without a sustained adverse trend. Current screening scores and model risk do not indicate physiologic deterioration.",
      action_recommended: urgent
        ? "Initiate sepsis protocol now. Notify the critical care team, obtain lactate and cultures, and assess fluid responsiveness."
        : elevated
          ? "Repeat complete vital assessment within 30 minutes and review recent labs, fluid balance, and suspected infection source."
          : "Continue routine ICU monitoring and reassess with the next scheduled observation set.",
    },
  };
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sepsis Triage | ICU Early Warning" },
      { name: "description", content: "Monitor ICU vital trends, sepsis risk, and clinical escalation guidance." },
      { property: "og:title", content: "Sepsis Triage | ICU Early Warning" },
      { property: "og:description", content: "Monitor ICU vital trends, sepsis risk, and clinical escalation guidance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SepsisDashboard,
});

function SepsisDashboard() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [draftApiUrl, setDraftApiUrl] = useState(DEFAULT_API);
  const [patients, setPatients] = useState(patientFallback);
  const [patientId, setPatientId] = useState(patientFallback.septic_patients[0]);
  const [vitals, setVitals] = useState(() => makeVitals(patientFallback.septic_patients[0]));
  const [triage, setTriage] = useState(() => makeTriage(patientFallback.septic_patients[0]));
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("sepsis-triage-api-url");
    if (saved) {
      setApiUrl(saved);
      setDraftApiUrl(saved);
    }
  }, []);

  async function loadPatient(nextId: string, baseUrl = apiUrl) {
    setLoading(true);
    setPatientId(nextId);
    try {
      const cleanUrl = baseUrl.replace(/\/$/, "");
      const [vitalsResponse, triageResponse] = await Promise.all([
        fetch(`${cleanUrl}/patient/${encodeURIComponent(nextId)}/vitals`),
        fetch(`${cleanUrl}/patient/${encodeURIComponent(nextId)}/triage`),
      ]);
      if (!vitalsResponse.ok || !triageResponse.ok) throw new Error("Patient API unavailable");
      const [nextVitals, nextTriage] = await Promise.all([
        vitalsResponse.json() as Promise<Vitals>,
        triageResponse.json() as Promise<Triage>,
      ]);
      setVitals(nextVitals);
      setTriage(nextTriage);
      setSource("live");
    } catch {
      setVitals(makeVitals(nextId));
      setTriage(makeTriage(nextId));
      setSource("demo");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll(baseUrl = apiUrl) {
    setLoading(true);
    try {
      const cleanUrl = baseUrl.replace(/\/$/, "");
      const response = await fetch(`${cleanUrl}/patients?limit=10`);
      if (!response.ok) throw new Error("Patient list unavailable");
      const nextPatients = (await response.json()) as PatientList;
      setPatients(nextPatients);
      const allIds = [...nextPatients.septic_patients, ...nextPatients.non_septic_patients];
      const nextId = allIds.includes(patientId) ? patientId : allIds[0];
      if (nextId) await loadPatient(nextId, baseUrl);
    } catch {
      setPatients(patientFallback);
      setSource("demo");
      await loadPatient(patientId, baseUrl);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll(apiUrl);
    // API preference should trigger the initial refresh only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  function saveApiUrl() {
    const nextUrl = draftApiUrl.trim() || DEFAULT_API;
    window.localStorage.setItem("sepsis-triage-api-url", nextUrl);
    setApiUrl(nextUrl);
    setSettingsOpen(false);
  }

  const latest = vitals.hours.length - 1;
  const chartData = useMemo(
    () => vitals.hours.map((hour, index) => ({ hour, HR: vitals.HR[index], Resp: vitals.Resp[index], Temp: vitals.Temp[index], SBP: vitals.SBP[index] })),
    [vitals],
  );
  const tierClass = triage.alert.tier === "URGENT" ? "border-chart-3 text-chart-3" : triage.alert.tier === "ELEVATED" ? "border-chart-2 text-chart-2" : "border-primary text-primary";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-7">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-sm border border-primary/35 bg-primary/10 text-primary"><Activity size={20} aria-hidden="true" /></div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Sepsis Triage</h1>
              <p className="text-xs text-muted-foreground">ICU early-warning monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 border border-border bg-background px-3 text-xs text-muted-foreground" role="status">
              {source === "live" ? <Wifi size={14} className="text-primary" /> : <WifiOff size={14} className="text-chart-2" />}
              <span>{source === "live" ? "Live API" : "Demo fallback"}</span>
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh patient data" title="Refresh patient data" onClick={() => void refreshAll()} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </Button>
            <Button variant="outline" size="icon" aria-label="API settings" title="API settings" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-7">
        <section className="mb-5 grid gap-4 border-b border-border pb-5 lg:grid-cols-[minmax(280px,0.9fr)_2fr] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Patient record</span>
            <div className="relative">
              <select value={patientId} onChange={(event) => void loadPatient(event.target.value)} disabled={loading} className="h-12 w-full appearance-none border border-border bg-card px-4 pr-10 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary">
                <optgroup label="Developed sepsis">{patients.septic_patients.map((id) => <option key={id} value={id}>{id}</option>)}</optgroup>
                <optgroup label="No sepsis">{patients.non_septic_patients.map((id) => <option key={id} value={id}>{id}</option>)}</optgroup>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-4 top-4 text-muted-foreground" />
            </div>
          </label>
          <div className={`border-l-4 bg-card px-5 py-4 ${tierClass}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Current alert tier</p>
                <p className="mt-1 font-mono text-2xl font-semibold">{triage.alert.tier}</p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><Clock3 size={14} /><span>ICU hour {triage.hour}</span></div>
            </div>
          </div>
        </section>

        <section aria-label="Current patient measurements" className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-7">
          <VitalReadout label="Heart rate" value={vitals.HR[latest]} unit="bpm" flagged={triage.vitals_flags.hr_high} />
          <VitalReadout label="Respiratory rate" value={vitals.Resp[latest]} unit="/min" flagged={triage.vitals_flags.resp_high} />
          <VitalReadout label="Temperature" value={vitals.Temp[latest]?.toFixed(1)} unit="°C" flagged={triage.vitals_flags.temp_abnormal} />
          <VitalReadout label="Systolic BP" value={vitals.SBP[latest]} unit="mmHg" flagged={triage.vitals_flags.sbp_low} />
          <VitalReadout label="qSOFA" value={triage.vitals_flags.qsofa_score} unit="/ 3" flagged={triage.vitals_flags.qsofa_score >= 2} compact />
          <VitalReadout label="SIRS" value={triage.vitals_flags.sirs_score} unit="/ 4" flagged={triage.vitals_flags.sirs_score >= 2} compact />
          <VitalReadout label="ML risk" value={`${(triage.risk_result.current_risk_score * 100).toFixed(1)}`} unit="%" flagged={triage.risk_result.escalated} compact />
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
          <section className="border border-border bg-card" aria-labelledby="trends-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div><h2 id="trends-heading" className="font-medium">Vital sign trends</h2><p className="mt-1 text-xs text-muted-foreground">Continuous observation across the latest 24 ICU hours</p></div>
              <span className="font-mono text-xs text-muted-foreground">Hour {vitals.hours[0]}–{vitals.hours[latest]}</span>
            </div>
            <div className="h-[420px] w-full p-3 sm:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 5" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--muted-foreground)" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                  <YAxis yAxisId="main" domain={[0, 140]} stroke="var(--muted-foreground)" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="temp" orientation="right" domain={[35, 41]} stroke="var(--muted-foreground)" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, fontFamily: "IBM Plex Mono", fontSize: 12 }} labelStyle={{ color: "var(--foreground)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
                  <Line yAxisId="main" type="monotone" dataKey="HR" name="HR (bpm)" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Line yAxisId="main" type="monotone" dataKey="Resp" name="Resp (/min)" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line yAxisId="temp" type="monotone" dataKey="Temp" name="Temp (°C)" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                  <Line yAxisId="main" type="monotone" dataKey="SBP" name="SBP (mmHg)" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <aside className="border border-border bg-card" aria-labelledby="assessment-heading">
            <div className="border-b border-border px-5 py-4"><h2 id="assessment-heading" className="font-medium">Clinical assessment</h2><p className="mt-1 text-xs text-muted-foreground">Decision support summary</p></div>
            <div className="space-y-6 p-5">
              <div><h3 className="text-xs font-medium text-muted-foreground">Clinical reasoning</h3><p className="mt-3 text-sm leading-6 text-foreground/90">{triage.alert.reasoning}</p></div>
              <div className={`border-l-4 bg-background p-4 ${tierClass}`}>
                <h3 className="text-xs font-medium text-muted-foreground">Recommended action</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-foreground">{triage.alert.action_recommended}</p>
              </div>
              <div className="border-t border-border pt-5">
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Risk trajectory</span><span className={triage.risk_result.escalated ? "text-chart-3" : "text-primary"}>{triage.risk_result.escalated ? "Escalating" : "Stable"}</span></div>
                <div className="mt-3 flex h-8 items-end gap-1" aria-label="Recent risk scores">
                  {triage.risk_result.risk_trend.map((risk, index) => <div key={`${risk}-${index}`} className="min-h-1 flex-1 bg-primary/50" style={{ height: `${Math.max(8, risk * 100)}%` }} />)}
                </div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">Clinical decision support only. Findings require clinician review and do not replace bedside assessment.</p>
            </div>
          </aside>
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="w-full max-w-lg border border-border bg-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 id="settings-title" className="font-medium">API connection</h2><p className="mt-1 text-xs text-muted-foreground">FastAPI service address</p></div><Button variant="ghost" size="icon" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={17} /></Button></div>
            <div className="p-5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="api-url">API base URL</label>
              <input id="api-url" value={draftApiUrl} onChange={(event) => setDraftApiUrl(event.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3 font-mono text-sm text-foreground outline-none focus:border-primary" placeholder={DEFAULT_API} />
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" /><span>If this service cannot be reached, the dashboard automatically uses realistic demonstration records.</span></div>
              <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={saveApiUrl}>Save and connect</Button></div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function VitalReadout({ label, value, unit, flagged, compact = false }: { label: string; value: string | number | undefined; unit: string; flagged: boolean; compact?: boolean }) {
  return (
    <article className="min-h-32 bg-card px-4 py-4">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><span className={`size-2 rounded-full ${flagged ? "monitor-pulse bg-chart-3" : "bg-primary"}`} aria-label={flagged ? "Outside expected range" : "Within expected range"} /></div>
      <div className="mt-5 flex items-baseline gap-2 whitespace-nowrap"><span className={`font-mono font-medium leading-none ${flagged ? "text-chart-3" : "text-foreground"} ${compact ? "text-4xl" : "text-[2.65rem]"}`}>{value ?? "—"}</span><span className="font-mono text-xs text-muted-foreground">{unit}</span></div>
    </article>
  );
}