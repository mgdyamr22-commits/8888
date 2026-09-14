export interface SystemRequirementCheck {
  name: string;
  status: boolean;
  detail: string;
}

export interface SystemCheckResponse {
  success?: boolean;
  allPassed?: boolean;
  passed?: boolean;
  checks?: SystemRequirementCheck[];
  requirements?: Array<{
    name: string;
    passed: boolean;
    current: string;
    required: string;
  }>;
  phpVersion?: string;
  serverTime?: string;
}

export interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password?: string;
}

export interface AdminSecurityQuestion {
  question: string;
  answer: string;
}

export interface SuperAdminConfig {
  fullName: string;
  username: string;
  password: string;
  confirmPassword?: string;
  email: string;
  phone: string;
  recoveryCode: string;
  securityQuestions: AdminSecurityQuestion[];
}

export interface OrganizationConfig {
  name: string;
  phone: string;
  commercialRegister: string;
  taxNumber: string;
  address: string;
  logo?: string;
  stamp?: string;
}

export interface InstallationStatusResponse {
  installed: boolean;
  databaseConnected: boolean;
  hasDb: boolean;
  hasAdmin: boolean;
  tablesCount: number;
  organization?: any;
  reason?: string;
  error?: string;
  nodeVersion?: string;
  platform?: string;
  serverTime?: string;
}
