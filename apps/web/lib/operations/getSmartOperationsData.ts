import "server-only";

import {createAdminClient} from "@/lib/supabase/admin";

export type SmartOperationsFindingRow = {
  id: string;
  fingerprint: string;
  finding_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved";
  title: string;
  summary: string;
  recommendation: string;
  subject_type: string;
  subject_id: string | null;
  confidence: number | string;
  evidence: Record<string, unknown>;
  first_detected_at: string;
  last_detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
};


export type SmartOperationsPolicyRow = {
  policy_key: string;
  enabled: boolean;
  severity: "low" | "medium" | "high" | "critical";
  configuration: Record<string, unknown>;
};

export type SmartOperationsRunRow = {
  id: string;
  trigger_type: string;
  status: "running" | "completed" | "failed";
  rules_evaluated: number;
  findings_opened: number;
  findings_refreshed: number;
  findings_auto_resolved: number;
  health_score: number | null;
  summary: Record<string, unknown>;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

export async function getSmartOperationsData() {
  const admin = createAdminClient();

  const [findingsResult, runsResult, policiesResult] = await Promise.all([
    admin
      .from("smart_operations_ai_findings")
      .select(
        "id,fingerprint,finding_type,severity,status,title,summary,recommendation,subject_type,subject_id,confidence,evidence,first_detected_at,last_detected_at,acknowledged_at,resolved_at,resolution_note"
      )
      .eq("organization_id", "kalabsha-airlines")
      .order("last_detected_at", {ascending: false})
      .limit(100),
    admin
      .from("smart_operations_ai_runs")
      .select(
        "id,trigger_type,status,rules_evaluated,findings_opened,findings_refreshed,findings_auto_resolved,health_score,summary,error,started_at,completed_at"
      )
      .eq("organization_id", "kalabsha-airlines")
      .order("started_at", {ascending: false})
      .limit(20),
    admin
      .from("smart_operations_ai_policies")
      .select("policy_key,enabled,severity,configuration")
      .eq("organization_id", "kalabsha-airlines")
      .order("policy_key", {ascending: true})
  ]);

  const firstError =
    findingsResult.error ?? runsResult.error ?? policiesResult.error;

  if (firstError) {
    throw new Error(
      `Unable to load Smart Operations AI: ${firstError.message}`
    );
  }

  const findings =
    (findingsResult.data ?? []) as unknown as SmartOperationsFindingRow[];
  const runs = (runsResult.data ?? []) as unknown as SmartOperationsRunRow[];
  const policies =
    (policiesResult.data ?? []) as unknown as SmartOperationsPolicyRow[];
  const activeFindings = findings.filter(
    (finding) => finding.status !== "resolved"
  );

  const severityCounts = {
    critical: activeFindings.filter(
      (finding) => finding.severity === "critical"
    ).length,
    high: activeFindings.filter((finding) => finding.severity === "high").length,
    medium: activeFindings.filter(
      (finding) => finding.severity === "medium"
    ).length,
    low: activeFindings.filter((finding) => finding.severity === "low").length
  };

  const latestRun = runs[0] ?? null;
  const healthScore =
    latestRun?.health_score ??
    Math.max(
      0,
      100 -
        severityCounts.critical * 30 -
        severityCounts.high * 15 -
        severityCounts.medium * 7 -
        severityCounts.low * 2
    );

  return {
    findings,
    activeFindings,
    runs,
    latestRun,
    policies,
    healthScore,
    severityCounts
  };
}
