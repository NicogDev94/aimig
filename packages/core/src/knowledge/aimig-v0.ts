import type {
  EvidenceRef,
  KnowledgeAssertion,
  KnowledgeBase,
} from '../domain/knowledge.js';
import { CONCEPTS as C } from './concepts.js';

/**
 * Every reference here is synthetic.
 *
 * They are structured rather than free text so that `Why?` and `Why changed?`
 * can reach a citable object — the shape is the point, not the content. Real
 * references would be mapped in the same shape; nothing in the engine changes.
 */
const SYNTHETIC = 'AIMIG synthetic reference set';

function ev(id: string, title: string, section?: string): EvidenceRef {
  return {
    id,
    title,
    publisher: SYNTHETIC,
    version: '0.1',
    ...(section === undefined ? {} : { locator: { section } }),
  };
}

const EV = {
  spiroHyperk: ev('ev-syn-01', 'Potassium-sparing diuretics and serum potassium', '2.1'),
  aceiHyperk: ev('ev-syn-02', 'RAAS inhibition and potassium handling', '3.4'),
  nsaidHyperk: ev('ev-syn-03', 'NSAIDs and renal potassium excretion', '1.2'),
  renalHyperk: ev('ev-syn-04', 'Renal function and potassium clearance', '4.0'),
  potassiumBands: ev('ev-syn-05', 'Serum potassium reference bands', 'Table 1'),
  egfrBands: ev('ev-syn-06', 'eGFR staging of renal impairment', 'Table 2'),
  warfarinBleed: ev('ev-syn-07', 'Vitamin K antagonists and bleeding risk', '5.1'),
  amiodaroneBleed: ev('ev-syn-08', 'Amiodarone–warfarin interaction', '5.3'),
  inrBands: ev('ev-syn-09', 'INR therapeutic and supratherapeutic ranges', 'Table 3'),
  overAntiBleed: ev('ev-syn-10', 'Supratherapeutic INR and bleeding events', '6.2'),
  monitoring: ev('ev-syn-11', 'Monitoring requirements for high-risk medicines', '7.0'),
  actions: ev('ev-syn-12', 'Escalation thresholds for medication review', '8.0'),
  aggregation: ev('ev-syn-13', 'Additive risk-factor scoring (synthetic)', '9.0'),
  conflicts: ev('ev-syn-14', 'Analytical variation limits (synthetic)', '10.0'),
} as const;

function risk(
  id: string,
  subject: KnowledgeAssertion['subject'],
  object: KnowledgeAssertion['object'],
  strength: KnowledgeAssertion['strength'],
  evidence: EvidenceRef,
): KnowledgeAssertion {
  return { id, subject, predicate: 'increases_risk_of', object, strength, evidence: [evidence] };
}

/**
 * The Milestone 0 knowledge base.
 *
 * Two independent chains on purpose — hyperkalemia and bleeding. Independence
 * is what makes the `no-change` benchmark category meaningful: correcting a
 * potassium value must leave the bleeding conclusion structurally identical,
 * down to its node id.
 */
export const AIMIG_KB_V0: KnowledgeBase = {
  version: 'aimig-kb-v0.1',

  validation: {
    scope: 'reasoning_mechanics_only',
    clinicalValidity: 'unvalidated',
    notice:
      'Synthetic research rule set. Not clinically validated. Not for clinical use.',
  },

  assertions: [
    risk('ka-spiro-hyperk', C.spironolactone, C.hyperkalemia, 'strong', EV.spiroHyperk),
    risk('ka-ramipril-hyperk', C.ramipril, C.hyperkalemia, 'moderate', EV.aceiHyperk),
    risk('ka-ibuprofen-hyperk', C.ibuprofen, C.hyperkalemia, 'weak', EV.nsaidHyperk),
    risk('ka-renal-hyperk', C.renal_impairment, C.hyperkalemia, 'strong', EV.renalHyperk),
    risk('ka-warfarin-bleed', C.warfarin, C.bleeding, 'strong', EV.warfarinBleed),
    risk('ka-amiodarone-bleed', C.amiodarone, C.bleeding, 'moderate', EV.amiodaroneBleed),
    risk('ka-overanti-bleed', C.over_anticoagulation, C.bleeding, 'strong', EV.overAntiBleed),
    {
      id: 'ka-spiro-monitor-k',
      subject: C.spironolactone,
      predicate: 'requires_monitoring_of',
      object: C.potassium,
      strength: 'strong',
      evidence: [EV.monitoring],
    },
    {
      id: 'ka-warfarin-monitor-inr',
      subject: C.warfarin,
      predicate: 'requires_monitoring_of',
      object: C.inr,
      strength: 'strong',
      evidence: [EV.monitoring],
    },
  ],

  // `min` inclusive, `max` exclusive. A value matching no band concludes nothing —
  // silence is not a conclusion.
  bands: [
    {
      id: 'band-k-mild',
      analyte: C.potassium,
      unit: 'mmol/L',
      min: 5.0,
      max: 5.5,
      conclusion: C.hyperkalemia,
      severity: 'mild',
      evidence: [EV.potassiumBands],
    },
    {
      id: 'band-k-moderate',
      analyte: C.potassium,
      unit: 'mmol/L',
      min: 5.5,
      max: 6.0,
      conclusion: C.hyperkalemia,
      severity: 'moderate',
      evidence: [EV.potassiumBands],
    },
    {
      id: 'band-k-severe',
      analyte: C.potassium,
      unit: 'mmol/L',
      min: 6.0,
      conclusion: C.hyperkalemia,
      severity: 'severe',
      evidence: [EV.potassiumBands],
    },
    {
      id: 'band-egfr-severe',
      analyte: C.egfr,
      unit: 'mL/min',
      max: 30,
      conclusion: C.renal_impairment,
      severity: 'severe',
      evidence: [EV.egfrBands],
    },
    {
      id: 'band-egfr-moderate',
      analyte: C.egfr,
      unit: 'mL/min',
      min: 30,
      max: 60,
      conclusion: C.renal_impairment,
      severity: 'moderate',
      evidence: [EV.egfrBands],
    },
    {
      id: 'band-inr-moderate',
      analyte: C.inr,
      unit: 'ratio',
      min: 3.0,
      max: 4.0,
      conclusion: C.over_anticoagulation,
      severity: 'moderate',
      evidence: [EV.inrBands],
    },
    {
      id: 'band-inr-severe',
      analyte: C.inr,
      unit: 'ratio',
      min: 4.0,
      conclusion: C.over_anticoagulation,
      severity: 'severe',
      evidence: [EV.inrBands],
    },
  ],

  aggregations: [
    {
      id: 'agg-hyperkalemia',
      target: 'hyperkalemia',
      conclusionKey: 'hyperkalemia_concern',
      label: 'Hyperkalemia concern',
      levels: [
        { level: 'LOW', minScore: 1 },
        { level: 'MODERATE', minScore: 4 },
        { level: 'HIGH', minScore: 8 },
      ],
      evidence: [EV.aggregation],
    },
    {
      id: 'agg-bleeding',
      target: 'bleeding',
      conclusionKey: 'bleeding_concern',
      label: 'Bleeding concern',
      levels: [
        { level: 'LOW', minScore: 1 },
        { level: 'MODERATE', minScore: 4 },
        { level: 'HIGH', minScore: 8 },
      ],
      evidence: [EV.aggregation],
    },
  ],

  scoring: {
    strengthPoints: { weak: 1, moderate: 2, strong: 3 },
    severityPoints: { mild: 1, moderate: 2, severe: 3 },
  },

  actions: [
    {
      id: 'act-hyperk-high',
      whenConclusion: 'hyperkalemia_concern',
      whenLevel: 'HIGH',
      actionKey: 'medication_review',
      actionLabel: 'Urgent medication review',
      urgency: 'HIGH',
      evidence: [EV.actions],
    },
    {
      id: 'act-hyperk-moderate',
      whenConclusion: 'hyperkalemia_concern',
      whenLevel: 'MODERATE',
      actionKey: 'medication_review',
      actionLabel: 'Medication review',
      urgency: 'MODERATE',
      evidence: [EV.actions],
    },
    {
      id: 'act-hyperk-low',
      whenConclusion: 'hyperkalemia_concern',
      whenLevel: 'LOW',
      actionKey: 'monitor_potassium',
      actionLabel: 'Continue potassium monitoring',
      urgency: 'LOW',
      evidence: [EV.actions],
    },
    {
      id: 'act-bleed-high',
      whenConclusion: 'bleeding_concern',
      whenLevel: 'HIGH',
      actionKey: 'anticoagulation_review',
      actionLabel: 'Urgent anticoagulation review',
      urgency: 'HIGH',
      evidence: [EV.actions],
    },
    {
      id: 'act-bleed-moderate',
      whenConclusion: 'bleeding_concern',
      whenLevel: 'MODERATE',
      actionKey: 'anticoagulation_review',
      actionLabel: 'Anticoagulation review',
      urgency: 'MODERATE',
      evidence: [EV.actions],
    },
    {
      id: 'act-bleed-low',
      whenConclusion: 'bleeding_concern',
      whenLevel: 'LOW',
      actionKey: 'monitor_inr',
      actionLabel: 'Continue INR monitoring',
      urgency: 'LOW',
      evidence: [EV.actions],
    },
  ],

  conflicts: [
    { id: 'cf-potassium', analyte: C.potassium, tolerance: 0.5, withinDays: 7 },
    { id: 'cf-egfr', analyte: C.egfr, tolerance: 10, withinDays: 30 },
    { id: 'cf-inr', analyte: C.inr, tolerance: 0.5, withinDays: 7 },
  ],

  ordinalScales: [
    { attribute: 'severity', order: ['mild', 'moderate', 'severe'] },
    { attribute: 'level', order: ['LOW', 'MODERATE', 'HIGH'] },
    { attribute: 'urgency', order: ['LOW', 'MODERATE', 'HIGH'] },
  ],
};
