import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient';
import { CompanySettings } from '../types';

export interface PublicSettingsResponse {
  company?: CompanySettings;
  shipping?: Record<string, unknown>;
  reminders?: Record<string, unknown>;
  [key: string]: unknown;
}

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: 'Shubam Fire Protection',
  companyName: 'Shubam Fire Protection',
  phone: '+91-00000-00000',
  email: 'info@firesafety.example',
  address: 'Mumbai, Maharashtra, India',
  businessHours: 'Mon - Sat: 9:00 AM - 6:00 PM',
  whatsapp: '+91-00000-00000'
};

export function usePublicSettings() {
  const query = useQuery({
    queryKey: ['public-settings'],
    queryFn: async () => {
      const res = await api.get('/settings/public');
      return res.data.data as PublicSettingsResponse;
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const company: CompanySettings = {
    ...DEFAULT_COMPANY_SETTINGS,
    ...(query.data?.company || {})
  };

  // Ensure fallback syncing
  company.companyName = company.companyName || company.name || DEFAULT_COMPANY_SETTINGS.companyName;
  company.name = company.name || company.companyName;

  return {
    ...query,
    settings: query.data,
    company
  };
}
