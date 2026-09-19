import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { FlameKindling } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required')
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.post('/auth/login', values)).data.data,
    onSuccess: (data) => {
      setSession(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}`);
      const from = (location.state as { from?: string })?.from || '/account';
      navigate(from);
    },
    onError: (err, values) => {
      // The account exists and the password is correct, but the email was never verified —
      // send them to the same OTP screen used right after registration instead of a dead-end error.
      const isUnverified = axios.isAxiosError(err) &&
        (err.response?.data as any)?.errors?.some((e: any) => e.code === 'EMAIL_NOT_VERIFIED');
      if (isUnverified) {
        toast('Please verify your email to continue', { icon: '🔒' });
        navigate('/verify-email', { state: { email: values.email } });
        return;
      }
      toast.error(apiErrorMessage(err));
    }
  });

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-brand"><FlameKindling className="h-4 w-4 text-white" /></div>
        </div>
        <h1 className="heading text-center text-xl text-ink">Sign in to your account</h1>
        <p className="mt-1 text-center text-sm text-slateink">Track orders, book services and manage your equipment.</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
          <Input label="Password" type="password" required error={errors.password?.message} {...register('password')} />
          <div className="-mt-2 text-right">
            <Link to="/forgot-password" className="text-xs font-medium text-brand hover:underline">Forgot password?</Link>
          </div>
          <Button type="submit" loading={mutation.isPending} fullWidth>Sign in</Button>
        </form>

        <p className="mt-6 text-center text-sm text-slateink">
          New here? <Link to="/register" className="font-medium text-brand hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
