import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useState } from 'react';
import clsx from 'clsx';
import { ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(8, 'At least 8 characters'),
  companyName: z.string().optional(),
  gstNumber: z.string().optional()
});
type FormValues = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const [customerType, setCustomerType] = useState<'b2c' | 'b2b'>('b2c');
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Registration no longer signs the user in directly: the account is created unverified and a
  // 6-digit code is emailed to confirm ownership of the address before any session is issued —
  // applies the same way for individual and business accounts.
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.post('/auth/register', { ...values, customerType })).data.data,
    onSuccess: (data) => {
      toast.success('Check your email for a verification code');
      navigate('/verify-email', { state: { email: data.email } });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="heading text-center text-xl text-ink">Create your account</h1>
        <p className="mt-1 text-center text-sm text-slateink">Shop fire safety products and manage your services in one place.</p>

        <div className="mt-5 flex rounded-full border border-line bg-white p-1">
          {(['b2c', 'b2b'] as const).map((t) => (
            <button
              key={t} type="button" onClick={() => setCustomerType(t)}
              className={clsx('flex-1 rounded-full py-2 text-sm font-medium transition-colors', customerType === t ? 'bg-ink text-white' : 'text-slateink')}
            >
              {t === 'b2c' ? 'Individual' : 'Business'}
            </button>
          ))}
        </div>

        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Input label="Full name" required error={errors.name?.message} {...register('name')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
            <Input label="Phone" required error={errors.phone?.message} {...register('phone')} />
          </div>
          {customerType === 'b2b' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Company name" {...register('companyName')} />
              <Input label="GSTIN" {...register('gstNumber')} />
            </div>
          )}
          <Input label="Password" type="password" required hint="At least 8 characters" error={errors.password?.message} {...register('password')} />
          <Button type="submit" loading={mutation.isPending} fullWidth>Create account</Button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slateink">
          <ShieldCheck className="h-3.5 w-3.5 text-forest" /> We'll email you a 6-digit code to confirm this address
        </p>

        <p className="mt-4 text-center text-sm text-slateink">
          Already have an account? <Link to="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
