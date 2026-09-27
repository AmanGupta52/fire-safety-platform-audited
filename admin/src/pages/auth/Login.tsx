import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
  const setSession = useAuthStore((s) => s.setSession);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.post('/auth/login', values)).data.data,
    onSuccess: (data) => {
      if (data.user.role === 'customer') {
        toast.error('This console is for staff accounts only.');
        return;
      }
      setSession(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}`);
      navigate('/');
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-brand">
            <FlameKindling className="h-4 w-4 text-white" />
          </div>
          <span className="page-heading text-base">Fire Safety Platform</span>
        </div>

        <div className="max-w-sm">
          <p className="page-heading text-3xl leading-tight text-white">
            Every extinguisher tracked. Every renewal on time.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Run products, quotations, AMC contracts, service bookings and your team from a single
            operations console — built for the pace of fire-safety work.
          </p>
        </div>

        <p className="text-xs text-white/35">© {new Date().getFullYear()} Fire Safety Platform. Internal staff access only.</p>

        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand/10" />
      </div>

      {/* Right: form */}
      <div className="flex w-full flex-col items-center justify-center bg-paper px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-brand">
                <FlameKindling className="h-4 w-4 text-white" />
              </div>
              <span className="page-heading text-sm">Fire Safety Platform</span>
            </div>
          </div>

          <h1 className="page-heading text-xl text-ink">Sign in to your console</h1>
          <p className="mt-1 text-sm text-slateink">Use your staff email and password.</p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" loading={mutation.isPending} className="mt-2 w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-xs text-slateink">
            Forgot your password? Ask a super admin to reset it from Staff &amp; Roles, or use the
            forgot-password flow on the customer site if your account was created there.
          </p>
        </div>
      </div>
    </div>
  );
}
