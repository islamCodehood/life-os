import type { ActivityProgressMetrics } from '@/src/domain/activity/progress';
import type { ObservationResult } from '@/src/domain/graduation/monitoring';
import type { ActivityAssignmentId, ChildId, FamilyId, GuardianId } from '@/src/domain/shared/id';

export interface GraduationAssignment {
  id: ActivityAssignmentId;
  familyId: FamilyId;
  childId: ChildId;
  status: 'ACTIVE' | 'GRADUATED';
  version: number;
  scheduleTimezone: string;
  activeFrom: string;
}
export interface GraduationSuggestion {
  id: string;
  familyId: FamilyId;
  childId: ChildId;
  assignmentId: ActivityAssignmentId;
  graduationRecordId: string | null;
  kind: 'GRADUATION' | 'REACTIVATION';
  origin: 'GUARDIAN_REVIEW' | 'MONITORING_EVIDENCE';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'SNOOZED';
  createdAt: Date;
}
export interface GraduationRecord {
  id: string;
  familyId: FamilyId;
  childId: ChildId;
  assignmentId: ActivityAssignmentId;
  status: 'GRADUATED' | 'REACTIVATED';
  approvedAt: Date;
  monitoringIntervalDays: number;
  lastObservedAt: Date | null;
}
export interface GraduationObservation {
  id: string;
  observedAt: Date;
  result: ObservationResult;
}
export interface GraduationRepository {
  getAssignment(familyId: FamilyId, id: ActivityAssignmentId): Promise<GraduationAssignment | null>;
  getMakeBedAssignment(familyId: FamilyId, childId: ChildId): Promise<GraduationAssignment | null>;
  getSuggestion(familyId: FamilyId, id: string): Promise<GraduationSuggestion | null>;
  getPendingSuggestion(
    familyId: FamilyId,
    assignmentId: ActivityAssignmentId,
    kind: 'GRADUATION' | 'REACTIVATION',
  ): Promise<GraduationSuggestion | null>;
  createEvidenceSnapshot(input: {
    id: string;
    familyId: FamilyId;
    assignmentId: ActivityAssignmentId;
    metrics: ActivityProgressMetrics;
    capturedAt: Date;
  }): Promise<void>;
  createSuggestion(input: {
    id: string;
    familyId: FamilyId;
    childId: ChildId;
    assignmentId: ActivityAssignmentId;
    kind: 'GRADUATION' | 'REACTIVATION';
    origin: 'GUARDIAN_REVIEW' | 'MONITORING_EVIDENCE';
    evidenceSnapshotId?: string;
    graduationRecordId?: string;
    createdAt: Date;
  }): Promise<GraduationSuggestion>;
  decideSuggestion(
    familyId: FamilyId,
    id: string,
    status: 'ACCEPTED' | 'DECLINED' | 'SNOOZED',
    guardianId: GuardianId,
    now: Date,
  ): Promise<GraduationSuggestion | null>;
  transitionAssignment(input: {
    familyId: FamilyId;
    assignmentId: ActivityAssignmentId;
    expectedVersion: number;
    from: 'ACTIVE' | 'GRADUATED';
    to: 'ACTIVE' | 'GRADUATED';
    now: Date;
    activeFrom?: string;
  }): Promise<GraduationAssignment | null>;
  createGraduationRecord(input: {
    id: string;
    familyId: FamilyId;
    childId: ChildId;
    assignmentId: ActivityAssignmentId;
    approvedBy: GuardianId;
    approvedAt: Date;
    monitoringIntervalDays: number;
  }): Promise<GraduationRecord>;
  getActiveGraduation(
    familyId: FamilyId,
    assignmentId: ActivityAssignmentId,
  ): Promise<GraduationRecord | null>;
  listChildGraduatedForRecord(
    familyId: FamilyId,
    recordId: string,
  ): Promise<GraduationRecord | null>;
  listChildGraduated(
    familyId: FamilyId,
    childId: ChildId,
  ): Promise<
    Array<{
      record: GraduationRecord;
      title: string;
      templateKey: string | null;
    }>
  >;
  addObservation(input: {
    id: string;
    familyId: FamilyId;
    graduationRecordId: string;
    recordedBy: GuardianId;
    result: ObservationResult;
    observedAt: Date;
    recordedAt: Date;
  }): Promise<void>;
  listObservations(
    familyId: FamilyId,
    graduationRecordId: string,
  ): Promise<GraduationObservation[]>;
  reactivateRecord(
    familyId: FamilyId,
    recordId: string,
    guardianId: GuardianId,
    now: Date,
  ): Promise<GraduationRecord | null>;
}
