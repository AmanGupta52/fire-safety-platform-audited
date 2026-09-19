import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MailCheck } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

const schema = z.object({
  email: z.string().email('Enter a valid email')
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  // The API always answers the same way whether or not the email exists (see forgotPassword on
  // the server), so the "check your email" screen below is shown unconditionally on success —
  // never conditioned on anything the response tells us.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.post('/auth/forgot-password', values)).data.data,
    onSuccess: (_data, values) => setSentTo(values.email),
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (sentTo) {
    return (
      <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
            <MailCheck className="h-6 w-6 text-brand" />
          </div>
          <h1 className="heading mt-4 text-xl text-ink">Check your email</h1>
          <p className="mt-1 text-sm text-slateink">
            If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we've sent a link to
            reset your password. It expires in 1 hour.
          </p>
          <p className="mt-6 text-sm text-slateink">
            <Link to="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="heading text-center text-xl text-ink">Forgot your password?</h1>
        <p className="mt-1 text-center text-sm text-slateink">
          Enter the email on your account and we'll send you a reset link.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
          <Button type="submit" loading={mutation.isPending} fullWidth>Send reset link</Button>
        </form>

        <p className="mt-6 text-center text-sm text-slateink">
          Remembered it? <Link to="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
