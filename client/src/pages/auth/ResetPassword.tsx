import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(8, 'At least 8 characters')
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });
type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      (await api.post('/auth/reset-password', { token, password: values.password })).data.data,
    onSuccess: () => {
      setDone(true);
      toast.success('Password reset — please sign in');
      setTimeout(() => navigate('/login'), 1500);
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  // No token in the URL at all — don't even show the form, since the request would fail anyway.
  if (!token) {
    return (
      <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="heading text-xl text-ink">Invalid reset link</h1>
          <p className="mt-2 text-sm text-slateink">This link is missing its token. Request a new one.</p>
          <p className="mt-6 text-sm text-slateink">
            <Link to="/forgot-password" className="font-medium text-brand hover:underline">Request a new link</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
          <KeyRound className="h-6 w-6 text-brand" />
        </div>
        <h1 className="heading mt-4 text-center text-xl text-ink">Set a new password</h1>
        <p className="mt-1 text-center text-sm text-slateink">Choose a new password for your account.</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Input
            label="New password" type="password" required hint="At least 8 characters"
            error={errors.password?.message} {...register('password')}
          />
          <Input
            label="Confirm password" type="password" required
            error={errors.confirmPassword?.message} {...register('confirmPassword')}
          />
          <Button type="submit" loading={mutation.isPending} disabled={done} fullWidth>Reset password</Button>
        </form>

        <p className="mt-6 text-center text-sm text-slateink">
          <Link to="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
