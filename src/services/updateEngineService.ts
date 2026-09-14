import {
  FileManifestEntry,
  DatabaseMigration,
  EnterpriseUpdateManifest,
  UpdateBackupInfo,
  DigitalSignatureEngine,
  Sha256Verifier,
  UpdateBuilder,
  AtomicBackupEngine,
  RollbackEngine,
  DatabaseMigrationEngine,
  PhysicalFileReplacementEngine,
  EnterpriseUpdateEngine,
  UPDATE_HMAC_SECRET
} from './EnterpriseUpdateEngine';

export {
  FileManifestEntry,
  DatabaseMigration,
  EnterpriseUpdateManifest,
  UpdateBackupInfo,
  DigitalSignatureEngine,
  Sha256Verifier,
  UpdateBuilder,
  AtomicBackupEngine,
  RollbackEngine,
  DatabaseMigrationEngine,
  PhysicalFileReplacementEngine,
  EnterpriseUpdateEngine,
  UPDATE_HMAC_SECRET
};

export class ServerUpdateEngine {
  static computeSha256(content: Buffer | string): string {
    return Sha256Verifier.compute(content);
  }

  static generateDigitalSignature(payloadWithoutSignature: Omit<EnterpriseUpdateManifest, 'digitalSignature'>): string {
    return DigitalSignatureEngine.sign(payloadWithoutSignature);
  }

  static verifyDigitalSignature(manifest: EnterpriseUpdateManifest): boolean {
    return DigitalSignatureEngine.verify(manifest);
  }

  static getAppliedMigrations(): DatabaseMigration[] {
    return DatabaseMigrationEngine.getAppliedMigrations();
  }

  static recordAppliedMigration(migration: DatabaseMigration) {
    DatabaseMigrationEngine.recordApplied(migration);
  }

  static listBackups(): UpdateBackupInfo[] {
    return AtomicBackupEngine.listBackups();
  }

  static getUpdateHistory(): any[] {
    const historyPath = require('path').join(process.cwd(), '.updates_storage', 'update_history.json');
    if (!require('fs').existsSync(historyPath)) return [];
    try {
      return JSON.parse(require('fs').readFileSync(historyPath, 'utf8'));
    } catch {
      return [];
    }
  }
}
