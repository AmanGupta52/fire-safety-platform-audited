import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/ui/Primitives';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

interface FormValues { name: string; phone?: string; companyName?: string; gstNumber?: string }

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { name: user?.name, phone: user?.phone, companyName: user?.companyName, gstNumber: user?.gstNumber }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.put('/auth/profile', values)).data.data,
    onSuccess: (data) => { toast.success('Profile updated'); updateUser(data); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <div>
      <h1 className="heading text-xl text-ink">Profile</h1>

      <Card className="mt-5 max-w-lg p-5">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Input label="Full name" required {...register('name', { required: true })} />
          <Input label="Email" value={user?.email} disabled hint="Contact support to change your email" />
          <Input label="Phone" {...register('phone')} />
          {user?.customerType !== 'b2c' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Company name" {...register('companyName')} />
              <Input label="GSTIN" {...register('gstNumber')} />
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
