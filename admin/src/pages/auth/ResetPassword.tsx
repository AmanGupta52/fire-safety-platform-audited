import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, FlameKindling } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

interface FormValues {
  password: string;
  confirmPassword: string;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>();

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      (await api.post('/auth/reset-password', { token, password: values.password })).data.data,
    onSuccess: () => {
      setDone(true);
      toast.success('Password set successfully — please sign in');
      setTimeout(() => navigate('/login'), 1500);
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-4">
        <div className="w-full max-w-sm rounded border border-line bg-white p-6 text-center shadow-card">
          <h1 className="text-lg font-semibold text-ink">Invalid or Missing Link</h1>
          <p className="mt-2 text-xs text-slateink">This link is missing its security token or has expired.</p>
          <div className="mt-6">
            <Link to="/login" className="text-xs font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const passwordVal = watch('password');

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm rounded border border-line bg-white p-6 shadow-card">
        <div className="mb-4 flex flex-col items-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded bg-brand text-white">
            <FlameKindling className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-ink">Set Your Staff Password</h1>
          <p className="mt-0.5 text-xs text-slateink text-center">
            Create a secure password for your administrative staff account.
          </p>
        </div>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 text-left"
        >
          <Input
            label="New Password"
            type="password"
            required
            hint="At least 8 characters"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' }
            })}
          />

          <Input
            label="Confirm Password"
            type="password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (val) => val === passwordVal || 'Passwords do not match'
            })}
          />

          <Button type="submit" loading={mutation.isPending} disabled={done} className="w-full mt-2">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Set Password & Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slateink">
          <Link to="/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
