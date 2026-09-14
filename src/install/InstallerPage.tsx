import React from 'react';
import { InstallerWizard } from './InstallerWizard';

export const InstallerPage: React.FC = () => {
  return (
    <InstallerWizard
      onInstallationComplete={() => {
        window.location.href = '/';
      }}
    />
  );
};

export default InstallerPage;
