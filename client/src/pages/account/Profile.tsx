import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, toastApiError } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/ui/Primitives';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { gstinRules, optionalPhoneRules, optionalTextRules, requiredTextRules } from '../../lib/validators';

interface FormValues { name: string; phone?: string; companyName?: string; gstNumber?: string }

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: user?.name, phone: user?.phone, companyName: user?.companyName, gstNumber: user?.gstNumber }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.put('/auth/profile', values)).data.data,
    onSuccess: (data) => { toast.success('Profile updated'); updateUser(data); },
    onError: toastApiError
  });

  return (
    <div>
      <h1 className="heading text-xl text-ink">Profile</h1>

      <Card className="mt-5 max-w-lg p-5">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Input label="Full name" required autoComplete="name" error={errors.name?.message} {...register('name', requiredTextRules)} />
          <Input label="Email" value={user?.email} disabled hint="Contact support to change your email" />
          <Input label="Phone" type="tel" inputMode="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone', optionalPhoneRules)} />
          {user?.customerType !== 'b2c' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Company name" error={errors.companyName?.message} {...register('companyName', optionalTextRules)} />
              <Input label="GSTIN" maxLength={15} error={errors.gstNumber?.message} {...register('gstNumber', gstinRules)} />
            </div>
          )}
          <div className="mt-2 flex justify-end border-t border-line pt-4">
            <Button type="submit" loading={mutation.isPending}>Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
