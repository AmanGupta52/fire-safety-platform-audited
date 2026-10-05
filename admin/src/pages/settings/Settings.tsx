import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Building2, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Primitives';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Primitives';
import { useAuthStore } from '../../store/authStore';
import { CompanySettings } from '../../types';

export default function Settings() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { data, isLoading } = useQuery({
    queryKey: ['setting-company'],
    queryFn: async () => {
      const res = await api.get('/settings/company');
      return res.data.data as Partial<CompanySettings>;
    }
  });

  const { register, handleSubmit, reset } = useForm<CompanySettings>({
    defaultValues: {
      name: 'Shubam Fire Protection',
      companyName: 'Shubam Fire Protection',
      description: 'Fire extinguishers, alarm systems and safety equipment with installation, refilling and AMC services across India.',
      phone: '+91-00000-00000',
      alternatePhone: '',
      whatsapp: '+91-00000-00000',
      email: 'info@firesafety.example',
      address: 'Navi Mumbai, Maharashtra, India',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400703',
      businessHours: 'Mon - Sat: 9:00 AM - 6:00 PM',
      emergencyContact: '+91-00000-00000',
      gstin: '',
      gstNumber: '',
      copyrightText: 'Shubam Fire Protection'
    }
  });

  useEffect(() => {
    if (data) {
      reset({
        name: data.name || data.companyName || 'Shubam Fire Protection',
        companyName: data.companyName || data.name || 'Shubam Fire Protection',
        description: data.description || '',
        phone: data.phone || '',
        alternatePhone: data.alternatePhone || '',
        whatsapp: data.whatsapp || data.whatsApp || '',
        email: data.email || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        businessHours: data.businessHours || '',
        emergencyContact: data.emergencyContact || '',
        gstin: data.gstin || data.gstNumber || '',
        gstNumber: data.gstNumber || data.gstin || '',
        copyrightText: data.copyrightText || ''
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CompanySettings) => {
      const payload = {
        ...values,
        name: values.companyName || values.name,
        companyName: values.companyName || values.name,
        gstNumber: values.gstin || values.gstNumber,
        gstin: values.gstin || values.gstNumber,
        whatsapp: values.whatsapp,
        whatsApp: values.whatsapp
      };
      return api.put('/settings/company', { value: payload });
    },
    onSuccess: () => {
      toast.success('Company settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['setting-company'] });
      queryClient.invalidateQueries({ queryKey: ['public-settings'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Company & Store Settings"
        description="Global business information, brand details, contact lines, and tax configuration."
      />

      {!isSuperAdmin && (
        <div className="mb-6 flex items-start gap-3 rounded border border-amber/30 bg-amber-light/30 p-4 text-sm text-ink">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber" />
          <div>
            <p className="font-semibold text-amber-900">Super Admin Access Required</p>
            <p className="mt-0.5 text-xs text-slateink">
              Only users with the <b>Super Admin</b> role can modify global company identity and tax settings.
              You are currently viewing in read-only mode.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        {/* Company Identity */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
            <Building2 className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-ink">Company Identity</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Company Name"
              required
              disabled={!isSuperAdmin}
              {...register('companyName', { required: 'Company name is required' })}
            />
            <Input
              label="Copyright / Legal Entity Name"
              disabled={!isSuperAdmin}
              placeholder="e.g. Shubam Fire Protection Pvt Ltd"
              {...register('copyrightText')}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Company Tagline / Bio"
              disabled={!isSuperAdmin}
              placeholder="Brief description displayed on the public storefront footer and quotes..."
              rows={2}
              {...register('description')}
            />
          </div>
        </Card>

        {/* Contact Numbers & Channels */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
            <Phone className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-ink">Contact & Communication</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Primary Phone Number"
              required
              disabled={!isSuperAdmin}
              placeholder="+91 98765 43210"
              {...register('phone', { required: 'Phone is required' })}
            />
            <Input
              label="Primary Email Address"
              type="email"
              required
              disabled={!isSuperAdmin}
              placeholder="support@firesafety.example"
              {...register('email', { required: 'Email is required' })}
            />
            <Input
              label="WhatsApp Support Number"
              disabled={!isSuperAdmin}
              placeholder="+91 98765 43210 (without spaces for direct chat)"
              {...register('whatsapp')}
            />
            <Input
              label="Emergency Support Hotline"
              disabled={!isSuperAdmin}
              placeholder="+91 98765 43210 (shown on header utility bar)"
              {...register('emergencyContact')}
            />
            <Input
              label="Alternate Phone (Optional)"
              disabled={!isSuperAdmin}
              placeholder="+91 22 2789 0000"
              {...register('alternatePhone')}
            />
            <Input
              label="Business Hours"
              disabled={!isSuperAdmin}
              placeholder="Mon - Sat: 9:00 AM - 6:00 PM"
              {...register('businessHours')}
            />
          </div>
        </Card>

        {/* Physical Address */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
            <MapPin className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-ink">Business Address & Tax</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="Full Street Address"
              required
              disabled={!isSuperAdmin}
              placeholder="Office 102, Building A, Industrial Area..."
              {...register('address', { required: 'Address is required' })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="City"
                disabled={!isSuperAdmin}
                placeholder="Navi Mumbai"
                {...register('city')}
              />
              <Input
                label="Home State"
                disabled={!isSuperAdmin}
                hint="Used to determine Intra-state (CGST+SGST) vs Inter-state (IGST)"
                placeholder="Maharashtra"
                {...register('state')}
              />
              <Input
                label="PIN Code"
                disabled={!isSuperAdmin}
                placeholder="400703"
                {...register('pincode')}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="GSTIN / GST Number"
                disabled={!isSuperAdmin}
                placeholder="27AAAAA0000A1Z5"
                hint="Printed on all tax invoices and official quotations"
                {...register('gstin')}
              />
            </div>
          </div>
        </Card>

        {isSuperAdmin && (
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={mutation.isPending} size="md">
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Save Company Settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
