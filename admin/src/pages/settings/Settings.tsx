import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Primitives';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Primitives';

interface CompanySettings {
  name: string; address: string; phone: string; email: string; gstin?: string; state?: string;
}

export default function Settings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['setting-company'],
    queryFn: async () => (await api.get('/settings/company')).data.data as Partial<CompanySettings>
  });

  const { register, handleSubmit } = useForm<CompanySettings>({ values: data as CompanySettings });

  const mutation = useMutation({
    mutationFn: async (values: CompanySettings) => api.put('/settings/company', { value: values }),
    onSuccess: () => { toast.success('Company settings saved'); queryClient.invalidateQueries({ queryKey: ['setting-company'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" description="Company information used on invoices, quotations and the storefront." />

      <Card className="max-w-2xl p-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Input label="Company name" required {...register('name')} />
          <Input label="Address" required {...register('address')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" required {...register('phone')} />
            <Input label="Email" type="email" required {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="GSTIN" {...register('gstin')} />
            <Input label="Home state" hint="Used to decide CGST+SGST vs IGST on invoices" {...register('state')} />
          </div>
          <div className="mt-2 flex justify-end border-t border-line pt-4">
            <Button type="submit" loading={mutation.isPending}>Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
